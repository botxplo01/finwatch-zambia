"""
FinWatch Zambia — Integration Tests: Predictions Endpoints

Tests:
    - POST /api/predictions/
    - GET /api/predictions/

Coverage:
    - Full prediction pipeline
    - Ownership verification
    - ML inference
    - SHAP attribution
    - Narrative generation
    - Caching and idempotency
    - Response schema validation
"""

import pytest
import json


COMPANY_PAYLOAD = {
    "name": "Test SME Ltd",
    "industry": "Manufacturing",
    "registration_number": "MF2024001",
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


@pytest.fixture
def setup_company_record(client, sme_headers):
    """Create a company + financial record, return (company_id, record_id)."""
    company = client.post("/api/companies/", json=COMPANY_PAYLOAD, headers=sme_headers).json()
    record = client.post(
        f"/api/companies/{company['id']}/records",
        json=RECORD_PAYLOAD,
        headers=sme_headers,
    ).json()
    return company["id"], record["id"]


class TestCreatePrediction:
    """Tests for prediction creation endpoint."""
    def test_predict_random_forest_success(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        assert res.status_code == 201

    def test_predict_logistic_regression_success(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "logistic_regression"},
            headers=sme_headers,
        )
        assert res.status_code == 201

    def test_prediction_response_has_required_fields(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        data = res.json()
        assert "risk_label" in data
        assert "distress_probability" in data
        assert "model_used" in data
        assert "shap_values" in data

    def test_risk_label_is_valid(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        assert res.json()["risk_label"] in ("Healthy", "Distressed")

    def test_distress_probability_is_in_range(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        prob = res.json()["distress_probability"]
        assert 0.0 <= prob <= 1.0

    def test_shap_values_has_ten_keys(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        shap = res.json()["shap_values"]
        assert len(shap) == 10

    def test_narrative_is_generated(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        data = res.json()
        assert "narrative" in data
        assert data["narrative"] is not None
        assert len(data["narrative"]["content"]) > 10

    def test_unauthenticated_request_rejected(self, client, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
        )
        assert res.status_code == 401

    def test_invalid_model_name_rejected(self, client, sme_headers, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "xgboost"},
            headers=sme_headers,
        )
        assert res.status_code == 400

    def test_wrong_company_id_rejected(self, client, sme_headers, setup_company_record):
        _, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": 99999, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        assert res.status_code == 404

class TestPredictionIdempotency:
    """Tests for prediction idempotency."""
    def test_same_record_model_returns_existing_prediction(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        params = {"company_id": company_id, "record_id": record_id, "model_name": "random_forest"}

        res1 = client.post("/api/predictions/", params=params, headers=sme_headers)
        res2 = client.post("/api/predictions/", params=params, headers=sme_headers)

        assert res1.status_code == 201
        assert res2.status_code == 201
        # Same prediction ID returned
        assert res1.json()["id"] == res2.json()["id"]


class TestListPredictions:
    """Tests for listing predictions endpoint."""
    def test_list_returns_200(self, client, sme_headers):
        res = client.get("/api/predictions/", headers=sme_headers)
        assert res.status_code == 200

    def test_list_unauthenticated_rejected(self, client):
        res = client.get("/api/predictions/")
        assert res.status_code == 401

    def test_list_returns_pagination_fields(self, client, sme_headers):
        res = client.get("/api/predictions/", headers=sme_headers)
        data = res.json()
        assert "items" in data
        assert "total" in data

    def test_created_prediction_appears_in_list(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
            headers=sme_headers,
        )
        res = client.get("/api/predictions/", headers=sme_headers)
        data = res.json()
        assert data["total"] >= 1

class TestPredictionWithoutModels:
    """Tests for ML service unavailability handling."""
    def test_returns_503_when_models_not_loaded(self, client, sme_headers, setup_company_record):
        from unittest.mock import patch
        company_id, record_id = setup_company_record
        with patch("app.services.ml_service._models", {}):
            res = client.post(
                "/api/predictions/",
                params={"company_id": company_id, "record_id": record_id, "model_name": "random_forest"},
                headers=sme_headers,
            )
            assert res.status_code == 503
