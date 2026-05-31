"""
FinWatch Zambia - User Session Management Service

Handles parsing User-Agents, registering active device sessions,
enforcing the 3-device limit, and revoking/invalidating sessions.
"""

import logging
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


def _prune_expired_sessions(db: Session, user_id: int) -> int:
    """
    Remove sessions that have passed their mathematical expiry date.
    Returns the number of sessions pruned.
    """
    now = datetime.now(timezone.utc)
    # Ensure UTC awareness for comparison if needed by dialect
    expired_sessions = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == user_id, UserDeviceSession.expires_at < now
        )
        .all()
    )

    count = len(expired_sessions)
    if count > 0:
        for s in expired_sessions:
            db.delete(s)
        db.flush()  # Sync state within transaction
        logger.info("Pruned %d expired sessions for user_id=%d", count, user_id)

    return count


def register_session(
    db: Session,
    user_id: int,
    user_agent: str | None,
    jti: str,
    expires_at: datetime,
    commit: bool = True,
) -> UserDeviceSession:
    """
    Register a new active user session, enforcing a strict 3-device limit.
    Automatically prunes expired sessions before limit enforcement.
    """
    device_name, device_type, platform = parse_user_agent(user_agent)

    # 1. Prune expired sessions first to ensure accurate device count
    _prune_expired_sessions(db, user_id)

    # 2. Fetch truly active sessions for the user
    active_sessions = (
        db.query(UserDeviceSession).filter(UserDeviceSession.user_id == user_id).all()
    )

    # Strict 3-device limit enforcement
    if len(active_sessions) >= 3:
        raise ValueError(
            "Maximum authenticated device limit (3) reached. Please manage your active sessions in Settings to authorize a new device."
        )

    # Identify if native mobile session (contains "capacitor" in UA or is native mobile)
    is_native_app = False
    if user_agent:
        ua = user_agent.lower()
        # Capacitor is the primary indicator of native app; specific mobile UA patterns as fallback
        if "capacitor" in ua:
            is_native_app = True
        elif platform in ["Android", "iOS"] and device_type == "Mobile":
            # Native apps often don't have "Chrome" or "Safari" in UA when using standard webview strings
            if "chrome" not in ua and "safari" not in ua:
                is_native_app = True

    is_primary_flag = False
    if is_native_app:
        # App Reinstall / Multi-Device Hardening:
        # If this is a native app login, it MUST supersede any existing primary native session on the same platform.
        # This resolves the "orphaned session" issue where old installations stay active after uninstall.
        existing_native_primary = (
            db.query(UserDeviceSession)
            .filter(
                UserDeviceSession.user_id == user_id,
                UserDeviceSession.is_primary == True,
                UserDeviceSession.platform == platform,
                UserDeviceSession.device_type == "Mobile",
            )
            .first()
        )

        if existing_native_primary:
            # Revoke (delete) the stale native primary session
            db.delete(existing_native_primary)
            db.flush()
            logger.info(
                "Stale/Previous native primary session revoked for user_id=%d on platform=%s",
                user_id,
                platform,
            )

        # Demote any other (browser) session that is currently primary
        current_browser_primary = (
            db.query(UserDeviceSession)
            .filter(
                UserDeviceSession.user_id == user_id,
                UserDeviceSession.is_primary == True,
            )
            .first()
        )
        if current_browser_primary:
            current_browser_primary.is_primary = False
            db.add(current_browser_primary)
            db.flush()

        # New native session always takes primary status
        is_primary_flag = True
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
        expires_at=expires_at,
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
    Get all active sessions for a user, pruning expired ones first.
    """
    _prune_expired_sessions(db, user_id)

    return (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == user_id, UserDeviceSession.is_active == True
        )
        .order_by(UserDeviceSession.created_at.desc())
        .all()
    )
