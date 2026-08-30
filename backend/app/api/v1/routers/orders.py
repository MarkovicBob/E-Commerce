from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user, optional_user, session_id
from app.api.v1.routers.cart import available_stock, get_or_create_cart, shipping_cost_for
from app.db.session import get_db
from app.models import Order, OrderItem, OrderStatus, Product, ProductImage, ProductVariant, PromoCode
from app.services.i18n import localized
from app.services.payment import PaymentError, payment_provider
from app.services.promo import discount_for, get_valid_promo
from app.services.referrals import complete_referral_if_needed
from app.services.storage import media_url

router = APIRouter()

SHIPPING_METHODS = {"standard", "express"}
PAYMENT_METHODS = {"card", "cash_on_delivery"}
# Once an order has shipped it is out of the customer's hands.
CANCELLABLE = {OrderStatus.pending, OrderStatus.processing}


class ShippingAddressIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    street: str = Field(min_length=2, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(min_length=1, max_length=30)
    country: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=4, max_length=50)


class OrderIn(BaseModel):
    shipping_address: ShippingAddressIn
    shipping_method: str = "standard"
    payment_method: str = "card"
    contact_email: EmailStr | None = None


class StatusIn(BaseModel):
    status: OrderStatus


def lock_stock_rows(db: Session, cart) -> None:
    """
    Take row locks on everything the checkout is about to decrement.

    Without this, two simultaneous checkouts can both read the same stock, both
    pass the check and both decrement, overselling the last unit. SQLite runs
    one writer at a time so this is a no-op there; on PostgreSQL it serialises
    the two transactions. Rows are locked in id order to avoid deadlocking
    against another checkout that shares products.
    """
    product_ids = sorted({item.product_id for item in cart.items})
    variant_ids = sorted({item.variant_id for item in cart.items if item.variant_id})
    if product_ids:
        db.query(Product).filter(Product.id.in_(product_ids)).order_by(Product.id).with_for_update().all()
    if variant_ids:
        (
            db.query(ProductVariant)
            .filter(ProductVariant.id.in_(variant_ids))
            .order_by(ProductVariant.id)
            .with_for_update()
            .all()
        )
    # Refresh so the checks below see the locked values, not a stale identity map.
    for item in cart.items:
        db.refresh(item.product)
        if item.variant:
            db.refresh(item.variant)


def order_item_out(item: OrderItem, db: Session, lang: str = "sr") -> dict:
    """Order history shows the name captured at purchase time, but links to the live product."""
    product = db.get(Product, item.product_id)
    image = (
        db.query(ProductImage.image_url)
        .filter_by(product_id=item.product_id)
        .order_by(ProductImage.position)
        .first()
    )
    variant = db.get(ProductVariant, item.variant_id) if item.variant_id else None
    return {
        "id": item.id,
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "name": localized(product, lang, ("name",))["name"] if product else item.product_name_snapshot,
        "slug": product.slug if product else None,
        "image_url": media_url(image[0]) if image else None,
        "size": variant.size if variant else None,
        "color": variant.color if variant else None,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "line_total": float(item.line_total),
    }


def order_out(order: Order, db: Session, lang: str = "sr") -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status.value,
        "subtotal": float(order.subtotal),
        "discount_total": float(order.discount_total),
        "shipping_cost": float(order.shipping_cost),
        "total": float(order.total),
        "shipping_address": order.shipping_address,
        "shipping_method": order.shipping_method,
        "payment_method": order.payment_method,
        "contact_email": order.contact_email,
        "promo_code_used": order.promo_code_used,
        "can_cancel": order.status in CANCELLABLE,
        "items": [order_item_out(item, db, lang) for item in order.items],
        "item_count": sum(item.quantity for item in order.items),
        "created_at": order.created_at,
    }


