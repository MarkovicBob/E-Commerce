from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import optional_user, session_id
from app.core.config import settings
from app.db.session import get_db
from app.models import Cart, CartItem, Product, ProductStatus, ProductVariant
from app.services.i18n import localized
from app.services.promo import discount_for, get_valid_promo
from app.services.storage import media_url

router = APIRouter()

MAX_QUANTITY = 99


class CartItemIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=MAX_QUANTITY)


class QuantityIn(BaseModel):
    quantity: int = Field(ge=1, le=MAX_QUANTITY)


class PromoIn(BaseModel):
    code: str


def unit_price_for(product: Product, variant: ProductVariant | None) -> float:
    """Sale price when there is one, plus whatever the chosen variant adds on top."""
    base = float(product.discount_price if product.discount_price is not None else product.price)
    extra = float(variant.extra_price or 0) if variant else 0.0
    return round(base + extra, 2)


def available_stock(product: Product, variant: ProductVariant | None) -> int:
    """A variant is drawn from the product's stock, so the tighter of the two wins."""
    if variant:
        return min(product.stock_quantity, variant.stock_quantity)
    return product.stock_quantity


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


def item_out(item: CartItem, lang: str = "sr") -> dict:
    images = sorted(item.product.images, key=lambda i: i.position)
    stock = available_stock(item.product, item.variant)
    return {
        "id": item.id,
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "name": localized(item.product, lang, ("name",))["name"],
        "slug": item.product.slug,
        "brand": item.product.brand,
        "image_url": media_url(images[0].image_url) if images else None,
        "size": item.variant.size if item.variant else None,
        "color": item.variant.color if item.variant else None,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "line_total": round(float(item.unit_price) * item.quantity, 2),
        "stock_quantity": stock,
        # The UI greys out the row instead of failing only at checkout.
        "in_stock": stock >= item.quantity,
    }


def cart_out(cart: Cart, db: Session, shipping_method: str = "standard", lang: str = "sr") -> dict:
    items = [item_out(item, lang) for item in cart.items]
    subtotal = round(sum(item["line_total"] for item in items), 2)
    promo = get_valid_promo(db, cart.promo_code)
    discount = discount_for(promo, subtotal)
    shipping = shipping_cost_for(shipping_method) if items else 0.0
    return {
        "id": cart.id,
        "promo_code": promo.code if promo else None,
        "promo_invalid": bool(cart.promo_code and not promo),
        "items": items,
        "item_count": sum(item["quantity"] for item in items),
        "subtotal": subtotal,
        "discount_total": discount,
        "shipping_cost": shipping,
        "shipping_method": shipping_method,
        "total": round(subtotal - discount + shipping, 2),
        "has_stock_issue": any(not item["in_stock"] for item in items),
    }


def shipping_cost_for(method: str) -> float:
    return float(settings.express_shipping_cost if method == "express" else settings.standard_shipping_cost)


def resolve_variant(db: Session, product: Product, variant_id: int | None) -> ProductVariant | None:
    if variant_id is None:
        return None
    variant = db.get(ProductVariant, variant_id)
    if not variant or variant.product_id != product.id:
        raise HTTPException(400, "Variant does not belong to this product")
    return variant


@router.get("")
def get_cart(
    shipping_method: str = "standard",
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(db, user, sid)
    db.commit()
    return cart_out(cart, db, shipping_method, lang)


@router.post("/items")
def add_item(
    payload: CartItemIn,
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    product = db.get(Product, payload.product_id)
    if not product or product.status != ProductStatus.active:
        raise HTTPException(404, "Product not found")
    variant = resolve_variant(db, product, payload.variant_id)
    # A product with variants must be added as one, or stock would come off the wrong row.
    if product.variants and variant is None:
        raise HTTPException(400, "Choose a variant before adding this product to the cart")
    cart = get_or_create_cart(db, user, sid)
    item = db.query(CartItem).filter_by(cart_id=cart.id, product_id=payload.product_id, variant_id=payload.variant_id).first()
    wanted = (item.quantity if item else 0) + payload.quantity
    stock = available_stock(product, variant)
    if stock <= 0:
        raise HTTPException(400, "Product is out of stock")
    if wanted > stock:
        raise HTTPException(400, f"Only {stock} left in stock")
    if item:
        item.quantity = min(wanted, MAX_QUANTITY)
        # Re-price on every add so a sale that started since is picked up.
        item.unit_price = unit_price_for(product, variant)
    else:
        db.add(
            CartItem(
                cart_id=cart.id,
                product_id=payload.product_id,
                variant_id=payload.variant_id,
                quantity=min(wanted, MAX_QUANTITY),
                unit_price=unit_price_for(product, variant),
            )
        )
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)


@router.put("/items/{item_id}")
def update_item(
    item_id: int,
    payload: QuantityIn,
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(db, user, sid)
    item = owned_item(db, item_id, cart)
    stock = available_stock(item.product, item.variant)
    if payload.quantity > stock:
        raise HTTPException(400, f"Only {stock} left in stock")
    item.quantity = payload.quantity
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(db, user, sid)
    item = owned_item(db, item_id, cart)
    db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)


@router.delete("/items")
def clear_cart(
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(db, user, sid)
    for item in list(cart.items):
        db.delete(item)
    cart.promo_code = None
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)


@router.post("/merge")
def merge_cart(
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
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
                    stock = available_stock(match.product, match.variant)
                    match.quantity = min(match.quantity + item.quantity, MAX_QUANTITY, max(stock, 1))
                else:
                    # Copy rather than re-parent: `Cart.items` is delete-orphan, so an item
                    # left in the guest collection is deleted with the guest cart even after
                    # its cart_id has been pointed at the target.
                    db.add(
                        CartItem(
                            cart_id=target.id,
                            product_id=item.product_id,
                            variant_id=item.variant_id,
                            quantity=item.quantity,
                            unit_price=item.unit_price,
                        )
                    )
            # Carry the guest's promo over when the user's cart has none of its own.
            if guest.promo_code and not target.promo_code:
                target.promo_code = guest.promo_code
            db.flush()
            db.delete(guest)
    db.commit()
    db.refresh(target)
    return cart_out(target, db, lang=lang)


@router.post("/apply-promo")
def apply_promo(
    payload: PromoIn,
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    promo = get_valid_promo(db, payload.code.strip())
    if not promo:
        raise HTTPException(400, "Invalid or expired promo code")
    cart = get_or_create_cart(db, user, sid)
    cart.promo_code = promo.code
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)


@router.delete("/promo")
def remove_promo(
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(db, user, sid)
    cart.promo_code = None
    db.commit()
    db.refresh(cart)
    return cart_out(cart, db, lang=lang)
