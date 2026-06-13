from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.db.session import get_db
from app.models import PromoCode, PromoType, Referral, ReferralStatus

router = APIRouter()


@router.get("/me")
def my_referrals(user=Depends(current_user), db: Session = Depends(get_db)):
    completed = db.query(Referral).filter_by(referrer_user_id=user.id, status=ReferralStatus.completed).count()
    coupons = db.query(PromoCode).filter(PromoCode.type.in_([PromoType.referral_referee, PromoType.referral_referrer])).all()
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
