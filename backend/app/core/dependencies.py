"""
FinWatch Zambia - API Dependencies

Shared FastAPI dependencies including database sessions and security checks.
"""

import logging
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

# Standard OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db() -> Generator[Session, None, None]:
    """Provide a database session to the request and close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """Validate JWT token and return the current user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 1. Decode token
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        jti: str = payload.get("jti")

        if user_id is None:
            raise credentials_exception

        # 2. Check blacklist (using jti)
        # Note: In a production system, we'd check a Redis cache or DB here.
        # For this MVP, we assume tokens are valid until expiry.
    except JWTError as e:
        logger.error(f"JWT Decode Error: {e}")
        raise credentials_exception

    # 3. Fetch user from DB
    user = db.query(User).filter(User.id == int(user_id)).first()

    if user is None:
        raise credentials_exception

    # 4. Role/Portal validation happens in downstream dependencies
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Ensure the current user is an administrator."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user


def get_current_institutional_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Ensure user has institutional portal access and correct portal_type."""
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


def get_current_full_institutional(
    current_user: User = Depends(get_current_institutional_user),
) -> User:
    """Ensure user has full institutional access (regulator role only)."""
    if current_user.role != "regulator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Full institutional access required. "
                "Policy analyst accounts have read-only access to aggregate insights."
            ),
        )
    return current_user
