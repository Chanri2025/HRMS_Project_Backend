from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
import os
from config import settings
from secrets import token_urlsafe
from hashlib import sha256

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd_ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_ctx.verify(raw, hashed)


def create_access_token(
    sub: str, roles: list[str] | None = None, minutes: int | None = None
) -> str:
    exp_minutes = minutes if minutes is not None else settings.ACCESS_MIN
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "roles": roles or [],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def make_refresh_token() -> dict:
    raw = token_urlsafe(48)
    digest = sha256(raw.encode("utf-8")).hexdigest()
    return {"raw": raw, "digest": digest}


def refresh_exp(days: int | None = None) -> datetime:
    d = days if days is not None else settings.REFRESH_DAYS
    return datetime.now(timezone.utc) + timedelta(days=d)


def normalise_role(v: str | None) -> str | None:
    if not v:
        return None
    r = v.strip().replace(" ", "-").replace("_", "-").upper()
    if r in ("SUPERADMIN", "SUPER_ADMIN"):
        r = "SUPER-ADMIN"
    return r
