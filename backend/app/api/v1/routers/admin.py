from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user
from app.api.v1.routers.blog import blog_out
from app.api.v1.routers.orders import StatusIn, order_out, restock
from app.api.v1.routers.products import filtered_query, product_out
from app.db.session import get_db
from app.models import (
    BlogPost,
    BlogPostTranslation,
    NewsletterSubscriber,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductStatus,
    PromoCode,
    PromoType,
    Review,
    User,
    UserRole,
)
from app.services.i18n import SUPPORTED_LANGS

router = APIRouter(dependencies=[Depends(admin_user)])

LOW_STOCK_THRESHOLD = 5


class RoleIn(BaseModel):
    role: UserRole


class PromoIn(BaseModel):
    code: str
    discount_percent: float = 0
    discount_amount: float | None = None
    is_active: bool = True
    expires_at: datetime | None = None
    usage_limit: int | None = None
    type: PromoType = PromoType.general


class BlogTranslationIn(BaseModel):
    language_code: str
    title: str
    excerpt: str
    content: str


class BlogIn(BaseModel):
    slug: str
    title: str
    excerpt: str
    content: str
    cover_image_url: str | None = None
    category: str
    is_published: bool = True
    # None leaves existing translations untouched; [] clears them explicitly.
    translations: list[BlogTranslationIn] | None = None


def promo_out(promo: PromoCode) -> dict:
    return {
        "id": promo.id,
        "code": promo.code,
        "discount_percent": float(promo.discount_percent or 0),
        "discount_amount": float(promo.discount_amount) if promo.discount_amount is not None else None,
        "is_active": promo.is_active,
        "expires_at": promo.expires_at,
        "usage_limit": promo.usage_limit,
        "times_used": promo.times_used,
        "type": promo.type.value,
    }


def user_out(user: User, db: Session) -> dict:
    spend = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.user_id == user.id, Order.status != OrderStatus.cancelled)
        .scalar()
    )
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role.value,
        "referral_code": user.referral_code,
        "created_at": user.created_at,
        "order_count": db.query(Order).filter_by(user_id=user.id).count(),
        "total_spent": float(spend or 0),
    }


