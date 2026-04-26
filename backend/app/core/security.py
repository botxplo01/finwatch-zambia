"""
FinWatch Zambia - Security Utilities

Provides password hashing, JWT token creation/verification, and secure key generation.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create and sign a JWT access token.

    Args:
        subject: User ID (converted to string).
        expires_delta: Custom expiry duration. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Encoded JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """
    Decode and verify a JWT access token.

    Args:
        token: Raw JWT string from Authorization header.

    Returns:
        Decoded payload dict if valid, None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        logger.debug("JWT decode failed: token has expired")
        return None
    except JWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        return None


def generate_secret_key(length: int = 32) -> str:
    """
    Generate a cryptographically secure random secret key.

    Args:
        length: Number of random bytes. Default 32.

    Returns:
        Hex-encoded random string.
    """
    return secrets.token_hex(length)
