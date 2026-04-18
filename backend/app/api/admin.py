# =============================================================================
# FinWatch Zambia — Admin Router
#
# All endpoints require admin role (enforced via get_current_admin_user).
#
# Endpoints:
#   GET   /api/admin/users              — paginated list of all users
#   GET   /api/admin/users/{user_id}    — get any user's full profile
#   PATCH /api/admin/users/{user_id}    — update any user's details
#   POST  /api/admin/users/{user_id}/deactivate  — deactivate a user account
#   POST  /api/admin/users/{user_id}/activate    — reactivate a user account
#   POST  /api/admin/users/{user_id}/promote     — grant admin role
#   POST  /api/admin/users/{user_id}/demote      — revoke admin role
#   GET   /api/admin/stats              — system-wide statistics
# =============================================================================

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin_user, get_db
from app.models.company import Company
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.auth import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_or_404(user_id: int, db: Session) -> User:
    """Fetch any user by ID. Raises 404 if not found."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found.",
        )
    return user


# -----------------------------------------------------------------------------
# GET /api/admin/users
# -----------------------------------------------------------------------------
@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List all registered users (paginated)",
)
def list_users(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=50, ge=1, le=200, description="Max records to return"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """
    Returns a paginated list of all registered users.
    Ordered by registration date descending (newest first).
    """
    return (
        db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    )


# -----------------------------------------------------------------------------
# GET /api/admin/users/{user_id}
# -----------------------------------------------------------------------------
@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Get any user's profile by ID",
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    return _get_user_or_404(user_id, db)


# -----------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/deactivate
# -----------------------------------------------------------------------------
@router.post(
    "/users/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate a user account",
)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """
    Deactivate a user account. The user will no longer be able to log in.
    Admins cannot deactivate their own account.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )
    user = _get_user_or_404(user_id, db)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is already inactive.",
        )
    user.is_active = False
    db.commit()
    db.refresh(user)
    logger.info("Admin id=%d deactivated user id=%d", admin.id, user.id)
    return user


# -----------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/activate
# -----------------------------------------------------------------------------
@router.post(
    "/users/{user_id}/activate",
    response_model=UserResponse,
    summary="Reactivate a deactivated user account",
)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    user = _get_user_or_404(user_id, db)
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is already active.",
        )
    user.is_active = True
    db.commit()
    db.refresh(user)
    logger.info("Admin id=%d activated user id=%d", admin.id, user.id)
    return user


# -----------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/promote
# -----------------------------------------------------------------------------
@router.post(
    "/users/{user_id}/promote",
    response_model=UserResponse,
    summary="Grant admin role to a user",
)
def promote_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    user = _get_user_or_404(user_id, db)
    if user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has admin privileges.",
        )
    user.is_admin = True
    db.commit()
    db.refresh(user)
    logger.info("Admin id=%d promoted user id=%d to admin", admin.id, user.id)
    return user


# -----------------------------------------------------------------------------
# POST /api/admin/users/{user_id}/demote
# -----------------------------------------------------------------------------
@router.post(
    "/users/{user_id}/demote",
    response_model=UserResponse,
    summary="Revoke admin role from a user",
)
def demote_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """
    Revoke admin privileges. Admins cannot demote themselves.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot revoke their own admin role.",
        )
    user = _get_user_or_404(user_id, db)
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have admin privileges.",
        )
    user.is_admin = False
    db.commit()
    db.refresh(user)
    logger.info("Admin id=%d demoted user id=%d", admin.id, user.id)
    return user


# -----------------------------------------------------------------------------
# GET /api/admin/stats
# -----------------------------------------------------------------------------
@router.get(
    "/stats",
    summary="System-wide statistics for admin dashboard",
)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """
    Returns aggregate counts across the system:
    total users, active users, total companies, total predictions,
    distressed count, and healthy count.
    """
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()  # noqa: E712
    total_companies = db.query(Company).count()
    total_predictions = db.query(Prediction).count()
    distressed = (
        db.query(Prediction).filter(Prediction.risk_label == "Distressed").count()
    )
    healthy = db.query(Prediction).filter(Prediction.risk_label == "Healthy").count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_companies": total_companies,
        "total_predictions": total_predictions,
        "distressed_predictions": distressed,
        "healthy_predictions": healthy,
    }
