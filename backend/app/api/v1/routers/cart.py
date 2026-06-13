from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import optional_user, session_id
from app.db.session import get_db
from app.models import Cart, CartItem, Product, PromoCode

router = APIRouter()


class CartItemIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int = 1


class QuantityIn(BaseModel):
    quantity: int


class PromoIn(BaseModel):
    code: str


def get_or_create_cart(db: Session, user=None, sid: str | None = None) -> Cart:
    query = db.query(Cart).filter_by(user_id=user.id) if user else db.query(Cart).filter_by(session_id=sid)
    cart = query.first()
    if not cart:
        cart = Cart(user_id=user.id if user else None, session_id=None if user else sid)
        db.add(cart)
        db.flush()
    return cart


def cart_out(cart: Cart) -> dict:
    subtotal = sum(float(item.unit_price) * item.quantity for item in cart.items)
    discount = 0
    return {
        "id": cart.id,
        "promo_code": cart.promo_code,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "variant_id": item.variant_id,
                "name": item.product.name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": float(item.unit_price) * item.quantity,
            }
            for item in cart.items
        ],
        "subtotal": subtotal,
        "discount_total": discount,
        "total": subtotal - discount,
    }


@router.get("")
def get_cart(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    return cart_out(get_or_create_cart(db, user, sid or "guest"))


@router.post("/items")
def add_item(payload: CartItemIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    cart = get_or_create_cart(db, user, sid or "guest")
    unit_price = product.discount_price or product.price
    item = db.query(CartItem).filter_by(cart_id=cart.id, product_id=payload.product_id, variant_id=payload.variant_id).first()
    if item:
        item.quantity += payload.quantity
    else:
        db.add(CartItem(cart_id=cart.id, product_id=payload.product_id, variant_id=payload.variant_id, quantity=payload.quantity, unit_price=unit_price))
    db.commit()
    db.refresh(cart)
    return cart_out(cart)


@router.put("/items/{item_id}")
def update_item(item_id: int, payload: QuantityIn, db: Session = Depends(get_db)):
    item = db.get(CartItem, item_id)
    if not item:
        raise HTTPException(404, "Cart item not found")
    item.quantity = payload.quantity
    db.commit()
    return {"detail": "Cart item updated"}


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(CartItem, item_id)
    if not item:
        raise HTTPException(404, "Cart item not found")
    db.delete(item)
    db.commit()
    return {"detail": "Cart item deleted"}


@router.post("/merge")
def merge_cart(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    guest = db.query(Cart).filter_by(session_id=sid).first()
    target = get_or_create_cart(db, user)
    if guest and guest.id != target.id:
        for item in guest.items:
            item.cart_id = target.id
        db.delete(guest)
    db.commit()
    return cart_out(target)


@router.post("/apply-promo")
def apply_promo(payload: PromoIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter_by(code=payload.code, is_active=True).first()
    if not promo:
        raise HTTPException(400, "Invalid promo code")
    cart = get_or_create_cart(db, user, sid or "guest")
    cart.promo_code = promo.code
    db.commit()
    return cart_out(cart)


@router.delete("/promo")
def remove_promo(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid or "guest")
    cart.promo_code = None
    db.commit()
    return cart_out(cart)
