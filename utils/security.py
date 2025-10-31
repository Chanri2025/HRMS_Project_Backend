# utils/security.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe
from typing import List, Optional

import jwt
from passlib.context import CryptContext

from config import settings

# ---------------------------
# Password hashing
# ---------------------------
# Use bcrypt_sha256 to avoid bcrypt's 72-byte input limit.
# Keep "bcrypt" to verify legacy hashes stored earlier.
pwd_ctx = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
)


def hash_password(raw: str) -> str:
    """Hash password using bcrypt_sha256 (preferred)."""
    return pwd_ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    """Verify password against a stored hash (supports bcrypt_sha256 & legacy bcrypt)."""
    return pwd_ctx.verify(raw, hashed)


def needs_rehash(hashed: str) -> bool:
    """Should the stored hash be upgraded (e.g., legacy bcrypt -> bcrypt_sha256)?"""
    return pwd_ctx.needs_update(hashed)


def maybe_rehash_after_verify(raw: str, hashed: str) -> Optional[str]:
    """
    If verify succeeds and the stored hash is legacy/weaker, return an upgraded hash
    you can persist. Otherwise return None.
    """
    if verify_password(raw, hashed) and needs_rehash(hashed):
        return hash_password(raw)
    return None


# ---------------------------
# JWT helpers
# ---------------------------
ALGORITHM = "HS256"


def create_access_token(
        sub: str,
        roles: Optional[List[str]] = None,
        minutes: Optional[int] = None,
) -> str:
    """
    Create a short-lived access token.
      - sub: subject (user id as string)
      - roles: list of role strings
      - minutes: override lifetime (defaults to settings.ACCESS_MIN)
    """
    exp_minutes = minutes if minutes is not None else settings.ACCESS_MIN
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "roles": roles or [],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=exp_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode & validate an access token (raises if invalid/expired)."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


# ---------------------------
# Refresh token helpers
# ---------------------------
def make_refresh_token() -> dict:
    """
    Generate a refresh token pair:
      {"raw": <opaque-token-for-client>, "digest": <sha256-for-db>}
    """
    raw = token_urlsafe(48)
    digest = sha256(raw.encode("utf-8")).hexdigest()
    return {"raw": raw, "digest": digest}


def refresh_exp(days: Optional[int] = None) -> datetime:
    """Compute refresh token expiry (UTC)."""
    d = days if days is not None else settings.REFRESH_DAYS
    return datetime.now(timezone.utc) + timedelta(days=d)


# ---------------------------
# Role normalisation
# ---------------------------
def normalise_role(v: Optional[str]) -> Optional[str]:
    """
    Canonicalise role:
      - trim
      - spaces/underscores -> hyphens
      - uppercase
      - SUPERADMIN / SUPER_ADMIN -> SUPER-ADMIN
    """
    if not v:
        return None
    r = v.strip().replace(" ", "-").replace("_", "-").upper()
    if r in ("SUPERADMIN", "SUPER-ADMIN", "SUPER_ADMIN"):
        r = "SUPER-ADMIN"
    return r
