# =============================================================================
# FinWatch Zambia — Authentication Router
#
# Endpoints:
#   POST /api/auth/register          — create a new user account
#   POST /api/auth/login             — obtain a JWT access token
#   GET  /api/auth/me                — get current user profile
#   PUT  /api/auth/me                — update current user profile
#   POST /api/auth/change-password   — change password (requires current password)
# =============================================================================

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# -----------------------------------------------------------------------------
# POST /api/auth/register
# -----------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(payload: UserCreateRequest, db: Session = Depends(get_db)):
    """
    Create a new FinWatch Zambia user account.

    - Email must be unique across all accounts.
    - Password is hashed with bcrypt before storage — plaintext is never persisted.
    - Returns the created user profile (no password field).
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: id=%d email=%s", user.id, user.email)
    return user


# -----------------------------------------------------------------------------
# POST /api/auth/login
# -----------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive a JWT access token",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticate with email (username field) and password.

    Returns a signed JWT Bearer token valid for the duration set in
    ACCESS_TOKEN_EXPIRE_MINUTES. Include this token in subsequent requests
    as: Authorization: Bearer <token>
    """
    # Normalise email to lowercase to match stored value
    email = form_data.username.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated. Contact an administrator.",
        )

    token = create_access_token(subject=user.id)
    logger.info("User logged in: id=%d email=%s", user.id, user.email)
    return {"access_token": token, "token_type": "bearer"}


# -----------------------------------------------------------------------------
# GET /api/auth/me
# -----------------------------------------------------------------------------
@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user's profile",
)
def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Returns the full profile of the currently authenticated user.
    Requires a valid Bearer token in the Authorization header.
    """
    return current_user


# -----------------------------------------------------------------------------
# PUT /api/auth/me
# -----------------------------------------------------------------------------
@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update the current user's profile",
)
def update_me(
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update the authenticated user's full name or email.

    - If email is changed, uniqueness is re-validated.
    - Only fields explicitly provided in the request body are updated.
    """
    updates = payload.model_dump(exclude_unset=True)

    if "email" in updates:
        new_email = updates["email"].lower().strip()
        if new_email != current_user.email:
            conflict = db.query(User).filter(User.email == new_email).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already in use by another account.",
                )
        updates["email"] = new_email

    if "full_name" in updates:
        updates["full_name"] = updates["full_name"].strip()

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


# -----------------------------------------------------------------------------
# POST /api/auth/change-password
# -----------------------------------------------------------------------------
@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change the current user's password",
)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Change password for the authenticated user.

    - Requires the current password for verification.
    - New password must meet minimum length requirements (validated in schema).
    - On success, all existing tokens remain valid — frontend should prompt
      re-login for security-conscious flows.
    """
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password.",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    logger.info("Password changed for user id=%d", current_user.id)
    return {"detail": "Password updated successfully."}
