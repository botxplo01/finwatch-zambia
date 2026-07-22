"""
FinWatch Zambia - QR Authentication Router

Handles "Scan to Login" flow for mobile-to-web synchronization.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token
from app.models.qr_session import QRSession
from app.models.user import User
from app.schemas.qr_auth import QRApproveRequest, QRInitResponse, QRStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter()

QR_EXPIRY_MINUTES = 2


@router.post(
    "/initiate",
    response_model=QRInitResponse,
    dependencies=[Depends(rate_limit)],
    summary="Initiate a QR login session for the web client",
)
def initiate_qr(
    portal_type: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate a unique token for a web client to display as a QR code."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=QR_EXPIRY_MINUTES)
    user_agent = request.headers.get("user-agent")

    qr_session = QRSession(
        token=token,
        portal_type=portal_type,
        expires_at=expires_at,
        status="pending",
        user_agent=user_agent,
    )
    db.add(qr_session)
    db.commit()

    return {"token": token, "expires_at": expires_at, "poll_interval": 2}


@router.get(
    "/status/{token}",
    response_model=QRStatusResponse,
    summary="Poll the status of a QR login session",
)
def get_qr_status(token: str, db: Session = Depends(get_db)):
    """Check if the QR session has been approved by a mobile device."""
    qr_session = db.query(QRSession).filter(QRSession.token == token).first()

    if not qr_session:
        raise HTTPException(status_code=404, detail="Session not found.")

    now = datetime.now(timezone.utc)
    expires_at = qr_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if qr_session.status == "pending" and expires_at < now:
        qr_session.status = "expired"
        db.commit()

    response = {"status": qr_session.status}

    if qr_session.status in ("approved", "consumed"):
        response["access_token"] = qr_session.access_token

        if qr_session.status == "approved":
            # Mark as consumed so the transition is recorded,
            # but still allow token retrieval during the short expiry window.
            qr_session.status = "consumed"
            db.commit()
            logger.info("QR Login session consumed for user_id=%s", qr_session.user_id)

    return response


@router.post(
    "/approve",
    dependencies=[Depends(rate_limit)],
    summary="Approve a QR login session from an authenticated mobile device",
)
def approve_qr(
    payload: QRApproveRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Authenticate a web session using an active mobile session."""
    qr_session = db.query(QRSession).filter(QRSession.token == payload.token).first()

    if not qr_session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if qr_session.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Session is already {qr_session.status}."
        )

    now = datetime.now(timezone.utc)
    expires_at = qr_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        qr_session.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Session has expired.")

    # Portal isolation check
    if current_user.portal_type != qr_session.portal_type:
        logger.warning(
            "QR Approval blocked: Portal mismatch. User=%s, Mobile=%s, Web=%s",
            current_user.email,
            current_user.portal_type,
            qr_session.portal_type,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Mismatched portal. Mobile is {current_user.portal_type}, Web is {qr_session.portal_type}.",
        )

    # Web sessions use standard expiry (24h), not long sessions (30d)
    web_jti = secrets.token_urlsafe(32)
    web_token = create_access_token(
        subject=current_user.id,
        business_scale=current_user.business_scale,
        jti=web_jti,
    )

    from app.services.session_service import register_session

    try:
        session_expiry = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        register_session(
            db, current_user.id, qr_session.user_agent, web_jti, session_expiry
        )
    except ValueError as err:
        logger.error(
            "QR Approval blocked: Device limit reached for user_id=%d. Error: %s",
            current_user.id,
            err,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        )

    qr_session.user_id = current_user.id
    qr_session.status = "approved"
    qr_session.access_token = web_token
    db.commit()

    logger.info(
        "QR Login SUCCESS: user_id=%d approved session for portal=%s",
        current_user.id,
        qr_session.portal_type,
    )
    return {"detail": "Login approved."}
