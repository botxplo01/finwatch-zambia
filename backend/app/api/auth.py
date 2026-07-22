"""
FinWatch Zambia - Authentication Router

Handles user registration, authentication, token management, profile updates, and password changes.
"""

import json
import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token, hash_password, verify_password
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
from app.services.auth_limit_service import check_and_record_auth_attempt

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

    # Serialize signup fields temporarily as a two-stage registration mechanism; database record creation is deferred until verification code validation is completed.
    signup_payload = json.dumps(payload.model_dump())

    try:
        raw_code, expiry = verification_service.initiate_verification(
            db, email, payload.portal_type, signup_payload=signup_payload
        )

        sent = email_service.send_verification_email(
            email, raw_code, payload.portal_type, role=payload.role
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

        sent = email_service.send_verification_email(email, raw_code, portal_type, role=user.role)

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
    request: Request,
    long_session: bool = False,
    db: Session = Depends(get_db),
):
    """Verify OTP and finalize user creation (if signup) or session (if login)."""
    try:
        session_record = verification_service.verify_otp_and_get_session(
            db, payload.email, payload.portal_type, payload.code
        )

        user = None

        try:
            if session_record.signup_payload:

                data = json.loads(session_record.signup_payload)

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
                    hashed_password=data["password"],
                    portal_type=session_record.portal_type,
                    role=data["role"],
                    business_scale=data.get("business_scale"),
                    is_active=True,
                )
                if not user.hashed_password.startswith("$2b$"):
                    user.hashed_password = hash_password(user.hashed_password)

                db.add(user)
                db.flush()  # Get user.id without committing yet
                logger.info("New User staged for finalization: %s", user.email)

            elif session_record.user_id:

                user = db.query(User).filter(User.id == session_record.user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User session lost.")

            if not user:
                raise HTTPException(
                    status_code=500, detail="Authentication finalization failed."
                )

            check_and_record_auth_attempt(db, user)

            db.delete(session_record)

            from datetime import datetime, timedelta

            user.last_login_at = datetime.now()

            expires_delta = None
            if long_session:
                expires_delta = timedelta(minutes=settings.LONG_SESSION_EXPIRE_MINUTES)

            from datetime import datetime, timezone

            expires_at = datetime.now(timezone.utc) + (
                expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            )

            import secrets

            from app.services.session_service import register_session

            jti = secrets.token_urlsafe(32)
            user_agent = request.headers.get("user-agent")

            token = create_access_token(
                subject=user.id,
                expires_delta=expires_delta,
                business_scale=user.business_scale,
                jti=jti,
            )

            try:
                register_session(db, user.id, user_agent, jti, expires_at, commit=False)
            except ValueError as err:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(err),
                )

            db.commit()
            db.refresh(user)

            logger.info(
                "User authenticated successfully: id=%d email=%s portal=%s, session jti=%s",
                user.id,
                user.email,
                user.portal_type,
                jti,
            )
            return {"access_token": token, "token_type": "bearer"}

        except Exception as inner_exc:
            db.rollback()
            logger.error(
                "Verification finalization crashed. Rolled back. Error: %s", inner_exc
            )
            if isinstance(inner_exc, HTTPException):
                raise inner_exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Verification failed during session registration. Please try again.",
            )

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

        user = (
            db.query(User)
            .select_from(User)
            .filter(User.email == email.lower().strip(), User.portal_type == portal_type)
            .first()
        )
        role = user.role if user else None

        sent = email_service.send_verification_email(email, raw_code, portal_type, role=role)

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
    profile_path = settings.profile_pictures_path
    profile_path.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload an image (JPG, PNG, WebP, SVG).",
        )

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

    old_pic = current_user.profile_picture_url
    current_user.profile_picture_url = f"/static/profile_pictures/{filename}"
    db.commit()
    db.refresh(current_user)

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

        db.delete(current_user)
        db.commit()
        logger.info("Account permanently deleted: id=%d", user_id)
    except Exception as exc:
        logger.error("Failed to delete account id=%d: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting your account. Error: {str(exc)}",
        )

from typing import List

from app.core.security import decode_access_token
from app.schemas.auth import UserDeviceSessionResponse
from app.services.session_service import get_active_sessions, revoke_session

@router.get(
    "/sessions",
    response_model=List[UserDeviceSessionResponse],
    summary="Get active authenticated device sessions",
)
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve all active sessions for the current user, marking the current session."""
    sessions = get_active_sessions(db, current_user.id)

    auth_header = request.headers.get("Authorization", "")
    current_jti = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            current_jti = payload.get("jti")

    response_sessions = []
    for s in sessions:
        response_sessions.append(
            UserDeviceSessionResponse(
                id=s.id,
                jti=s.jti,
                device_name=s.device_name,
                device_type=s.device_type,
                platform=s.platform,
                is_active=s.is_active,
                last_active_at=s.last_active_at,
                created_at=s.created_at,
                is_current=(s.jti == current_jti),
                is_primary=s.is_primary,
            )
        )
    return response_sessions

@router.delete(
    "/sessions/{jti}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke/Log out an active device session",
)
def delete_session(
    request: Request,
    jti: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Revoke a specific active device session remotely, protecting the primary native device."""
    from app.models.user_device_session import UserDeviceSession

    target_session = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == current_user.id, UserDeviceSession.jti == jti
        )
        .first()
    )
    if not target_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or not owned by current user.",
        )

    auth_header = request.headers.get("Authorization", "")
    current_jti = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            current_jti = payload.get("jti")

    if target_session.is_primary and target_session.device_type == "Mobile":
        if current_jti != jti:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The primary native app session cannot be remotely "
                "revoked from another device. Please sign out directly "
                "from the mobile application.",
            )

    success = revoke_session(db, current_user.id, jti)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or not owned by current user.",
        )
    return
