from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user, current_user, optional_user, session_id
from app.api.v1.routers.cart import get_or_create_cart
from app.core.config import settings
from app.db.session import get_db
from app.models import CartItem, Order, OrderItem, OrderStatus, ProductVariant
from app.services.payment import payment_provider
from app.services.referrals import complete_referral_if_needed

router = APIRouter()


class OrderIn(BaseModel):
    shipping_address: dict
    shipping_method: str = "standard"
    payment_method: str = "card"


class StatusIn(BaseModel):
    status: OrderStatus


def order_out(order: Order) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status.value,
        "subtotal": float(order.subtotal),
        "discount_total": float(order.discount_total),
        "shipping_cost": float(order.shipping_cost),
        "total": float(order.total),
        "shipping_address": order.shipping_address,
        "payment_method": order.payment_method,
        "promo_code_used": order.promo_code_used,
        "items": [{"product_id": i.product_id, "quantity": i.quantity, "line_total": float(i.line_total)} for i in order.items],
        "created_at": order.created_at,
    }


@router.post("")
def create_order(payload: OrderIn, user=Depends(optional_user), sid: str | None = Depends(session_id), db: Session = Depends(get_db)):
    cart = get_or_create_cart(db, user, sid or "guest")
    if not cart.items:
        raise HTTPException(400, "Cart is empty")
    for item in cart.items:
        stock = item.variant.stock_quantity if item.variant else item.product.stock_quantity
        if stock < item.quantity:
            raise HTTPException(400, f"Not enough stock for {item.product.name}")
    subtotal = sum(float(item.unit_price) * item.quantity for item in cart.items)
    discount = subtotal * 0.10 if cart.promo_code else 0
    shipping_cost = settings.express_shipping_cost if payload.shipping_method == "express" else settings.standard_shipping_cost
    total = subtotal - discount + shipping_cost
    if not payment_provider.charge(total, payload.payment_method):
        raise HTTPException(400, "Payment failed")
    order = Order(
        user_id=user.id if user else None,
        order_number=f"LC-{uuid4().hex[:10].upper()}",
        status=OrderStatus.processing if payload.payment_method == "card" else OrderStatus.pending,
        subtotal=subtotal,
        discount_total=discount,
        shipping_cost=shipping_cost,
        total=total,
        shipping_address=payload.shipping_address,
        payment_method=payload.payment_method,
        promo_code_used=cart.promo_code,
    )
    db.add(order)
    db.flush()
    for item in list(cart.items):
        db.add(OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            product_name_snapshot=item.product.name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=float(item.unit_price) * item.quantity,
        ))
        if item.variant:
            item.variant.stock_quantity -= item.quantity
        item.product.stock_quantity -= item.quantity
        db.delete(item)
    cart.promo_code = None
    if user:
        complete_referral_if_needed(db, user.id)
    db.commit()
    db.refresh(order)
    return order_out(order)


@router.get("")
def my_orders(user=Depends(current_user), db: Session = Depends(get_db)):
    return [order_out(order) for order in db.query(Order).filter_by(user_id=user.id).order_by(Order.created_at.desc()).all()]


@router.get("/{order_number}")
def get_order(order_number: str, user=Depends(optional_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(order_number=order_number).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.user_id and (not user or order.user_id != user.id):
        raise HTTPException(403, "Forbidden")
    return order_out(order)
