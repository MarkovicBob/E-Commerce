from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user, current_user, optional_user
from app.api.v1.routers.products import update_average_rating
from app.db.session import get_db
from app.models import Order, OrderItem, OrderStatus, Product, Review, User
from app.services.i18n import localized, normalize_lang

router = APIRouter()

# A review is only meaningful once the customer actually has the goods.
REVIEWABLE_STATUSES = {OrderStatus.processing, OrderStatus.shipped, OrderStatus.delivered}


class ReviewIn(BaseModel):
    order_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)
    language_code: str = Field(default="sr", pattern=r"^(sr|en|de)$")


def display_name(full_name: str | None, lang: str = "sr") -> str:
    """Reviews show a first name and an initial rather than the full identity."""
    parts = (full_name or "").split()
    if not parts:
        return {"sr": "Anonimno", "en": "Anonymous", "de": "Anonym"}[normalize_lang(lang)]
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


def review_out(review: Review, db: Session, lang: str = "sr") -> dict:
    author = db.get(User, review.user_id)
    lang = normalize_lang(lang)
    translated_comment = {
        "sr": review.comment,
        "en": review.comment_en,
        "de": review.comment_de,
    }[lang]
    return {
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "author": display_name(author.full_name if author else None, lang),
        "order_id": review.order_id,
        "rating": review.rating,
        # A real customer review may only exist in the language in which it was
        # written. In that case preserve the original instead of hiding it.
        "comment": translated_comment or review.comment,
        "is_approved": review.is_approved,
        "created_at": review.created_at,
    }


def reviewable_order_ids(db: Session, user: User, product_id: int) -> list[int]:
    """Orders of this user that contain the product and are far enough along to review."""
    rows = (
        db.query(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(
            Order.user_id == user.id,
            OrderItem.product_id == product_id,
            Order.status.in_(REVIEWABLE_STATUSES),
        )
        .distinct()
        .all()
    )
    already = {
        row[0]
        for row in db.query(Review.order_id).filter_by(user_id=user.id, product_id=product_id).all()
    }
    return [row[0] for row in rows if row[0] not in already]


@router.get("/products/{product_id}/reviews")
def product_reviews(
    product_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    lang: str = "sr",
    user=Depends(optional_user),
    db: Session = Depends(get_db),
):
    query = db.query(Review).filter_by(product_id=product_id)
    if not user or user.role.value != "admin":
        query = query.filter_by(is_approved=True)
    total = query.count()
    items = query.order_by(Review.created_at.desc(), Review.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    breakdown = dict(
        db.query(Review.rating, func.count(Review.id))
        .filter(Review.product_id == product_id, Review.is_approved.is_(True))
        .group_by(Review.rating)
        .all()
    )
    average = (
        db.query(func.avg(Review.rating))
        .filter(Review.product_id == product_id, Review.is_approved.is_(True))
        .scalar()
    )
    return {
        "items": [review_out(item, db, lang) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "average_rating": round(float(average or 0), 2),
        "breakdown": {str(star): int(breakdown.get(star, 0)) for star in range(5, 0, -1)},
    }


@router.get("/products/{product_id}/reviews/eligibility")
def review_eligibility(product_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    """Lets the product page show the review form only when it will actually be accepted."""
    orders = reviewable_order_ids(db, user, product_id)
    return {"can_review": bool(orders), "order_ids": orders}


@router.post("/products/{product_id}/reviews", status_code=201)
def create_review(product_id: int, payload: ReviewIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    if payload.order_id not in reviewable_order_ids(db, user, product_id):
        raise HTTPException(403, "Review requires a delivered purchase you have not reviewed yet")
    comment = (payload.comment or "").strip() or None
    review = Review(
        product_id=product_id,
        user_id=user.id,
        order_id=payload.order_id,
        rating=payload.rating,
        comment=comment,
        comment_en=comment if payload.language_code == "en" else None,
        comment_de=comment if payload.language_code == "de" else None,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review_out(review, db, payload.language_code)


@router.get("/admin/reviews", dependencies=[Depends(admin_user)])
def admin_reviews(
    approved: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    lang: str = "sr",
    db: Session = Depends(get_db),
):
    query = db.query(Review)
    if approved is not None:
        query = query.filter(Review.is_approved.is_(approved))
    total = query.count()
    items = query.order_by(Review.created_at.desc(), Review.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    products = {p.id: localized(p, lang, ("name",))["name"] for p in db.query(Product).all()}
    return {
        "items": [{**review_out(item, db, lang), "product_name": products.get(item.product_id)} for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "pending_count": db.query(Review).filter(Review.is_approved.is_(False)).count(),
    }


@router.put("/admin/reviews/{review_id}/approve", dependencies=[Depends(admin_user)])
def approve_review(review_id: int, db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    review.is_approved = True
    db.flush()
    update_average_rating(db, review.product_id)
    db.commit()
    db.refresh(review)
    return review_out(review, db)


@router.put("/admin/reviews/{review_id}/reject", dependencies=[Depends(admin_user)])
def reject_review(review_id: int, db: Session = Depends(get_db)):
    """Unapprove without deleting, so a moderation decision can be walked back."""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    review.is_approved = False
    db.flush()
    update_average_rating(db, review.product_id)
    db.commit()
    db.refresh(review)
    return review_out(review, db)


@router.delete("/admin/reviews/{review_id}", dependencies=[Depends(admin_user)])
def delete_review(review_id: int, db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    product_id = review.product_id
    db.delete(review)
    db.flush()
    update_average_rating(db, product_id)
    db.commit()
    return {"detail": "Review deleted"}
