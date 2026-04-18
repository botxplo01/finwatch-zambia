# =============================================================================
# FinWatch Zambia — Security Utilities
#
# Provides:
#   hash_password()        — bcrypt hash a plain-text password
#   verify_password()      — verify plain-text against bcrypt hash
#   create_access_token()  — sign and encode a JWT access token
#   decode_access_token()  — verify and decode a JWT, returns payload or None
#   generate_secret_key()  — generate a cryptographically secure random key
# =============================================================================

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bcrypt hashing context — bcrypt is intentionally slow, making brute-force
# attacks computationally expensive. deprecated="auto" future-proofs the
# context if the default scheme ever changes.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =============================================================================
# Password utilities
# =============================================================================


def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password using bcrypt.

    The resulting hash includes the salt — no separate salt storage needed.
    Never store or log plain_password anywhere in the application.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a stored bcrypt hash.

    Returns True if the password matches, False otherwise.
    Constant-time comparison is handled internally by passlib/bcrypt
    to prevent timing attacks.
    """
    return pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# JWT utilities
# =============================================================================


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create and sign a JWT access token.

    Payload claims:
      sub — subject (user ID as string)
      exp — expiry timestamp (UTC)
      iat — issued-at timestamp (UTC)

    Args:
        subject:       The token subject, typically the user's integer ID.
                       Converted to string automatically.
        expires_delta: Custom expiry duration. Defaults to
                       settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Encoded JWT string ready to be returned as the access_token.
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

    Verification checks performed by python-jose:
      - Signature validity (using SECRET_KEY)
      - Token expiry (exp claim)
      - Algorithm match

    Args:
        token: The raw JWT string extracted from the Authorization header.

    Returns:
        Decoded payload dict if the token is valid and unexpired.
        None if the token is invalid, expired, or malformed.
        Callers (get_current_user) treat None as a 401 Unauthorized.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        # Token was valid but has expired — common during normal operation,
        # log at DEBUG to avoid noise in production logs.
        logger.debug("JWT decode failed: token has expired")
        return None
    except JWTError as exc:
        # Covers malformed tokens, invalid signatures, wrong algorithm, etc.
        logger.warning("JWT decode failed: %s", exc)
        return None


# =============================================================================
# Key generation utility
# =============================================================================


def generate_secret_key(length: int = 32) -> str:
    """
    Generate a cryptographically secure random secret key.

    Uses Python's secrets module which is backed by the OS CSPRNG.
    The output is a hex string of 2 * length characters.

    Args:
        length: Number of random bytes. Default 32 → 64-character hex string.

    Returns:
        Hex-encoded random string suitable for use as SECRET_KEY.

    Usage (from terminal):
        python -c "from app.core.security import generate_secret_key; print(generate_secret_key())"
    """
    return secrets.token_hex(length)
