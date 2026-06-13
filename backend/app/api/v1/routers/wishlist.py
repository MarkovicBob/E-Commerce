from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.api.v1.routers.products import product_out
from app.db.session import get_db
from app.models import Product, WishlistItem

router = APIRouter()


@router.get("")
def list_wishlist(user=Depends(current_user), db: Session = Depends(get_db)):
    items = db.query(WishlistItem).filter_by(user_id=user.id).all()
    return [product_out(item.product) for item in items]


@router.post("/{product_id}")
def add_wishlist(product_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    existing = db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).first()
    if not existing:
        db.add(WishlistItem(user_id=user.id, product_id=product_id))
        db.commit()
    return {"detail": "Added to wishlist"}


@router.delete("/{product_id}")
def remove_wishlist(product_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Removed from wishlist"}
