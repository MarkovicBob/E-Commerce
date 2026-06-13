from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import PromoCode, PromoType, Referral, ReferralStatus


def make_referral_coupon(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:8].upper()}"


def complete_referral_if_needed(db: Session, referred_user_id: int) -> None:
    referral = db.query(Referral).filter_by(referred_user_id=referred_user_id, status=ReferralStatus.pending).first()
    if not referral:
        return
    code = PromoCode(
        code=make_referral_coupon("THANKS10"),
        discount_percent=10,
        type=PromoType.referral_referrer,
        usage_limit=1,
    )
    db.add(code)
    db.flush()
    referral.status = ReferralStatus.completed
    referral.referrer_reward_code_id = code.id
