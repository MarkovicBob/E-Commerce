from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User, UserRole

CREDENTIALS_HEADERS = {"WWW-Authenticate": "Bearer"}


def unauthorized(detail: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers=CREDENTIALS_HEADERS)


def optional_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User | None:
    """
    The caller's account, or None for a genuine guest.

    A *missing* Authorization header means a guest. A header that is present but
    unusable (expired, tampered with, or pointing at a deleted account) is an
    error, not a guest: answering 200 would silently move a signed-in shopper's
    cart into an anonymous one and rob the client of the 401 it refreshes on.
    """
    if authorization is None:
        return None
    if not authorization.startswith("Bearer "):
        raise unauthorized("Authorization header must use the Bearer scheme")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise unauthorized("Bearer token is empty")

    subject = decode_token(token)
    if not subject or not subject.isdigit():
        raise unauthorized()

    user = db.get(User, int(subject))
    if not user:
        raise unauthorized("Account no longer exists")
    return user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise unauthorized("Not authenticated")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


def session_id(request: Request) -> str | None:
    return request.headers.get("X-Session-Id") or request.cookies.get("session_id")