@router.get("/stats")
def stats(days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)):
    """Headline numbers plus the series the dashboard chart plots."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    paid = db.query(Order).filter(Order.status != OrderStatus.cancelled)

    revenue_total = paid.with_entities(func.coalesce(func.sum(Order.total), 0)).scalar()
    revenue_period = (
        paid.filter(Order.created_at >= since).with_entities(func.coalesce(func.sum(Order.total), 0)).scalar()
    )
    order_count = db.query(Order).count()

    top_products = (
        db.query(
            OrderItem.product_name_snapshot,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.line_total).label("revenue"),
        )
        .group_by(OrderItem.product_name_snapshot)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )
    by_status = dict(db.query(Order.status, func.count(Order.id)).group_by(Order.status).all())

    # Daily revenue for the chart; done in Python so it behaves the same on SQLite and Postgres.
    recent = paid.filter(Order.created_at >= since).with_entities(Order.created_at, Order.total).all()
    buckets: dict[str, float] = {}
    for created_at, total in recent:
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        key = created_at.date().isoformat()
        buckets[key] = round(buckets.get(key, 0) + float(total), 2)
    series = [
        {"date": (since + timedelta(days=offset)).date().isoformat(), "revenue": 0.0}
        for offset in range(days + 1)
    ]
    for point in series:
        point["revenue"] = buckets.get(point["date"], 0.0)

    return {
        "orders": order_count,
        "orders_period": db.query(Order).filter(Order.created_at >= since).count(),
        "revenue_total": float(revenue_total or 0),
        "revenue_period": float(revenue_period or 0),
        "average_order_value": round(float(revenue_total or 0) / order_count, 2) if order_count else 0.0,
        "users": db.query(User).count(),
        "new_users_period": db.query(User).filter(User.created_at >= since).count(),
        "products": db.query(Product).filter(Product.status == ProductStatus.active).count(),
        "pending_reviews": db.query(Review).filter(Review.is_approved.is_(False)).count(),
        "newsletter_subscribers": db.query(NewsletterSubscriber).filter(NewsletterSubscriber.is_active.is_(True)).count(),
        "low_stock": [
            {"id": p.id, "name": p.name, "stock_quantity": p.stock_quantity}
            for p in db.query(Product)
            .filter(Product.status == ProductStatus.active, Product.stock_quantity <= LOW_STOCK_THRESHOLD)
            .order_by(Product.stock_quantity)
            .limit(10)
            .all()
        ],
        "top_products": [
            {"name": row[0], "quantity": int(row[1]), "revenue": float(row[2] or 0)} for row in top_products
        ],
        "orders_by_status": {status.value: int(by_status.get(status, 0)) for status in OrderStatus},
        "revenue_series": series,
        "period_days": days,
    }


@router.get("/products")
def admin_products(
    search: str | None = None,
    category: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    lang: str = "sr",
    db: Session = Depends(get_db),
):
    """Same filters as the storefront, but inactive products stay visible here."""
    query = filtered_query(db, search=search, category=category, include_inactive=True).distinct()
    total = query.count()
    items = query.order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [product_out(item, lang) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/users")
def users(
    search: str | None = None,
    role: UserRole | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(or_(User.email.ilike(needle), User.full_name.ilike(needle)))
    if role:
        query = query.filter(User.role == role)
    total = query.count()
    items = query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [user_out(item, db) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.put("/users/{user_id}/role")
def update_role(user_id: int, payload: RoleIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and payload.role != UserRole.admin:
        raise HTTPException(400, "You cannot remove your own admin role")
    if (
        user.role == UserRole.admin
        and payload.role != UserRole.admin
        and db.query(User).filter(User.role == UserRole.admin).count() <= 1
    ):
        # Losing the last admin would lock everyone out of this panel for good.
        raise HTTPException(400, "At least one admin must remain")
    user.role = payload.role
    db.commit()
    return user_out(user, db)


@router.get("/orders")
def admin_orders(
    status: OrderStatus | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    lang: str = "sr",
    db: Session = Depends(get_db),
):
    query = db.query(Order)
    if status:
        query = query.filter_by(status=status)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(or_(Order.order_number.ilike(needle), Order.contact_email.ilike(needle)))
    total = query.count()
    items = query.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [order_out(item, db, lang) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/orders/{order_id}")
def admin_order_detail(order_id: int, lang: str = "sr", db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order_out(order, db, lang)


@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, payload: StatusIn, lang: str = "sr", db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if payload.status == OrderStatus.cancelled and order.status != OrderStatus.cancelled:
        # Cancelling from the admin side has to return the stock too.
        restock(db, order)
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order_out(order, db, lang)


@router.get("/promo-codes")
def promo_codes(db: Session = Depends(get_db)):
    return [promo_out(promo) for promo in db.query(PromoCode).order_by(PromoCode.id.desc()).all()]


@router.post("/promo-codes", status_code=201)
def create_promo(payload: PromoIn, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    if db.query(PromoCode).filter_by(code=code).first():
        raise HTTPException(400, "Promo code already exists")
    promo = PromoCode(**{**payload.model_dump(), "code": code})
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo_out(promo)


@router.put("/promo-codes/{promo_id}")
def update_promo(promo_id: int, payload: PromoIn, db: Session = Depends(get_db)):
    promo = db.get(PromoCode, promo_id)
    if not promo:
        raise HTTPException(404, "Promo code not found")
    code = payload.code.strip().upper()
    if db.query(PromoCode).filter(PromoCode.code == code, PromoCode.id != promo_id).first():
        raise HTTPException(400, "Promo code already exists")
    for key, value in payload.model_dump().items():
        setattr(promo, key, value)
    promo.code = code
    db.commit()
    db.refresh(promo)
    return promo_out(promo)


@router.delete("/promo-codes/{promo_id}")
def delete_promo(promo_id: int, db: Session = Depends(get_db)):
    promo = db.get(PromoCode, promo_id)
    if not promo:
        raise HTTPException(404, "Promo code not found")
    db.delete(promo)
    db.commit()
    return {"detail": "Promo deleted"}


@router.get("/blog")
def admin_blog(lang: str = "sr", db: Session = Depends(get_db)):
    """Includes drafts, which the public blog endpoint hides."""
    return [blog_out(post, lang) for post in db.query(BlogPost).order_by(BlogPost.id.desc()).all()]


def apply_blog_translations(db: Session, post: BlogPost, translations: list[BlogTranslationIn] | None) -> None:
    """A None payload is a no-op, so editing a post does not drop its translations."""
    if translations is None:
        return
    db.query(BlogPostTranslation).filter_by(blog_post_id=post.id).delete()
    for item in translations:
        if item.language_code in SUPPORTED_LANGS:
            db.add(
                BlogPostTranslation(
                    blog_post_id=post.id,
                    language_code=item.language_code,
                    title=item.title,
                    excerpt=item.excerpt,
                    content=item.content,
                )
            )


@router.post("/blog", status_code=201)
def create_blog(payload: BlogIn, db: Session = Depends(get_db)):
    if db.query(BlogPost).filter_by(slug=payload.slug).first():
        raise HTTPException(400, "Slug already in use")
    post = BlogPost(**payload.model_dump(exclude={"translations"}))
    if post.is_published and not post.published_at:
        post.published_at = datetime.now(timezone.utc)
    db.add(post)
    db.flush()
    apply_blog_translations(db, post, payload.translations)
    db.commit()
    db.refresh(post)
    return blog_out(post)


@router.put("/blog/{post_id}")
def update_blog(post_id: int, payload: BlogIn, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(404, "Blog post not found")
    if db.query(BlogPost).filter(BlogPost.slug == payload.slug, BlogPost.id != post_id).first():
        raise HTTPException(400, "Slug already in use")
    for key, value in payload.model_dump(exclude={"translations"}).items():
        setattr(post, key, value)
    if post.is_published and not post.published_at:
        post.published_at = datetime.now(timezone.utc)
    apply_blog_translations(db, post, payload.translations)
    db.commit()
    db.refresh(post)
    return blog_out(post)


@router.delete("/blog/{post_id}")
def delete_blog(post_id: int, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(404, "Blog post not found")
    db.delete(post)
    db.commit()
    return {"detail": "Blog post deleted"}


@router.get("/newsletter")
def newsletter_subscribers(db: Session = Depends(get_db)):
    items = db.query(NewsletterSubscriber).order_by(NewsletterSubscriber.id.desc()).all()
    return [
        {"id": s.id, "email": s.email, "is_active": s.is_active, "subscribed_at": s.subscribed_at}
        for s in items
    ]
