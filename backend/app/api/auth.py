"""
FinWatch Zambia - Authentication Router

Endpoints:
- POST /api/auth/register - Create new user account
- POST /api/auth/login - Obtain JWT access token
- GET /api/auth/me - Get current user profile
- PUT /api/auth/me - Update current user profile
- POST /api/auth/change-password - Change password
"""

import json
import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.models.ai_usage_log import AIUsageLog
from app.models.company import Company
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailCheckRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
    VerificationInitiatedResponse,
    VerifyOTPRequest,
)
from app.services import email_service, verification_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/check-email",
    dependencies=[Depends(rate_limit)],
    summary="Check if an email address is already registered",
)
def check_email(payload: EmailCheckRequest, db: Session = Depends(get_db)):
    """Return 200 OK if email is available (no active user exists), otherwise 400."""
    existing = (
        db.query(User)
        .filter(
            User.email == payload.email.lower().strip(),
            User.portal_type == payload.portal_type,
            User.is_active == True,  # Fix: Only block if an ACTIVE user exists
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with that email already exists in this portal. Please log in.",
        )
    return {"detail": "Email is available."}


@router.post(
    "/register",
    response_model=VerificationInitiatedResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit)],
    summary="Initiate registration and send verification code",
)
def register(payload: UserCreateRequest, db: Session = Depends(get_db)):
    """Initiate registration flow. Does NOT create a User record yet."""
    # Enforce invitation code for institutional roles
    if payload.role in ["policy_analyst", "regulator"]:
        if (
            not payload.invitation_code
            or payload.invitation_code != settings.REGULATOR_INVITATION_CODE
        ):
            logger.warning(
                "Failed registration attempt: Invalid invitation code for role %s from %s",
                payload.role,
                payload.email,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A valid Institutional Invitation Code is required for this role.",
            )

    email = payload.email.lower().strip()

    # Only block if an ACTIVE account exists
    existing = (
        db.query(User)
        .filter(
            User.email == email,
            User.portal_type == payload.portal_type,
            User.is_active == True,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with that email already exists in this portal. Please log in.",
        )

    # Serialize registration data to store in the verification session
    signup_payload = json.dumps(payload.model_dump())

    # Initiate verification
    try:
        raw_code, expiry = verification_service.initiate_verification(
            db, email, payload.portal_type, signup_payload=signup_payload
        )

        # Send branded email
        sent = email_service.send_verification_email(
            email, raw_code, payload.portal_type
        )

        if not sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email delivery failed (Port 587/465 blocked on cloud). Please configure EMAIL_BRIDGE_URL in backend settings.",
            )

        return {
            "detail": "Verification code sent to your email.",
            "email": email,
            "portal_type": payload.portal_type,
            "expires_at": expiry,
        }
    except ValueError as e:
        if str(e) == "COOLDOWN_ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many resend attempts. Please wait 1 hour.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate verification.",
        )


