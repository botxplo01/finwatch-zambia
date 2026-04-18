# =============================================================================
# FinWatch Zambia — FastAPI Dependency Injections
# Reusable dependencies injected into route handlers via Depends().
#
# Dependencies defined here:
#   get_db                — yields a per-request SQLAlchemy session
#   get_current_user      — decodes JWT and returns the User object
#   get_current_active_user — enforces is_active == True
#   get_current_admin_user  — enforces is_admin == True
#   PaginationParams      — reusable skip/limit query params
# =============================================================================

from dataclasses import dataclass
from typing import Generator

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.models.user import User

# OAuth2 scheme — tokenUrl must match the login endpoint path exactly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# =============================================================================
# Database session
# =============================================================================


def get_db() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy database session scoped to a single HTTP request.

    The session is always closed in the finally block, ensuring connections
    are returned to the pool even when exceptions occur mid-request.
    Never call db.close() manually inside a route — this dependency handles it.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================================================================
# Authentication dependencies
# =============================================================================


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and verify the JWT from the Authorization: Bearer header.

    Resolution steps:
      1. Decode and verify the JWT signature and expiry
      2. Extract the 'sub' claim (user ID)
      3. Query the database for the matching user

    Raises HTTP 401 at any step if the token is invalid, expired,
    malformed, or the referenced user no longer exists.
    """
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

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Enforce that the authenticated user's account is active.

    Deactivated accounts (is_active=False) are set by administrators
    via PATCH /api/admin/users/{id}/deactivate. This dependency ensures
    deactivated users cannot use any protected endpoint.

    Raises HTTP 403 (not 400) to clearly signal it is an authorisation
    issue rather than a bad request.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Enforce that the authenticated user holds the admin role.

    Only users with is_admin=True (set via POST /api/admin/users/{id}/promote)
    can access admin-scoped endpoints.

    Raises HTTP 403 if the user is authenticated but not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return current_user


# =============================================================================
# Pagination
# =============================================================================


@dataclass
class PaginationParams:
    """
    Reusable pagination query parameters injected via Depends().

    Usage in a route:
        @router.get("/")
        def list_items(pagination: PaginationParams = Depends()):
            return db.query(Item).offset(pagination.skip).limit(pagination.limit).all()

    Enforces:
        skip  >= 0      (non-negative offset)
        limit >= 1      (at least one record)
        limit <= 200    (cap to prevent excessive queries)
    """

    skip: int = Query(default=0, ge=0, description="Number of records to skip (offset)")
    limit: int = Query(
        default=50, ge=1, le=200, description="Maximum number of records to return"
    )
