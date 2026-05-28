from datetime import datetime, timedelta, timezone

import pytest
from app.models.qr_session import QRSession
from app.models.user import User
from fastapi import status


def test_qr_flow_full_success(client, db, sme_user, sme_headers):
    """Test a successful QR login flow from initiation to consumption."""
    # 1. Initiate QR session from Web
    response = client.post("/api/auth/qr/initiate?portal_type=sme")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    token = data["token"]
    assert token is not None
    assert data["poll_interval"] == 2

    # 2. Check status (should be pending)
    status_resp = client.get(f"/api/auth/qr/status/{token}")
    assert status_resp.status_code == status.HTTP_200_OK
    assert status_resp.json()["status"] == "pending"

    # 3. Approve from Mobile (Authenticated)
    approve_resp = client.post(
        "/api/auth/qr/approve", json={"token": token}, headers=sme_headers
    )
    assert approve_resp.status_code == status.HTTP_200_OK
    assert approve_resp.json()["detail"] == "Login approved."

    # 4. Check status again (should be approved and return token)
    status_resp = client.get(f"/api/auth/qr/status/{token}")
    assert status_resp.status_code == status.HTTP_200_OK
    data = status_resp.json()
    assert data["status"] == "approved"
    assert data["access_token"] is not None

    # 5. Check status again (should be consumed)
    status_resp = client.get(f"/api/auth/qr/status/{token}")
    assert status_resp.status_code == status.HTTP_200_OK
    assert status_resp.json()["status"] == "consumed"


def test_qr_portal_isolation(
    client, db, sme_user, policy_analyst_user, analyst_headers
):
    """Test that a mobile device from a different portal cannot approve a QR session."""
    # 1. Initiate SME QR session
    response = client.post("/api/auth/qr/initiate?portal_type=sme")
    token = response.json()["token"]

    # 2. Try to approve with Institutional analyst user (Mismatched portal)
    approve_resp = client.post(
        "/api/auth/qr/approve", json={"token": token}, headers=analyst_headers
    )
    assert approve_resp.status_code == status.HTTP_403_FORBIDDEN
    assert "Mismatched portal" in approve_resp.json()["detail"]


def test_qr_expiry(client, db, sme_user, sme_headers):
    """Test that expired QR sessions cannot be approved and report correct status."""
    # 1. Initiate
    response = client.post("/api/auth/qr/initiate?portal_type=sme")
    token = response.json()["token"]

    # 2. Manually expire in DB
    session = db.query(QRSession).filter(QRSession.token == token).first()
    session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    # 3. Check status (should transition to expired)
    status_resp = client.get(f"/api/auth/qr/status/{token}")
    assert status_resp.json()["status"] == "expired"

    # 4. Try to approve (should fail)
    approve_resp = client.post(
        "/api/auth/qr/approve", json={"token": token}, headers=sme_headers
    )
    assert approve_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "expired" in approve_resp.json()["detail"].lower()


def test_qr_invalid_token(client):
    """Test handling of non-existent tokens."""
    status_resp = client.get("/api/auth/qr/status/non-existent-token")
    assert status_resp.status_code == status.HTTP_404_NOT_FOUND

    approve_resp = client.post("/api/auth/qr/approve", json={"token": "fake-token"})
    assert (
        approve_resp.status_code == status.HTTP_401_UNAUTHORIZED
    )  # Unauthenticated mobile device


def test_qr_already_processed(client, db, sme_user, sme_headers):
    """Test that consumed or already approved sessions cannot be re-approved."""
    response = client.post("/api/auth/qr/initiate?portal_type=sme")
    token = response.json()["token"]

    # Approve once
    client.post("/api/auth/qr/approve", json={"token": token}, headers=sme_headers)

    # Try to approve again
    approve_resp = client.post(
        "/api/auth/qr/approve", json={"token": token}, headers=sme_headers
    )
    assert approve_resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "already approved" in approve_resp.json()["detail"].lower()
