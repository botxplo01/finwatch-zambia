"""
FinWatch Zambia - Integration Tests: Authentication Endpoints

Tests:
    - POST /api/auth/register
    - POST /api/auth/login
    - GET /api/auth/me

Coverage:
    - Successful authentication flows
    - Input validation and error handling
    - Duplicate email rejection
    - Invalid credential handling
"""

import pytest


REGISTER_PAYLOAD = {
    "full_name": "David Banda",
    "email": "david@finwatch.zm",
    "password": "SecurePass123!",
}


class TestRegister:
    """Tests for user registration endpoint."""
    def test_register_success(self, client):
        res = client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        assert res.status_code == 201
        data = res.json()
        assert "email" in data
        assert data["email"] == REGISTER_PAYLOAD["email"]
        assert "id" in data

    def test_register_creates_user(self, client):
        res = client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        assert res.status_code == 201
        assert "full_name" in res.json()
        assert res.json()["full_name"] == REGISTER_PAYLOAD["full_name"]

    def test_register_duplicate_email_rejected(self, client):
        client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        res = client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        assert res.status_code in (400, 409, 422)

    def test_register_missing_email_rejected(self, client):
        payload = {"full_name": "Test", "password": "Pass123!"}
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 422

    def test_register_missing_password_rejected(self, client):
        payload = {"full_name": "Test", "email": "test@test.com"}
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 422

    def test_register_invalid_email_format_rejected(self, client):
        payload = {**REGISTER_PAYLOAD, "email": "not-an-email"}
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 422

    def test_register_default_role_is_sme_owner(self, client, db):
        from app.models.user import User
        res = client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        assert res.status_code == 201
        user = db.query(User).filter(User.email == REGISTER_PAYLOAD["email"]).first()
        assert user is not None
        assert user.role == "sme_owner"


class TestLogin:
    """Tests for user login endpoint."""
    def test_login_success(self, client):
        client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        res = client.post("/api/auth/login", data={
            "username": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_wrong_password_rejected(self, client):
        client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        res = client.post("/api/auth/login", data={
            "username": REGISTER_PAYLOAD["email"],
            "password": "WrongPassword!",
        })
        assert res.status_code in (400, 401)

    def test_login_unknown_email_rejected(self, client):
        res = client.post("/api/auth/login", data={
            "username": "nobody@finwatch.zm",
            "password": "AnyPass123!",
        })
        assert res.status_code in (400, 401, 404)

    def test_login_returns_bearer_token(self, client):
        client.post("/api/auth/register", json=REGISTER_PAYLOAD)
        res = client.post("/api/auth/login", data={
            "username": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        })
        assert res.status_code == 200
        assert res.json()["token_type"] == "bearer"



class TestGetCurrentUser:
    """Tests for current user info endpoint."""
    def test_me_returns_user_info(self, client, sme_headers):
        res = client.get("/api/auth/me", headers=sme_headers)
        assert res.status_code == 200
        data = res.json()
        assert "email" in data
        assert "full_name" in data

    def test_me_without_token_returns_401(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken123"})
        assert res.status_code == 401

    def test_me_returns_correct_email(self, client, sme_user, sme_headers):
        res = client.get("/api/auth/me", headers=sme_headers)
        assert res.json()["email"] == sme_user.email

    def test_me_returns_correct_role(self, client, sme_user, sme_headers):
        res = client.get("/api/auth/me", headers=sme_headers)
        assert res.json()["role"] == "sme_owner"
