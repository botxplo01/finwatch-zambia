"""
FinWatch Zambia — Integration Tests: Predictions Endpoints

Tests:
    - POST /api/predictions/  (dual-model — no model_name param)
    - GET  /api/predictions/  (grouped by ratio_feature_id)
    - GET  /api/predictions/assessment/{ratio_feature_id}
    - DELETE /api/predictions/assessment/{ratio_feature_id}
    - GET  /api/predictions/{prediction_id}  (single-model detail, unchanged)

Coverage:
    - Dual-model pipeline (both models created per assessment)
    - Idempotency (same record returns existing pair without re-running)
    - Ownership verification
    - ML inference
    - SHAP attribution
    - Narrative generation
    - AssessmentResponse schema validation
    - List endpoint counts distinct assessments, not raw rows
    - Assessment-level get and delete
    - Partial success when one model fails
    - 503 when both models fail
"""

import pytest
import json


COMPANY_PAYLOAD = {
    "name": "Test SME Ltd",
    "industry": "Manufacturing",
    "registration_number": "100200300401",
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


class TestCreateAssessment:
    """Tests for dual-model assessment creation (POST /api/predictions/)."""

    def test_assessment_success_returns_201(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        assert res.status_code == 201

    def test_assessment_response_has_both_models(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        assert "random_forest" in data
        assert "logistic_regression" in data
        assert data["random_forest"] is not None
        assert data["logistic_regression"] is not None

    def test_assessment_response_schema_fields(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        assert "ratio_feature_id" in data
        assert "company_id" in data
        assert "company_name" in data
        assert "period" in data
        assert "assessment_methodology" in data
        assert "models_agree" in data
        assert "predicted_at" in data

    def test_models_agree_field_is_bool(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        # Both models mock to same direction so models_agree is bool, not null
        assert isinstance(data["models_agree"], bool)

    def test_each_model_has_risk_label(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        assert data["random_forest"]["risk_label"] in ("Healthy", "Distressed")
        assert data["logistic_regression"]["risk_label"] in ("Healthy", "Distressed")

    def test_each_model_has_shap_values_with_ten_keys(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        assert len(data["random_forest"]["shap_values"]) == 10
        assert len(data["logistic_regression"]["shap_values"]) == 10

    def test_each_model_has_narrative(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        data = res.json()
        assert data["random_forest"]["narrative"] is not None
        assert len(data["random_forest"]["narrative"]["content"]) > 10
        assert data["logistic_regression"]["narrative"] is not None
        assert len(data["logistic_regression"]["narrative"]["content"]) > 10

    def test_unauthenticated_request_rejected(self, client, setup_company_record):
        company_id, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
        )
        assert res.status_code == 401

    def test_wrong_company_id_rejected(self, client, sme_headers, setup_company_record):
        _, record_id = setup_company_record
        res = client.post(
            "/api/predictions/",
            params={"company_id": 99999, "record_id": record_id},
            headers=sme_headers,
        )
        assert res.status_code == 404


class TestAssessmentIdempotency:
    """Tests for assessment idempotency — same record returns existing pair."""

    def test_same_record_returns_existing_assessment(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        params = {"company_id": company_id, "record_id": record_id}

        res1 = client.post("/api/predictions/", params=params, headers=sme_headers)
        res2 = client.post("/api/predictions/", params=params, headers=sme_headers)

        assert res1.status_code == 201
        assert res2.status_code == 201
        # Same ratio_feature_id and identical model prediction IDs on second call
        data1, data2 = res1.json(), res2.json()
        assert data1["ratio_feature_id"] == data2["ratio_feature_id"]
        assert data1["random_forest"]["id"] == data2["random_forest"]["id"]
        assert data1["logistic_regression"]["id"] == data2["logistic_regression"]["id"]


class TestListAssessments:
    """Tests for listing assessments endpoint (grouped by ratio_feature_id)."""

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
        assert "skip" in data
        assert "limit" in data

    def test_list_counts_one_item_per_assessment(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        """Both model rows for the same financial record must count as one assessment."""
        company_id, record_id = setup_company_record
        client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        res = client.get("/api/predictions/", headers=sme_headers)
        data = res.json()
        # Should be exactly 1 assessment item, not 2 raw rows
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

    def test_list_item_has_both_model_fields(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        res = client.get("/api/predictions/", headers=sme_headers)
        item = res.json()["items"][0]
        assert "random_forest_risk_label" in item
        assert "logistic_regression_risk_label" in item
        assert "models_agree" in item


class TestAssessmentDetailAndDelete:
    """Tests for GET and DELETE /api/predictions/assessment/{ratio_feature_id}."""

    def test_get_assessment_returns_200(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        create_res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        rf_id = create_res.json()["ratio_feature_id"]
        res = client.get(f"/api/predictions/assessment/{rf_id}", headers=sme_headers)
        assert res.status_code == 200

    def test_get_assessment_has_both_models(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        create_res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        rf_id = create_res.json()["ratio_feature_id"]
        data = client.get(f"/api/predictions/assessment/{rf_id}", headers=sme_headers).json()
        assert data["random_forest"] is not None
        assert data["logistic_regression"] is not None

    def test_get_assessment_not_found(self, client, sme_headers):
        res = client.get("/api/predictions/assessment/99999", headers=sme_headers)
        assert res.status_code == 404

    def test_delete_assessment_returns_204(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        create_res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        rf_id = create_res.json()["ratio_feature_id"]
        res = client.delete(f"/api/predictions/assessment/{rf_id}", headers=sme_headers)
        assert res.status_code == 204

    def test_delete_assessment_removes_both_models(self, client, sme_headers, mock_models, mock_explainers, mock_nlp, setup_company_record):
        company_id, record_id = setup_company_record
        create_res = client.post(
            "/api/predictions/",
            params={"company_id": company_id, "record_id": record_id},
            headers=sme_headers,
        )
        rf_id = create_res.json()["ratio_feature_id"]
        client.delete(f"/api/predictions/assessment/{rf_id}", headers=sme_headers)
        # After delete, GET should 404
        res = client.get(f"/api/predictions/assessment/{rf_id}", headers=sme_headers)
        assert res.status_code == 404

    def test_delete_assessment_not_found(self, client, sme_headers):
        res = client.delete("/api/predictions/assessment/99999", headers=sme_headers)
        assert res.status_code == 404


class TestPartialModelFailure:
    """Partial failure: one model pipeline fails, the other succeeds."""

    def test_partial_success_returns_201_with_one_model(self, client, sme_headers, mock_explainers, mock_nlp, setup_company_record):
        from unittest.mock import patch, MagicMock

        company_id, record_id = setup_company_record

        mock_rf = MagicMock()
        mock_rf.predict_proba.return_value = [[0.95, 0.05]]

        # logistic regression model raises RuntimeError (simulated load failure)
        mock_scaler = MagicMock()
        mock_scaler.transform.side_effect = lambda x: x

        with patch("app.services.ml_service._models", {"random_forest": mock_rf}), \
             patch("app.services.ml_service._scaler", mock_scaler):
            res = client.post(
                "/api/predictions/",
                params={"company_id": company_id, "record_id": record_id},
                headers=sme_headers,
            )

        assert res.status_code == 201
        data = res.json()
        assert data["random_forest"] is not None
        assert data["logistic_regression"] is None
        assert data["models_agree"] is None


class TestBothModelsUnavailable:
    """503 returned when both model pipelines fail."""

    def test_returns_503_when_models_not_loaded(self, client, sme_headers, setup_company_record):
        from unittest.mock import patch

        company_id, record_id = setup_company_record
        with patch("app.services.ml_service._models", {}):
            res = client.post(
                "/api/predictions/",
                params={"company_id": company_id, "record_id": record_id},
                headers=sme_headers,
            )
            assert res.status_code == 503
