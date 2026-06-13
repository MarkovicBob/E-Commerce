from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user
from app.api.v1.routers.blog import blog_out
from app.api.v1.routers.orders import StatusIn, order_out
from app.db.session import get_db
from app.models import BlogPost, Order, OrderItem, OrderStatus, Product, PromoCode, PromoType, User, UserRole

router = APIRouter(dependencies=[Depends(admin_user)])


class RoleIn(BaseModel):
    role: UserRole


class PromoIn(BaseModel):
    code: str
    discount_percent: float = 0
    discount_amount: float | None = None
    is_active: bool = True
    usage_limit: int | None = None
    type: PromoType = PromoType.general


class BlogIn(BaseModel):
    slug: str
    title: str
    excerpt: str
    content: str
    cover_image_url: str | None = None
    category: str
    is_published: bool = True


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    revenue = db.query(func.coalesce(func.sum(Order.total), 0)).scalar()
    top_products = (
        db.query(OrderItem.product_name_snapshot, func.sum(OrderItem.quantity).label("qty"))
        .group_by(OrderItem.product_name_snapshot)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )
    return {
        "orders": db.query(Order).count(),
        "revenue_total": float(revenue or 0),
        "users": db.query(User).count(),
        "top_products": [{"name": row[0], "quantity": int(row[1])} for row in top_products],
    }


@router.get("/users")
def users(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(User)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value} for u in items], "total": total, "page": page, "page_size": page_size}


@router.put("/users/{user_id}/role")
def update_role(user_id: int, payload: RoleIn, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.role = payload.role
    db.commit()
    return {"detail": "Role updated"}


@router.get("/orders")
def admin_orders(status: OrderStatus | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    query = db.query(Order)
    if status:
        query = query.filter_by(status=status)
    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [order_out(item) for item in items], "total": total, "page": page, "page_size": page_size}


@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, payload: StatusIn, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = payload.status
    db.commit()
    return order_out(order)


@router.get("/promo-codes")
def promo_codes(db: Session = Depends(get_db)):
    return [{"id": p.id, "code": p.code, "discount_percent": float(p.discount_percent), "is_active": p.is_active, "type": p.type.value} for p in db.query(PromoCode).all()]


@router.post("/promo-codes")
def create_promo(payload: PromoIn, db: Session = Depends(get_db)):
    promo = PromoCode(**payload.model_dump())
    db.add(promo)
    db.commit()
    return {"id": promo.id, "code": promo.code}


@router.put("/promo-codes/{promo_id}")
def update_promo(promo_id: int, payload: PromoIn, db: Session = Depends(get_db)):
    promo = db.get(PromoCode, promo_id)
    if not promo:
        raise HTTPException(404, "Promo code not found")
    for key, value in payload.model_dump().items():
        setattr(promo, key, value)
    db.commit()
    return {"id": promo.id, "code": promo.code}


@router.delete("/promo-codes/{promo_id}")
def delete_promo(promo_id: int, db: Session = Depends(get_db)):
    promo = db.get(PromoCode, promo_id)
    if not promo:
        raise HTTPException(404, "Promo code not found")
    db.delete(promo)
    db.commit()
    return {"detail": "Promo deleted"}


@router.post("/blog")
def create_blog(payload: BlogIn, db: Session = Depends(get_db)):
    post = BlogPost(**payload.model_dump())
    db.add(post)
    db.commit()
    return blog_out(post)


@router.put("/blog/{post_id}")
def update_blog(post_id: int, payload: BlogIn, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(404, "Blog post not found")
    for key, value in payload.model_dump().items():
        setattr(post, key, value)
    db.commit()
    return blog_out(post)


@router.delete("/blog/{post_id}")
def delete_blog(post_id: int, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(404, "Blog post not found")
    db.delete(post)
    db.commit()
    return {"detail": "Blog post deleted"}
