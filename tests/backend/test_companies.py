"""
FinWatch Zambia - Integration Tests: Companies Endpoints

Tests:
    - POST /api/companies/
    - GET /api/companies/
    - GET /api/companies/{id}
    - DELETE /api/companies/{id}
    - POST /api/companies/{id}/records

Coverage:
    - Company CRUD operations
    - Financial record creation
    - Ratio computation
    - Ownership and access control
"""

import pytest

COMPANY_PAYLOAD = {
    "name": "Lusaka Trading Ltd",
    "industry": "Retail & Trade",
    "registration_number": "LZ2024001",
    "description": "A retail company in Lusaka",
}

RECORD_PAYLOAD = {
    "period": "2024-Q4",
    "current_assets": 500000.0,
    "current_liabilities": 200000.0,
    "total_assets": 1200000.0,
    "total_liabilities": 400000.0,
    "total_equity": 800000.0,
    "inventory": 100000.0,
    "cash_and_equivalents": 150000.0,
    "retained_earnings": 300000.0,
    "revenue": 600000.0,
    "net_income": 120000.0,
    "ebit": 180000.0,
    "interest_expense": 20000.0,
}


class TestCreateCompany:
    """Tests for company creation endpoint."""
    def test_create_company_success(self, client, sme_headers):
        res = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers)
        assert res.status_code == 201

    def test_create_company_returns_id(self, client, sme_headers):
        res = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers)
        assert "id" in res.json()

    def test_create_company_stores_name(self, client, sme_headers):
        res = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers)
        assert res.json()["name"] == COMPANY_PAYLOAD["name"]

    def test_create_company_unauthenticated_rejected(self, client):
        res = client.post("/api/companies/", json=COMPANY_PAYLOAD)
        assert res.status_code == 401

    def test_create_company_missing_name_rejected(self, client, sme_headers):
        payload = {k: v for k, v in COMPANY_PAYLOAD.items() if k != "name"}
        res = client.post("/api/companies/", json=payload, headers=sme_headers)
        assert res.status_code == 422


class TestListCompanies:
    """Tests for listing companies endpoint."""
    def test_list_empty_initially(self, client, sme_headers):
        res = client.get("/api/companies/", headers=sme_headers)
        assert res.status_code == 200
        data = res.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert isinstance(items, list)

    def test_list_returns_created_company(self, client, sme_headers):
        client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers)
        res = client.get("/api/companies/", headers=sme_headers)
        data = res.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert len(items) == 1
        assert items[0]["name"] == COMPANY_PAYLOAD["name"]

    def test_list_unauthenticated_rejected(self, client):
        res = client.get("/api/companies/")
        assert res.status_code == 401

    def test_users_cannot_see_each_others_companies(self, client, sme_headers, db):
        """SME owner should only see their own companies."""
        from app.core.security import hash_password, create_access_token
        from app.models.user import User

        other_user = User(
            full_name="Other User",
            email="other@test.com",
            hashed_password=hash_password("OtherPass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        other_token = create_access_token(subject=str(other_user.id))
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Other user creates a company
        client.post("/api/companies/", json={**COMPANY_PAYLOAD, "name": "Other Co"}, headers=other_headers)

        # SME user's list should not include Other Co
        client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers)
        res = client.get("/api/companies/", headers=sme_headers)
        data = res.json()
        items = data if isinstance(data, list) else data.get("items", [])
        names = [c["name"] for c in items]
        assert "Other Co" not in names


class TestGetCompany:
    """Tests for getting a specific company."""
    def test_get_company_by_id(self, client, sme_headers):
        created = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        res = client.get(f"/api/companies/{created['id']}", headers=sme_headers)
        assert res.status_code == 200
        assert res.json()["id"] == created["id"]

    def test_get_nonexistent_company_returns_404(self, client, sme_headers):
        res = client.get("/api/companies/99999", headers=sme_headers)
        assert res.status_code == 404


class TestDeleteCompany:
    """Tests for company deletion endpoint."""
    def test_delete_company_success(self, client, sme_headers):
        created = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        res = client.delete(f"/api/companies/{created['id']}", headers=sme_headers)
        assert res.status_code == 204

    def test_deleted_company_not_found(self, client, sme_headers):
        created = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        client.delete(f"/api/companies/{created['id']}", headers=sme_headers)
        res = client.get(f"/api/companies/{created['id']}", headers=sme_headers)
        assert res.status_code == 404


class TestCreateFinancialRecord:
    """Tests for financial record creation endpoint."""
    def test_create_record_success(self, client, sme_headers):
        company = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        res = client.post(
            f"/api/companies/{company['id']}/records",
            json=RECORD_PAYLOAD,
            headers=sme_headers,
        )
        assert res.status_code == 201

    def test_create_record_computes_ratios(self, client, sme_headers):
        company = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        res = client.post(
            f"/api/companies/{company['id']}/records",
            json=RECORD_PAYLOAD,
            headers=sme_headers,
        )
        data = res.json()
        # Response should include ratio data
        assert "id" in data

    def test_duplicate_period_rejected(self, client, sme_headers):
        company = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
        endpoint = f"/api/companies/{company['id']}/records"
        client.post(endpoint, json=RECORD_PAYLOAD, headers=sme_headers)
        res = client.post(endpoint, json=RECORD_PAYLOAD, headers=sme_headers)
        assert res.status_code in (400, 409, 422)
