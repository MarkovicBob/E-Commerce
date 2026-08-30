from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.core.config import settings
from app.core.security import create_token, decode_token, hash_password, referral_code, verify_password
from app.db.session import get_db
from app.models import PromoCode, PromoType, Referral, User

router = APIRouter()

RESET_TOKEN_MINUTES = 30


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    referral_code: str | None = None

    @field_validator("password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if value.isalpha() or value.isdigit():
            raise ValueError("Password must mix letters and numbers")
        return value


class ProfileIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=50)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


def user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role.value,
        "referral_code": user.referral_code,
        "created_at": user.created_at,
    }


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
    )


def tokens(user: User) -> dict:
    return {
        "access_token": create_token(str(user.id), "access", minutes=settings.access_token_expire_minutes),
        "refresh_token": create_token(str(user.id), "refresh", days=settings.refresh_token_expire_days),
        "token_type": "bearer",
        "user": user_out(user),
    }


@router.post("/register")
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(400, "Email already registered")
    referrer = (
        db.query(User).filter_by(referral_code=payload.referral_code.strip().upper()).first()
        if payload.referral_code
        else None
    )
    user = User(
        email=email,
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
    set_refresh_cookie(response, result["refresh_token"])
    return result


@router.post("/login")
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    result = tokens(user)
    set_refresh_cookie(response, result["refresh_token"])
    return result


@router.post("/refresh")
def refresh(payload: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    # Fall back to the httpOnly cookie set at login, which the client cannot read itself.
    token = payload.refresh_token or request.cookies.get("refresh_token") or ""
    subject = decode_token(token, "refresh")
    if not subject or not subject.isdigit():
        raise HTTPException(401, "Invalid refresh token")
    user = db.get(User, int(subject))
    if not user:
        raise HTTPException(401, "Invalid refresh token")
    result = tokens(user)
    set_refresh_cookie(response, result["refresh_token"])
    return result


@router.post("/google")
def google_placeholder():
    return {"detail": "Google OAuth placeholder"}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email.lower()).first()
    response = {"detail": "If the account exists, a reset link has been sent"}
    if not user:
        # Same response either way so the endpoint cannot be used to enumerate accounts.
        return response
    token = create_token(str(user.id), "reset", minutes=RESET_TOKEN_MINUTES)
    if settings.expose_reset_token:
        response["reset_token"] = token
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    subject = decode_token(payload.token, "reset")
    if not subject or not subject.isdigit():
        raise HTTPException(400, "Invalid or expired reset token")
    user = db.get(User, int(subject))
    if not user:
        raise HTTPException(400, "Invalid or expired reset token")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password reset completed"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"detail": "Logged out"}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.put("/me")
def update_profile(payload: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.full_name = payload.full_name
    user.phone = payload.phone
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.put("/me/password")
def change_password(payload: ChangePasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated"}
