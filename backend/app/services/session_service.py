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

    device_type = "Browser"
    if "capacitor" in ua or "android" in ua or "iphone" in ua or "ipad" in ua:
        if "capacitor" in ua or "mobile" in ua:
            device_type = "Mobile"
        else:
            device_type = "Mobile"

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

    Native (Capacitor) sessions supersede web sessions: if all 3 slots are
    occupied by web sessions, the most recently created web session is evicted
    automatically. The limit check runs after native supersedence to ensure
    native logins are never blocked by web-only sessions.
    """
    device_name, device_type, platform = parse_user_agent(user_agent)

    _prune_expired_sessions(db, user_id)

    #    If the user has a session from the same device (name, type, platform),
    #    revoke it now so it does not consume a slot.
    existing_same_device_sessions = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == user_id,
            UserDeviceSession.device_name == device_name,
            UserDeviceSession.device_type == device_type,
            UserDeviceSession.platform == platform,
        )
        .all()
    )
    if existing_same_device_sessions:
        for s in existing_same_device_sessions:
            db.delete(s)
        db.flush()
        logger.info(
            "Revoked %d existing sessions for the same device "
            "(name='%s', platform='%s') for user_id=%d.",
            len(existing_same_device_sessions),
            device_name,
            platform,
            user_id,
        )

    is_native_app = False
    if user_agent:
        ua = user_agent.lower()
        if "capacitor" in ua:
            is_native_app = True
        elif platform in ["Android", "iOS"] and device_type == "Mobile":
            if "chrome" not in ua and "safari" not in ua:
                is_native_app = True

    is_primary_flag = False

    if is_native_app:
        # 3a. Revoke any stale native primary on the same platform.
        #     Handles the app-reinstall edge case.
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
            db.delete(existing_native_primary)
            db.flush()
            logger.info(
                "Stale native primary session revoked for user_id=%d"
                " on platform=%s (app reinstall or re-login).",
                user_id,
                platform,
            )

        # 3b. If still at the 3-device limit, evict the most recently
        active_sessions_now = (
            db.query(UserDeviceSession)
            .filter(UserDeviceSession.user_id == user_id)
            .all()
        )
        if len(active_sessions_now) >= 3:
            most_recent_web = (
                db.query(UserDeviceSession)
                .filter(
                    UserDeviceSession.user_id == user_id,
                    UserDeviceSession.device_type == "Browser",
                )
                .order_by(UserDeviceSession.created_at.desc())
                .first()
            )
            if most_recent_web:
                db.delete(most_recent_web)
                db.flush()
                logger.info(
                    "Evicted most recent web session id=%d for user_id=%d"
                    " to accommodate incoming native login.",
                    most_recent_web.id,
                    user_id,
                )
            else:
                raise ValueError(
                    "Maximum authenticated device limit (3) reached. "
                    "Please manage your active sessions in Settings to "
                    "authorise a new device."
                )

        # 3c. Demote any remaining session that holds primary status
        current_web_primary = (
            db.query(UserDeviceSession)
            .filter(
                UserDeviceSession.user_id == user_id,
                UserDeviceSession.is_primary == True,
            )
            .first()
        )
        if current_web_primary:
            current_web_primary.is_primary = False
            db.add(current_web_primary)
            db.flush()

        # Native session always becomes primary
        is_primary_flag = True

    else:
        # 3d. Enforce the 3-device limit for non-native sessions
        active_sessions = (
            db.query(UserDeviceSession)
            .filter(UserDeviceSession.user_id == user_id)
            .all()
        )
        if len(active_sessions) >= 3:
            raise ValueError(
                "Maximum authenticated device limit (3) reached. "
                "Please manage your active sessions in Settings to "
                "authorise a new device."
            )

        # 3e. Web session is primary only if no primary currently exists
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


def _reassign_primary_after_revocation(db: Session, user_id: int) -> None:
    """
    After a session is revoked, ensure exactly one remaining session
    is designated primary (if any sessions remain).
    Priority: earliest native (Mobile) session, then earliest web session.
    If no sessions remain, this is a no-op.
    """
    existing_primary = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == user_id,
            UserDeviceSession.is_primary == True,
        )
        .first()
    )
    if existing_primary:
        return

    native_candidate = (
        db.query(UserDeviceSession)
        .filter(
            UserDeviceSession.user_id == user_id,
            UserDeviceSession.device_type == "Mobile",
        )
        .order_by(UserDeviceSession.created_at.asc())
        .first()
    )
    if native_candidate:
        native_candidate.is_primary = True
        db.add(native_candidate)
        db.flush()
        logger.info(
            "Promoted native session id=%d to primary for user_id=%d"
            " after revocation.",
            native_candidate.id,
            user_id,
        )
        return

    web_candidate = (
        db.query(UserDeviceSession)
        .filter(UserDeviceSession.user_id == user_id)
        .order_by(UserDeviceSession.created_at.asc())
        .first()
    )
    if web_candidate:
        web_candidate.is_primary = True
        db.add(web_candidate)
        db.flush()
        logger.info(
            "Promoted web session id=%d to primary for user_id=%d" " after revocation.",
            web_candidate.id,
            user_id,
        )


def revoke_session(db: Session, user_id: int, jti: str, commit: bool = True) -> bool:
    """
    Revoke a specific active device session.
    If the revoked session held primary status, the next best session
    is automatically promoted (native preferred, then earliest web).
    """
    session = (
        db.query(UserDeviceSession)
        .filter(UserDeviceSession.user_id == user_id, UserDeviceSession.jti == jti)
        .first()
    )
    if not session:
        return False

    db.delete(session)
    db.flush()

    _reassign_primary_after_revocation(db, user_id)

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
