from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.api.v1.routers.products import base_query, product_out
from app.db.session import get_db
from app.models import Product, ProductStatus, WishlistItem

router = APIRouter()


@router.get("")
def list_wishlist(lang: str = "sr", user=Depends(current_user), db: Session = Depends(get_db)):
    product_ids = [row[0] for row in db.query(WishlistItem.product_id).filter_by(user_id=user.id).all()]
    if not product_ids:
        return []
    products = base_query(db).filter(Product.id.in_(product_ids)).all()
    return [product_out(item, lang) for item in products]


@router.get("/ids")
def wishlist_ids(user=Depends(current_user), db: Session = Depends(get_db)):
    """Cheap lookup so product cards can render a filled heart without loading full products."""
    return [row[0] for row in db.query(WishlistItem.product_id).filter_by(user_id=user.id).all()]


@router.post("/{product_id}", status_code=201)
def add_wishlist(product_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product or product.status != ProductStatus.active:
        raise HTTPException(404, "Product not found")
    existing = db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).first()
    if not existing:
        db.add(WishlistItem(user_id=user.id, product_id=product_id))
        db.commit()
    return {"detail": "Added to wishlist", "product_id": product_id}


@router.delete("/{product_id}")
def remove_wishlist(product_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Removed from wishlist", "product_id": product_id}
