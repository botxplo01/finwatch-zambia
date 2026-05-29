"""
FinWatch Zambia - User Session Management Service

Handles parsing User-Agents, registering active device sessions,
enforcing the 3-device limit, and revoking/invalidating sessions.
"""

import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user_device_session import UserDeviceSession

logger = logging.getLogger(__name__)


def parse_user_agent(ua_string: str | None) -> tuple[str, str, str]:
    """
    Parses User-Agent to return a tuple: (device_name, device_type, platform)
    """
    if not ua_string:
        return "Unknown Device", "Browser", "Unknown"

    ua = ua_string.lower()

    # 1. Determine platform
    platform = "Unknown"
    if "windows" in ua:
        platform = "Windows"
    elif "android" in ua:
        platform = "Android"
    elif "iphone" in ua or "ipad" in ua:
        platform = "iOS"
    elif "macintosh" in ua or "mac os x" in ua:
        platform = "macOS"
    elif "linux" in ua:
        platform = "Linux"

    # 2. Determine device type
    device_type = "Browser"
    if "capacitor" in ua or "android" in ua or "iphone" in ua or "ipad" in ua:
        # Check if native/capacitor or mobile browser
        if "capacitor" in ua or "mobile" in ua:
            device_type = "Mobile"
        else:
            device_type = "Mobile"

    # 3. Determine browser/device name
    device_name = "Web Browser"
    if "chrome" in ua:
        device_name = f"Chrome on {platform}"
    elif "firefox" in ua:
        device_name = f"Firefox on {platform}"
    elif "safari" in ua and "chrome" not in ua:
        device_name = f"Safari on {platform}"
    elif "edge" in ua or "edg" in ua:
        device_name = f"Edge on {platform}"
    elif "opera" in ua or "opr" in ua:
        device_name = f"Opera on {platform}"

    if "capacitor" in ua or ("android" in ua and "chrome" not in ua):
        device_name = "Android Device"
    elif "capacitor" in ua or ("iphone" in ua and "safari" not in ua):
        device_name = "iPhone Device"

    return device_name, device_type, platform


def register_session(
    db: Session, user_id: int, user_agent: str | None, jti: str, commit: bool = True
) -> UserDeviceSession:
    """
    Register a new active user session, enforcing a strict 3-device limit.
    If the user has already reached the maximum 3-device limit, raises a ValueError.
    Enforces initial browser-first primary session assignment, with native Android app
    priority escalation to protected primary status once established.
    """
    device_name, device_type, platform = parse_user_agent(user_agent)

    # Fetch active sessions for the user
    active_sessions = (
        db.query(UserDeviceSession).filter(UserDeviceSession.user_id == user_id).all()
    )

    # Strict 3-device limit enforcement
    if len(active_sessions) >= 3:
        raise ValueError(
            "Maximum authenticated device limit (3) reached. Please manage your active sessions in Settings to authorize a new device."
        )

    # Identify if native Android mobile session (contains "capacitor" in UA or is Android Mobile)
    is_native_android = False
    if user_agent:
        ua = user_agent.lower()
        if "capacitor" in ua or (platform == "Android" and device_type == "Mobile"):
            is_native_android = True

    is_primary_flag = False
    if is_native_android:
        # Check if there is already an active native primary session
        has_native_primary = (
            db.query(UserDeviceSession)
            .filter(
                UserDeviceSession.user_id == user_id,
                UserDeviceSession.is_primary == True,
                UserDeviceSession.device_type == "Mobile",
                UserDeviceSession.platform == "Android",
            )
            .first()
        ) is not None

        if not has_native_primary:
            # Demote any other (non-native / browser) session that is currently primary
            current_primary = (
                db.query(UserDeviceSession)
                .filter(
                    UserDeviceSession.user_id == user_id,
                    UserDeviceSession.is_primary == True,
                )
                .first()
            )
            if current_primary:
                current_primary.is_primary = False
                db.add(current_primary)
            is_primary_flag = True
        else:
            is_primary_flag = False
    else:
        # For browser/secondary sessions, it becomes primary only if there are 0 active sessions currently primary
        has_primary = (
            db.query(UserDeviceSession)
            .filter(
                UserDeviceSession.user_id == user_id,
                UserDeviceSession.is_primary == True,
            )
            .first()
        ) is not None
        is_primary_flag = not has_primary

    session = UserDeviceSession(
        user_id=user_id,
        jti=jti,
        device_name=device_name,
        device_type=device_type,
        platform=platform,
        is_active=True,
        is_primary=is_primary_flag,
    )
    db.add(session)
    if commit:
        db.commit()
        db.refresh(session)
    return session


def revoke_session(db: Session, user_id: int, jti: str, commit: bool = True) -> bool:
    """
    Revoke a specific active device session.
    """
    session = (
        db.query(UserDeviceSession)
        .filter(UserDeviceSession.user_id == user_id, UserDeviceSession.jti == jti)
        .first()
    )
    if not session:
        return False

    db.delete(session)
    if commit:
        db.commit()
    logger.info("Session revoked: jti=%s for user_id=%d", jti, user_id)
    return True


def get_active_sessions(db: Session, user_id: int) -> list[UserDeviceSession]:
    """
    Get all active sessions for a user.
    """
    return (
        db.query(UserDeviceSession)
        .filter(UserDeviceSession.user_id == user_id)
        .order_by(UserDeviceSession.created_at.desc())
        .all()
    )