@router.post("", status_code=201)
def create_order(
    payload: OrderIn,
    lang: str = "sr",
    user=Depends(optional_user),
    sid: str | None = Depends(session_id),
    db: Session = Depends(get_db),
):
    if payload.shipping_method not in SHIPPING_METHODS:
        raise HTTPException(400, "Unknown shipping method")
    if payload.payment_method not in PAYMENT_METHODS:
        raise HTTPException(400, "Unknown payment method")
    cart = get_or_create_cart(db, user, sid)
    if not cart.items:
        raise HTTPException(400, "Cart is empty")
    if not user and not payload.contact_email:
        raise HTTPException(400, "A contact email is required for guest orders")

    lock_stock_rows(db, cart)
    for item in cart.items:
        if available_stock(item.product, item.variant) < item.quantity:
            name = localized(item.product, lang, ("name",))["name"]
            raise HTTPException(400, f"Not enough stock for {name}")

    subtotal = round(sum(float(item.unit_price) * item.quantity for item in cart.items), 2)
    if cart.promo_code:
        # Lock the code too, so a limited coupon cannot be redeemed past its cap
        # by two checkouts running at the same time.
        db.query(PromoCode).filter(PromoCode.code == cart.promo_code).with_for_update().all()
    promo = get_valid_promo(db, cart.promo_code)
    discount = discount_for(promo, subtotal)
    shipping_cost = shipping_cost_for(payload.shipping_method)
    total = round(subtotal - discount + shipping_cost, 2)

    try:
        payment_provider.charge(total, payload.payment_method)
    except PaymentError as exc:
        raise HTTPException(400, str(exc)) from exc

    order = Order(
        user_id=user.id if user else None,
        order_number=f"LC-{uuid4().hex[:10].upper()}",
        # Cash on delivery is not paid yet, so it waits at pending.
        status=OrderStatus.processing if payload.payment_method == "card" else OrderStatus.pending,
        subtotal=subtotal,
        discount_total=discount,
        shipping_cost=shipping_cost,
        total=total,
        shipping_address=payload.shipping_address.model_dump(),
        shipping_method=payload.shipping_method,
        payment_method=payload.payment_method,
        contact_email=payload.contact_email or (user.email if user else None),
        promo_code_used=promo.code if promo else None,
    )
    db.add(order)
    db.flush()
    for item in list(cart.items):
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                product_name_snapshot=item.product.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=round(float(item.unit_price) * item.quantity, 2),
            )
        )
        if item.variant:
            item.variant.stock_quantity -= item.quantity
        item.product.stock_quantity -= item.quantity
        item.product.sales_count = (item.product.sales_count or 0) + item.quantity
        db.delete(item)
    if promo:
        promo.times_used += 1
    cart.promo_code = None
    if user:
        complete_referral_if_needed(db, user.id)
    db.commit()
    db.refresh(order)
    return order_out(order, db, lang)


@router.get("")
def my_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    lang: str = "sr",
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Order).filter_by(user_id=user.id)
    total = query.count()
    items = query.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [order_out(order, db, lang) for order in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{order_number}")
def get_order(
    order_number: str,
    email: str | None = None,
    lang: str = "sr",
    user=Depends(optional_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter_by(order_number=order_number).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.user_id:
        if not user or (order.user_id != user.id and user.role.value != "admin"):
            raise HTTPException(403, "Forbidden")
    elif not (user and user.role.value == "admin"):
        # A guest order is only readable by someone who knows the email it was placed with.
        if not email or not order.contact_email or email.lower() != order.contact_email.lower():
            raise HTTPException(403, "Forbidden")
    return order_out(order, db, lang)


@router.post("/{order_number}/cancel")
def cancel_order(order_number: str, lang: str = "sr", user=Depends(current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(order_number=order_number, user_id=user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status not in CANCELLABLE:
        raise HTTPException(400, "This order can no longer be cancelled")
    restock(db, order)
    order.status = OrderStatus.cancelled
    db.commit()
    db.refresh(order)
    return order_out(order, db, lang)


def restock(db: Session, order: Order) -> None:
    """Put the reserved stock back when an order is cancelled."""
    for item in order.items:
        product = db.get(Product, item.product_id)
        if product:
            product.stock_quantity += item.quantity
            product.sales_count = max(0, (product.sales_count or 0) - item.quantity)
        if item.variant_id:
            variant = db.get(ProductVariant, item.variant_id)
            if variant:
                variant.stock_quantity += item.quantity
