"""
FinWatch Zambia - Authentication Router

Endpoints:
- POST /api/auth/register - Create new user account
- POST /api/auth/login - Obtain JWT access token
- GET /api/auth/me - Get current user profile
- PUT /api/auth/me - Update current user profile
- POST /api/auth/change-password - Change password
"""

import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.models.company import Company
from app.models.ai_usage_log import AIUsageLog
from app.schemas.auth import (
    ChangePasswordRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(payload: UserCreateRequest, db: Session = Depends(get_db)):
    """Create a new user account with hashed password."""
    # Enforce invitation code for institutional roles
    if payload.role in ["policy_analyst", "regulator"]:
        if not payload.invitation_code or payload.invitation_code != settings.REGULATOR_INVITATION_CODE:
            logger.warning("Failed registration attempt: Invalid invitation code for role %s from %s", payload.role, payload.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A valid Institutional Invitation Code is required for this role."
            )

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
        role=payload.role.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: id=%d email=%s", user.id, user.email)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive a JWT access token",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with email and password, return JWT token."""
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

    from datetime import datetime
    user.last_login_at = datetime.now()
    db.commit()

    token = create_access_token(subject=user.id)
    logger.info("User logged in: id=%d email=%s", user.id, user.email)
    return {"access_token": token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user's profile",
)
def get_me(current_user: User = Depends(get_current_active_user)):
    """Return the authenticated user's profile."""
    return current_user


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
    """Update user's full name or email."""
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
    """Change user password after verifying current password."""
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


@router.post(
    "/profile-picture",
    response_model=UserResponse,
    summary="Upload a profile picture",
)
async def upload_profile_picture(
    file: UploadFile = File(...),
    original: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Save an uploaded image and update the user's profile_picture_url. Optionally saves uncropped version."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image.",
        )

    # 1. Prepare directory
    upload_dir = settings.profile_pictures_path
    
    # 2. Delete old pictures if exist
    for url in [current_user.profile_picture_url, current_user.original_profile_picture_url]:
        if url:
            old_path = upload_dir / os.path.basename(url)
            if old_path.exists():
                try:
                    os.remove(old_path)
                except Exception:
                    pass

    # 3. Save Cropped File
    file_ext = os.path.splitext(file.filename)[1]
    new_filename = f"{current_user.id}_{uuid.uuid4().hex}{file_ext}"
    file_path = upload_dir / new_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error("Failed to save cropped profile picture: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save profile picture.",
        )

    current_user.profile_picture_url = f"/static/profile_pictures/{new_filename}"

    # 4. Save Original File (if provided)
    if original:
        orig_ext = os.path.splitext(original.filename)[1]
        orig_filename = f"{current_user.id}_orig_{uuid.uuid4().hex}{orig_ext}"
        orig_path = upload_dir / orig_filename
        try:
            with open(orig_path, "wb") as buffer:
                shutil.copyfileobj(original.file, buffer)
            current_user.original_profile_picture_url = f"/static/profile_pictures/{orig_filename}"
        except Exception as e:
            logger.error("Failed to save original profile picture: %s", e)
            # We don't fail the whole request if only the original fails
    
    db.commit()
    db.refresh(current_user)
    
    logger.info("Profile picture updated for user id=%d (Original saved: %s)", current_user.id, bool(original))
    return current_user


@router.delete(
    "/profile-picture",
    response_model=UserResponse,
    summary="Remove the current profile picture",
)
def remove_profile_picture(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete both profile picture files and clear the URLs in the database."""
    if not current_user.profile_picture_url and not current_user.original_profile_picture_url:
        return current_user

    upload_dir = settings.profile_pictures_path
    
    for url in [current_user.profile_picture_url, current_user.original_profile_picture_url]:
        if url:
            filename = os.path.basename(url)
            file_path = upload_dir / filename
            if file_path.exists():
                try:
                    os.remove(file_path)
                except Exception as e:
                    logger.warning("Could not delete file %s: %s", file_path, e)

    current_user.profile_picture_url = None
    current_user.original_profile_picture_url = None
    db.commit()
    db.refresh(current_user)
    
    logger.info("Profile pictures removed for user id=%d", current_user.id)
    return current_user


@router.delete(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Permanently delete the current user's account",
)
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Irreversibly delete the authenticated user's account and all associated data.
    Leverages cascading deletes in the database and ORM relationships.
    """
    user_id = current_user.id
    email = current_user.email
    
    try:
        # Surgical deletion: Ensure all companies (and their cascades) are handled
        # and all AI logs are handled before removing the user record.
        # This helps avoid constraint issues on some DB engines.
        db.query(Company).filter(Company.owner_id == user_id).delete(synchronize_session=False)
        db.query(AIUsageLog).filter(AIUsageLog.user_id == user_id).delete(synchronize_session=False)
        
        db.delete(current_user)
        db.commit()
        
        logger.warning("Account DELETED: id=%d email=%s", user_id, email)
        return {"detail": "Account and all associated data have been permanently deleted."}
    except Exception as exc:
        db.rollback()
        logger.error("CRITICAL: Failed to delete account id=%d: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting your account. Error: {str(exc)}"
        )