@router.post(
    "/login",
    response_model=VerificationInitiatedResponse,
    dependencies=[Depends(rate_limit)],
    summary="Initiate login and send verification code",
)
def login(
    portal_type: str = "sme",
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with credentials, then initiate verification step."""
    email = form_data.username.lower().strip()
    user = (
        db.query(User)
        .filter(User.email == email, User.portal_type == portal_type)
        .first()
    )

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact an administrator.",
        )

    try:
        raw_code, expiry = verification_service.initiate_verification(
            db, email, portal_type, user_id=user.id
        )

        # Send branded email
        sent = email_service.send_verification_email(email, raw_code, portal_type)

        if not sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email delivery failed (Port 587/465 blocked on cloud). Please configure EMAIL_BRIDGE_URL in backend settings.",
            )

        return {
            "detail": "Verification code sent to your email.",
            "email": email,
            "portal_type": portal_type,
            "expires_at": expiry,
        }
    except ValueError as e:
        if str(e) == "COOLDOWN_ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many resend attempts. Please wait 1 hour.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate verification.",
        )


@router.post(
    "/verify",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit)],
    summary="Verify OTP and receive JWT access token",
)
def verify(
    payload: VerifyOTPRequest,
    long_session: bool = False,
    db: Session = Depends(get_db),
):
    """Verify OTP and finalize user creation (if signup) or session (if login)."""
    try:
        # 1. Validate the OTP and get session
        session_record = verification_service.verify_otp_and_get_session(
            db, payload.email, payload.portal_type, payload.code
        )

        user = None

        # 2. Finalize Signup or Login
        if session_record.signup_payload:
            # SIGNUP FLOW: Create the user now
            data = json.loads(session_record.signup_payload)

            # Final check to ensure email didn't get taken during the 5 min window
            existing = (
                db.query(User)
                .filter(
                    User.email == session_record.email,
                    User.portal_type == session_record.portal_type,
                    User.is_active == True,
                )
                .first()
            )

            if existing:
                # This should be extremely rare but handles race conditions
                db.delete(session_record)
                db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="Account was created by another session. Please login.",
                )

            user = User(
                full_name=data["full_name"].strip(),
                title=data.get("title").strip() if data.get("title") else None,
                email=session_record.email,
                hashed_password=data[
                    "password"
                ],  # Note: register() should hash before storing in payload?
                # Actually, register() payload has the raw password usually if we model_dump the request.
                # Let's check: payload was UserCreateRequest.
                # Re-hash or ensure hashed.
                portal_type=session_record.portal_type,
                role=data["role"],
                business_scale=data.get("business_scale"),
                is_active=True,
            )
            # Check if password needs hashing (if stored raw in JSON)
            if not user.hashed_password.startswith("$2b$"):
                user.hashed_password = hash_password(user.hashed_password)

            db.add(user)
            db.flush()  # Get user.id
            logger.info("New User finalized after verification: %s", user.email)

        elif session_record.user_id:
            # LOGIN FLOW: Find the existing user
            user = db.query(User).filter(User.id == session_record.user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User session lost.")

        if not user:
            raise HTTPException(
                status_code=500, detail="Authentication finalization failed."
            )

        # 3. Clean up the verification session
        db.delete(session_record)

        # 4. Finalize login stats
        from datetime import datetime, timedelta

        user.last_login_at = datetime.now()
        db.commit()
        db.refresh(user)

        # 5. Issue JWT
        expires_delta = None
        if long_session:
            expires_delta = timedelta(minutes=settings.LONG_SESSION_EXPIRE_MINUTES)

        token = create_access_token(
            subject=user.id,
            expires_delta=expires_delta,
            business_scale=user.business_scale,
        )

        logger.info(
            "User authenticated successfully: id=%d email=%s portal=%s",
            user.id,
            user.email,
            user.portal_type,
        )
        return {"access_token": token, "token_type": "bearer"}

    except ValueError as e:
        error_msg = str(e)
        if error_msg == "NO_SESSION":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active verification session found.",
            )
        if error_msg == "CODE_EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired.",
            )
        if error_msg == "TOO_MANY_ATTEMPTS":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please resend a new code.",
            )
        if error_msg == "INVALID_CODE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Verification failed.",
        )


@router.post(
    "/resend-verification",
    response_model=VerificationInitiatedResponse,
    dependencies=[Depends(rate_limit)],
    summary="Resend verification code",
)
def resend_verification(email: str, portal_type: str, db: Session = Depends(get_db)):
    """Resend the 5-digit OTP with rate limiting and cooldowns."""
    try:
        raw_code, expiry = verification_service.initiate_verification(
            db, email, portal_type
        )

        # Send branded email
        sent = email_service.send_verification_email(email, raw_code, portal_type)

        if not sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email delivery failed (Port 587/465 blocked on cloud). Please configure EMAIL_BRIDGE_URL in backend settings.",
            )

        return {
            "detail": "A new verification code has been sent to your email.",
            "email": email,
            "portal_type": portal_type,
            "expires_at": expiry,
        }
    except ValueError as e:
        if str(e) == "COOLDOWN_ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many resend attempts. Please wait 1 hour.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification.",
        )


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
            conflict = (
                db.query(User)
                .filter(
                    User.email == new_email,
                    User.portal_type == current_user.portal_type,
                    User.is_active == True,
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already in use by another active account.",
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
    dependencies=[Depends(rate_limit)],
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
def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Upload and set profile picture."""
    # Ensure directory exists
    profile_path = settings.profile_pictures_path
    profile_path.mkdir(parents=True, exist_ok=True)

    # Security check: only image files
    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload an image (JPG, PNG, WebP, SVG).",
        )

    # Generate unique filename to avoid collisions
    filename = f"user_{current_user.id}_{uuid.uuid4().hex}{ext}"
    dest_path = profile_path / filename

    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        logger.error(
            "Profile picture upload failed for user_id=%d: %s", current_user.id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save profile picture.",
        )

    # Update database
    old_pic = current_user.profile_picture_url
    current_user.profile_picture_url = f"/static/profile_pictures/{filename}"
    db.commit()
    db.refresh(current_user)

    # Cleanup old picture if it exists
    if old_pic and "/static/profile_pictures/" in old_pic:
        try:
            old_filename = old_pic.split("/")[-1]
            old_path = profile_path / old_filename
            if old_path.exists():
                os.remove(old_path)
        except Exception:
            pass

    return current_user


@router.delete(
    "/profile-picture",
    response_model=UserResponse,
    summary="Remove profile picture",
)
def remove_profile_picture(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Remove user's profile picture."""
    pic = current_user.profile_picture_url
    if not pic:
        return current_user

    current_user.profile_picture_url = None
    db.commit()
    db.refresh(current_user)

    if "/static/profile_pictures/" in pic:
        try:
            filename = pic.split("/")[-1]
            path = settings.profile_pictures_path / filename
            if path.exists():
                os.remove(path)
        except Exception:
            pass

    return current_user


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete current user account",
)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Permanently delete user account and all associated data."""
    user_id = current_user.id
    try:
        # Cascade should handle companies, records, predictions etc.
        db.delete(current_user)
        db.commit()
        logger.info("Account permanently deleted: id=%d", user_id)
    except Exception as exc:
        logger.error("Failed to delete account id=%d: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting your account. Error: {str(exc)}",
        )
