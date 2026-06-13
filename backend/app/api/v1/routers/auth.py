from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.core.config import settings
from app.core.security import create_token, decode_token, hash_password, referral_code, verify_password
from app.db.session import get_db
from app.models import PromoCode, PromoType, Referral, User

router = APIRouter()


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    referral_code: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class PasswordIn(BaseModel):
    email: EmailStr
    token: str | None = None
    new_password: str | None = None


def user_out(user: User) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role.value, "referral_code": user.referral_code}


def tokens(user: User) -> dict:
    return {
        "access_token": create_token(str(user.id), "access", minutes=settings.access_token_expire_minutes),
        "refresh_token": create_token(str(user.id), "refresh", days=settings.refresh_token_expire_days),
        "token_type": "bearer",
        "user": user_out(user),
    }


@router.post("/register")
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(400, "Email already registered")
    referrer = db.query(User).filter_by(referral_code=payload.referral_code).first() if payload.referral_code else None
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        referral_code=referral_code(),
        referred_by_user_id=referrer.id if referrer else None,
    )
    db.add(user)
    db.flush()
    if referrer:
        db.add(Referral(referrer_user_id=referrer.id, referred_user_id=user.id))
        db.add(PromoCode(code=f"WELCOME10-{user.referral_code}", discount_percent=10, type=PromoType.referral_referee, usage_limit=1))
    db.commit()
    result = tokens(user)
    response.set_cookie("refresh_token", result["refresh_token"], httponly=True, samesite="lax")
    return result


@router.post("/login")
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    result = tokens(user)
    response.set_cookie("refresh_token", result["refresh_token"], httponly=True, samesite="lax")
    return result


@router.post("/refresh")
def refresh(payload: RefreshIn, response: Response, db: Session = Depends(get_db)):
    subject = decode_token(payload.refresh_token or "", "refresh")
    if not subject:
        raise HTTPException(401, "Invalid refresh token")
    user = db.get(User, int(subject))
    if not user:
        raise HTTPException(401, "Invalid refresh token")
    result = tokens(user)
    response.set_cookie("refresh_token", result["refresh_token"], httponly=True, samesite="lax")
    return result


@router.post("/google")
def google_placeholder():
    return {"detail": "Google OAuth placeholder"}


@router.post("/forgot-password")
def forgot_password(payload: PasswordIn):
    return {"detail": f"Password reset token would be sent to {payload.email}"}


@router.post("/reset-password")
def reset_password(payload: PasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email).first()
    if user and payload.new_password:
        user.hashed_password = hash_password(payload.new_password)
        db.commit()
    return {"detail": "Password reset completed"}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)
