"""
FinWatch Zambia - FastAPI Dependency Injections

Provides database session management and authentication dependencies.
"""

from dataclasses import dataclass
from typing import Generator

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db() -> Generator[Session, None, None]:
    """Provide database session with automatic cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT token and return authenticated user, verifying session activity."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise credentials_exception

    user = db.query(User).filter(User.id == uid).first()
    if user is None:
        raise credentials_exception

    # Session revocation check (Active Session Visibility & Remote Logout)
    jti = payload.get("jti")
    if not jti:
        # Require JTI for session tracking and revocation support
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token format. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.models.user_device_session import UserDeviceSession
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc)
    
    session_exists = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.jti == jti,
            UserDeviceSession.expires_at > now
        )
        .first()
    )
    if not session_exists:
        # Session was remotely revoked, logged out, or has expired
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Update last active timestamp
    try:
        session_exists.last_active_at = now
        db.commit()
    except Exception:
        db.rollback()

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Ensure user has administrator privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return current_user


def get_current_regulator_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Ensure user has regulator portal access and correct portal_type."""
    if (
        current_user.role not in ("policy_analyst", "regulator")
        or current_user.portal_type != "institutional"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Institutional Portal access required. "
                "Your account is not authorized for this resource."
            ),
        )
    return current_user


def get_current_sme_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Ensure user has SME portal access and correct portal_type."""
    if current_user.portal_type != "sme":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "SME Portal access required. "
                "Your account is not authorized for this resource."
            ),
        )
    return current_user


def get_current_full_regulator(
    current_user: User = Depends(get_current_regulator_user),
) -> User:
    """Ensure user has full regulator access (regulator role only)."""
    if current_user.role != "regulator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Full regulator access required. "
                "Policy analyst accounts have read-only access to aggregate insights."
            ),
        )
    return current_user


@dataclass
class PaginationParams:
    """Pagination parameters for list endpoints."""

    skip: int = Query(default=0, ge=0)
    limit: int = Query(default=50, ge=1, le=200)
