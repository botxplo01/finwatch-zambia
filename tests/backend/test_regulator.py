"""
FinWatch Zambia - Integration Tests: Regulator Endpoints

Tests:
    - GET /api/regulator/overview
    - GET /api/regulator/sectors
    - GET /api/regulator/trends
    - GET /api/regulator/risk-distribution
    - GET /api/regulator/model-performance
    - GET /api/regulator/ratios
    - GET /api/regulator/anomalies
    - POST /api/regulator/chat/

Coverage:
    - Role-based access control
    - Response schema validation
    - Data anonymisation
    - Chat functionality
"""

import pytest
from unittest.mock import patch


@pytest.fixture
def seeded_predictions(prediction_with_narrative):
    return prediction_with_narrative


class TestRegulatorRBAC:
    """Tests for role-based access control."""
    def test_sme_owner_cannot_access_overview(self, client, sme_headers):
        res = client.get("/api/regulator/overview", headers=sme_headers)
        assert res.status_code in (401, 403)

    def test_unauthenticated_cannot_access_overview(self, client):
        res = client.get("/api/regulator/overview")
        assert res.status_code in (401, 403)

    def test_policy_analyst_can_access_overview(self, client, analyst_headers):
        res = client.get("/api/regulator/overview", headers=analyst_headers)
        assert res.status_code == 200

    def test_full_regulator_can_access_overview(self, client, regulator_headers):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_sectors(self, client, analyst_headers):
        res = client.get("/api/regulator/sectors", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_trends(self, client, analyst_headers):
        res = client.get("/api/regulator/trends", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_model_performance(self, client, analyst_headers):
        res = client.get("/api/regulator/model-performance", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_cannot_access_anomalies(self, client, analyst_headers):
        res = client.get("/api/regulator/anomalies", headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_full_regulator_can_access_anomalies(self, client, regulator_headers):
        res = client.get("/api/regulator/anomalies", headers=regulator_headers)
        assert res.status_code == 200

    def test_sme_owner_cannot_access_anomalies(self, client, sme_headers):
        res = client.get("/api/regulator/anomalies", headers=sme_headers)
        assert res.status_code in (401, 403)


class TestExportRBAC:
    """Tests for export endpoint access control."""
    EXPORT_ENDPOINTS = [
        "/api/regulator/export/pdf",
        "/api/regulator/export/csv",
        "/api/regulator/export/json",
        "/api/regulator/export/zip",
    ]

    def test_policy_analyst_cannot_export_pdf(self, client, analyst_headers):
        res = client.get("/api/regulator/export/pdf", headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_policy_analyst_cannot_export_csv(self, client, analyst_headers):
        res = client.get("/api/regulator/export/csv", headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_policy_analyst_cannot_export_json(self, client, analyst_headers):
        res = client.get("/api/regulator/export/json", headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_sme_owner_cannot_export(self, client, sme_headers):
        for endpoint in self.EXPORT_ENDPOINTS:
            res = client.get(endpoint, headers=sme_headers)
            assert res.status_code in (401, 403), f"Expected 401/403 for {endpoint}"


# =============================================================================
# Overview Endpoint Schema Tests
# =============================================================================

class TestOverviewSchema:
    """Tests for overview endpoint schema."""
    REQUIRED_FIELDS = [
        "total_assessments", "total_companies", "total_sme_owners",
        "overall_distress_rate", "avg_distress_prob",
        "high_risk_count", "medium_risk_count", "low_risk_count", "sectors_covered",
    ]

    def test_overview_returns_all_required_fields(self, client, regulator_headers):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        data = res.json()
        for field in self.REQUIRED_FIELDS:
            assert field in data, f"Missing field: {field}"

    def test_overview_counts_are_non_negative(self, client, regulator_headers):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        data = res.json()
        assert data["total_assessments"] >= 0
        assert data["total_companies"] >= 0
        assert data["high_risk_count"] >= 0
        assert data["medium_risk_count"] >= 0
        assert data["low_risk_count"] >= 0

    def test_overall_distress_rate_in_range(self, client, regulator_headers):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        rate = res.json()["overall_distress_rate"]
        assert 0.0 <= rate <= 1.0

    def test_avg_distress_prob_in_range(self, client, regulator_headers):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        prob = res.json()["avg_distress_prob"]
        assert 0.0 <= prob <= 1.0

    def test_risk_counts_sum_to_total(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/overview", headers=regulator_headers)
        data = res.json()
        total = data["total_assessments"]
        risk_sum = data["high_risk_count"] + data["medium_risk_count"] + data["low_risk_count"]
        assert risk_sum == total


class TestSectorsSchema:
    """Tests for sectors endpoint schema."""
    def test_sectors_returns_list(self, client, regulator_headers):
        res = client.get("/api/regulator/sectors", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_sector_items_have_required_fields(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/sectors", headers=regulator_headers)
        for item in res.json():
            assert "industry" in item
            assert "total_assessments" in item
            assert "distress_rate" in item

    def test_distress_rate_in_range(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/sectors", headers=regulator_headers)
        for item in res.json():
            assert 0.0 <= item["distress_rate"] <= 1.0

    def test_no_company_names_in_response(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/sectors", headers=regulator_headers)
        raw = res.text
        assert "Lusaka Trading Ltd" not in raw


class TestRiskDistribution:
    """Tests for risk distribution endpoint."""
    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/regulator/risk-distribution", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_tiers_are_valid(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/risk-distribution", headers=regulator_headers)
        tiers = {item["tier"] for item in res.json()}
        assert tiers.issubset({"High", "Medium", "Low"})

    def test_percentages_sum_to_100(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/risk-distribution", headers=regulator_headers)
        total_pct = sum(item["percentage"] for item in res.json())
        assert abs(total_pct - 100.0) < 1.0


class TestModelPerformance:
    """Tests for model performance endpoint."""
    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/regulator/model-performance", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_model_items_have_required_fields(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/model-performance", headers=regulator_headers)
        for item in res.json():
            assert "model_name" in item
            assert "total_predictions" in item
            assert "distress_rate" in item

    def test_model_names_are_valid(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/model-performance", headers=regulator_headers)
        for item in res.json():
            assert item["model_name"] in ("random_forest", "logistic_regression")


class TestRatioBenchmarks:
    """Tests for ratio benchmarks endpoint."""
    def test_returns_list_of_ten(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/ratios", headers=regulator_headers)
        assert len(res.json()) == 10

    def test_ratio_items_have_required_fields(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/regulator/ratios", headers=regulator_headers)
        for item in res.json():
            assert "ratio_name" in item
            assert "avg_value" in item
            assert "distressed_avg" in item
            assert "healthy_avg" in item

    def test_ratio_names_match_expected(self, client, regulator_headers, seeded_predictions):
        from app.services.ratio_engine import RATIO_NAMES
        res = client.get("/api/regulator/ratios", headers=regulator_headers)
        returned_names = {item["ratio_name"] for item in res.json()}
        assert returned_names == set(RATIO_NAMES)


class TestAnomalyFlags:
    """Tests for anomaly detection endpoint."""
    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/regulator/anomalies", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_no_company_names_in_anomalies(self, client, regulator_headers):
        res = client.get("/api/regulator/anomalies", headers=regulator_headers)
        raw = res.text
        assert "Lusaka Trading Ltd" not in raw
        assert "owner_id" not in raw

    def test_all_flagged_above_threshold(self, client, regulator_headers):
        res = client.get("/api/regulator/anomalies", headers=regulator_headers)
        for item in res.json():
            assert item["distress_probability"] >= 0.70


class TestRegulatorChat:
    """Tests for regulator chat endpoint."""
    def test_regulator_can_chat(self, client, regulator_headers):
        with patch("app.api.regulator_chat.generate_chat_response",
                   return_value=("System overview summary.", "groq")):
            res = client.post(
                "/api/regulator/chat/",
                json={"message": "Summarise distress trends"},
                headers=regulator_headers,
            )
            assert res.status_code == 200

    def test_policy_analyst_can_chat(self, client, analyst_headers):
        with patch("app.api.regulator_chat.generate_chat_response",
                   return_value=("Sector analysis.", "template")):
            res = client.post(
                "/api/regulator/chat/",
                json={"message": "Which sector has highest distress?"},
                headers=analyst_headers,
            )
            assert res.status_code == 200

    def test_sme_owner_cannot_access_regulator_chat(self, client, sme_headers):
        res = client.post(
            "/api/regulator/chat/",
            json={"message": "Hello"},
            headers=sme_headers,
        )
        assert res.status_code in (401, 403)

    def test_unauthenticated_cannot_access_regulator_chat(self, client):
        res = client.post("/api/regulator/chat/", json={"message": "Hello"})
        assert res.status_code in (401, 403)

    def test_empty_message_rejected(self, client, regulator_headers):
        res = client.post(
            "/api/regulator/chat/",
            json={"message": ""},
            headers=regulator_headers,
        )
        assert res.status_code == 400

    def test_response_has_reply_and_source(self, client, regulator_headers):
        with patch("app.api.regulator_chat.generate_chat_response",
                   return_value=("The system shows 13.5% distress rate.", "groq")):
            res = client.post(
                "/api/regulator/chat/",
                json={"message": "What is the overall distress rate?"},
                headers=regulator_headers,
            )
            data = res.json()
            assert "reply" in data
            assert "source" in data

    def test_chat_with_history(self, client, regulator_headers):
        with patch("app.api.regulator_chat.generate_chat_response",
                   return_value=("Follow-up answer.", "groq")):
            res = client.post(
                "/api/regulator/chat/",
                json={
                    "message": "Tell me more",
                    "history": [
                        {"role": "user", "content": "What is the distress rate?"},
                        {"role": "assistant", "content": "It is 13.5%."},
                    ],
                },
                headers=regulator_headers,
            )
            assert res.status_code == 200

    def test_service_failure_returns_503(self, client, regulator_headers):
        with patch("app.api.regulator_chat.generate_chat_response",
                   side_effect=Exception("All LLM providers down")):
            res = client.post(
                "/api/regulator/chat/",
                json={"message": "Analyse sectors"},
                headers=regulator_headers,
            )
            assert res.status_code == 503
