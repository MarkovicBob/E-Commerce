from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_token(subject: str, token_type: str, minutes: int | None = None, days: int | None = None) -> str:
    # Access i refresh token koriste isti potpis, ali se razlikuju po "type" i vremenu isteka.
    expire = datetime.now(timezone.utc) + (timedelta(days=days) if days else timedelta(minutes=minutes or 30))
    return jwt.encode({"sub": subject, "type": token_type, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str = "access") -> str | None:
    # Provera tipa sprecava da se refresh token koristi kao access token na zasticenoj ruti.
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload.get("sub")


def referral_code() -> str:
    return uuid4().hex[:10].upper()
