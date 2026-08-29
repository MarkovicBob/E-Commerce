from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import optional_user, session_id
from app.db.session import get_db
from app.models import Cart, CartItem, Product
from app.services.promo import discount_for, get_valid_promo

router = APIRouter()


class CartItemIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=99)


class QuantityIn(BaseModel):
    quantity: int = Field(ge=1, le=99)


class PromoIn(BaseModel):
    code: str


def get_or_create_cart(db: Session, user=None, sid: str | None = None) -> Cart:
    """Resolve the cart for a logged-in user, or for a guest identified by X-Session-Id."""
    if user:
        query = db.query(Cart).filter(Cart.user_id == user.id)
    else:
        if not sid:
            # Without a session id every guest would otherwise share a single cart.
            raise HTTPException(400, "Missing X-Session-Id header for guest cart")
        query = db.query(Cart).filter(Cart.user_id.is_(None), Cart.session_id == sid)
    cart = query.first()
    if not cart:
        cart = Cart(user_id=user.id if user else None, session_id=None if user else sid)
        db.add(cart)
        db.flush()
    return cart


def owned_item(db: Session, item_id: int, cart: Cart) -> CartItem:
    """Load a cart item, ensuring it belongs to the caller's own cart."""
    item = db.get(CartItem, item_id)
    if not item or item.cart_id != cart.id:
        raise HTTPException(404, "Cart item not found")
    return item


def cart_out(cart: Cart, db: Session) -> dict:
    subtotal = round(sum(float(item.unit_price) * item.quantity for item in cart.items), 2)
    promo = get_valid_promo(db, cart.promo_code)
    discount = discount_for(promo, subtotal)
    return {
        "id": cart.id,
        "promo_code": promo.code if promo else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "variant_id": item.variant_id,
                "name": item.product.name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": round(float(item.unit_price) * item.quantity, 2),
            }
            for item in cart.items
        ],
        "subtotal": subtotal,
        "discount_total": discount,
        "total": round(subtotal - discount, 2),
    }


@router.get("")
def get_cart(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid)
    db.commit()
    return cart_out(cart, db)


@router.post("/items")
def add_item(payload: CartItemIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    cart = get_or_create_cart(db, user, sid)
    unit_price = product.discount_price or product.price
    item = db.query(CartItem).filter_by(cart_id=cart.id, product_id=payload.product_id, variant_id=payload.variant_id).first()
    if item:
        item.quantity = min(item.quantity + payload.quantity, 99)
    else:
        db.add(CartItem(cart_id=cart.id, product_id=payload.product_id, variant_id=payload.variant_id, quantity=payload.quantity, unit_price=unit_price))
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db)


@router.put("/items/{item_id}")
def update_item(item_id: int, payload: QuantityIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid)
    item = owned_item(db, item_id, cart)
    item.quantity = payload.quantity
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid)
    item = owned_item(db, item_id, cart)
    db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db)


@router.post("/merge")
def merge_cart(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    target = get_or_create_cart(db, user)
    if sid:
        guest = db.query(Cart).filter(Cart.user_id.is_(None), Cart.session_id == sid).first()
        if guest and guest.id != target.id:
            existing = {(item.product_id, item.variant_id): item for item in target.items}
            for item in list(guest.items):
                match = existing.get((item.product_id, item.variant_id))
                if match:
                    match.quantity = min(match.quantity + item.quantity, 99)
                    db.delete(item)
                else:
                    item.cart_id = target.id
            db.flush()
            db.delete(guest)
    db.commit()
    db.refresh(target)
    return cart_out(target, db)


@router.post("/apply-promo")
def apply_promo(payload: PromoIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    promo = get_valid_promo(db, payload.code)
    if not promo:
        raise HTTPException(400, "Invalid or expired promo code")
    cart = get_or_create_cart(db, user, sid)
    cart.promo_code = promo.code
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db)


@router.delete("/promo")
def remove_promo(user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid)
    cart.promo_code = None
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db)
