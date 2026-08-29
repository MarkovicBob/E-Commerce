from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user, current_user, optional_user
from app.api.v1.routers.products import update_average_rating
from app.db.session import get_db
from app.models import Order, OrderItem, Review

router = APIRouter()


class ReviewIn(BaseModel):
    order_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


def review_out(review: Review) -> dict:
    return {
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "order_id": review.order_id,
        "rating": review.rating,
        "comment": review.comment,
        "is_approved": review.is_approved,
        "created_at": review.created_at,
    }


@router.get("/products/{product_id}/reviews")
def product_reviews(product_id: int, user=Depends(optional_user), db: Session = Depends(get_db)):
    query = db.query(Review).filter_by(product_id=product_id)
    if not user or user.role.value != "admin":
        query = query.filter_by(is_approved=True)
    return [review_out(item) for item in query.order_by(Review.created_at.desc()).all()]


@router.post("/products/{product_id}/reviews")
def create_review(product_id: int, payload: ReviewIn, user=Depends(current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=payload.order_id, user_id=user.id).first()
    bought = order and db.query(OrderItem).filter_by(order_id=order.id, product_id=product_id).first()
    if not bought:
        raise HTTPException(403, "Review requires verified purchase")
    if db.query(Review).filter_by(product_id=product_id, user_id=user.id, order_id=payload.order_id).first():
        raise HTTPException(409, "You have already reviewed this product for this order")
    review = Review(product_id=product_id, user_id=user.id, order_id=payload.order_id, rating=payload.rating, comment=payload.comment)
    db.add(review)
    db.commit()
    return review_out(review)


@router.get("/admin/reviews", dependencies=[Depends(admin_user)])
def admin_reviews(db: Session = Depends(get_db)):
    return [review_out(item) for item in db.query(Review).order_by(Review.created_at.desc()).all()]


@router.put("/admin/reviews/{review_id}/approve", dependencies=[Depends(admin_user)])
def approve_review(review_id: int, db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    review.is_approved = True
    update_average_rating(db, review.product_id)
    db.commit()
    return review_out(review)


@router.delete("/admin/reviews/{review_id}", dependencies=[Depends(admin_user)])
def delete_review(review_id: int, db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    product_id = review.product_id
    db.delete(review)
    update_average_rating(db, product_id)
    db.commit()
    return {"detail": "Review deleted"}
