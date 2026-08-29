from fastapi import APIRouter, Depends
from sqlalchemy import false, or_
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.db.session import get_db
from app.models import PromoCode, Referral, ReferralStatus

router = APIRouter()


@router.get("/me")
def my_referrals(user=Depends(current_user), db: Session = Depends(get_db)):
    referrals = db.query(Referral).filter_by(referrer_user_id=user.id).all()
    completed = sum(1 for r in referrals if r.status == ReferralStatus.completed)
    # Only this user's own coupons: rewards earned for their referrals, plus the
    # welcome code minted for them at registration.
    reward_ids = [r.referrer_reward_code_id for r in referrals if r.referrer_reward_code_id]
    coupons = (
        db.query(PromoCode)
        .filter(
            or_(
                PromoCode.id.in_(reward_ids) if reward_ids else false(),
                PromoCode.code == f"WELCOME10-{user.referral_code}",
            )
        )
        .all()
    )
    return {
        "referral_code": user.referral_code,
        "referral_link": f"/register?ref={user.referral_code}",
        "completed_referrals": completed,
        "coupons": [
            {
                "code": coupon.code,
                "discount_percent": float(coupon.discount_percent or 0),
                "discount_amount": float(coupon.discount_amount) if coupon.discount_amount else None,
                "type": coupon.type.value,
                "is_active": coupon.is_active,
                "times_used": coupon.times_used,
                "usage_limit": coupon.usage_limit,
            }
            for coupon in coupons
        ],
    }
