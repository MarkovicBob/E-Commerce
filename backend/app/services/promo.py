from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import PromoCode


def get_valid_promo(db: Session, code: str | None) -> PromoCode | None:
    """Return the promo code only if it is active, unexpired and under its usage limit."""
    if not code:
        return None
    promo = db.query(PromoCode).filter_by(code=code, is_active=True).first()
    if not promo:
        return None
    if promo.expires_at:
        expires_at = promo.expires_at
        if expires_at.tzinfo is None:  # SQLite hands back naive datetimes
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
    if promo.usage_limit is not None and promo.times_used >= promo.usage_limit:
        return None
    return promo


def discount_for(promo: PromoCode | None, subtotal: float) -> float:
    """Discount in currency units, never negative and never more than the subtotal."""
    if not promo:
        return 0.0
    if promo.discount_amount:
        raw = float(promo.discount_amount)
    else:
        raw = subtotal * float(promo.discount_percent or 0) / 100
    return round(min(max(raw, 0.0), subtotal), 2)
