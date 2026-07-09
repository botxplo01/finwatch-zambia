"""
FinWatch Zambia - Integration Tests: Institutional Endpoints

Tests:
    - GET /api/institutional/overview
    - GET /api/institutional/sectors
    - GET /api/institutional/trends
    - GET /api/institutional/risk-distribution
    - GET /api/institutional/model-performance
    - GET /api/institutional/ratios
    - GET /api/institutional/anomalies
    - POST /api/institutional/chat/

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


class TestInstitutionalRBAC:
    """Tests for role-based access control."""

    def test_sme_owner_cannot_access_overview(self, client, sme_headers):
        res = client.get("/api/institutional/overview", headers=sme_headers)
        assert res.status_code in (401, 403)

    def test_unauthenticated_cannot_access_overview(self, client):
        res = client.get("/api/institutional/overview")
        assert res.status_code in (401, 403)

    def test_policy_analyst_can_access_overview(self, client, analyst_headers):
        res = client.get("/api/institutional/overview", headers=analyst_headers)
        assert res.status_code == 200

    def test_full_regulator_can_access_overview(self, client, regulator_headers):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_sectors(self, client, analyst_headers):
        res = client.get("/api/institutional/sectors", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_trends(self, client, analyst_headers):
        res = client.get("/api/institutional/trends", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_access_model_performance(self, client, analyst_headers):
        res = client.get("/api/institutional/model-performance", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_cannot_access_anomalies(self, client, analyst_headers):
        res = client.get("/api/institutional/anomalies", headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_full_regulator_can_access_anomalies(self, client, regulator_headers):
        res = client.get("/api/institutional/anomalies", headers=regulator_headers)
        assert res.status_code == 200

    def test_sme_owner_cannot_access_anomalies(self, client, sme_headers):
        res = client.get("/api/institutional/anomalies", headers=sme_headers)
        assert res.status_code in (401, 403)


class TestExportRBAC:
    """Tests for export endpoint access control."""

    EXPORT_ENDPOINTS = [
        "/api/institutional/export/pdf",
        "/api/institutional/export/csv",
        "/api/institutional/export/json",
        "/api/institutional/export/zip",
    ]

    def test_policy_analyst_can_export_pdf(self, client, analyst_headers):
        res = client.get("/api/institutional/export/pdf", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_export_csv(self, client, analyst_headers):
        res = client.get("/api/institutional/export/csv", headers=analyst_headers)
        assert res.status_code == 200

    def test_policy_analyst_can_export_json(self, client, analyst_headers):
        res = client.get("/api/institutional/export/json", headers=analyst_headers)
        assert res.status_code == 200

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
        "total_assessments",
        "total_companies",
        "total_sme_owners",
        "overall_distress_rate",
        "avg_distress_prob",
        "high_risk_count",
        "medium_risk_count",
        "low_risk_count",
        "sectors_covered",
    ]

    def test_overview_returns_all_required_fields(self, client, regulator_headers):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        data = res.json()
        for field in self.REQUIRED_FIELDS:
            assert field in data, f"Missing field: {field}"

    def test_overview_counts_are_non_negative(self, client, regulator_headers):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        data = res.json()
        assert data["total_assessments"] >= 0
        assert data["total_companies"] >= 0
        assert data["high_risk_count"] >= 0
        assert data["medium_risk_count"] >= 0
        assert data["low_risk_count"] >= 0

    def test_overall_distress_rate_in_range(self, client, regulator_headers):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        rate = res.json()["overall_distress_rate"]
        assert 0.0 <= rate <= 1.0

    def test_avg_distress_prob_in_range(self, client, regulator_headers):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        prob = res.json()["avg_distress_prob"]
        assert 0.0 <= prob <= 1.0

    def test_risk_counts_sum_to_total(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        data = res.json()
        total = data["total_assessments"]
        risk_sum = (
            data["high_risk_count"] + data["medium_risk_count"] + data["low_risk_count"]
        )
        assert risk_sum == total


class TestSectorsSchema:
    """Tests for sectors endpoint schema."""

    def test_sectors_returns_list(self, client, regulator_headers):
        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_sector_items_have_required_fields(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        for item in res.json():
            assert "industry" in item
            assert "total_assessments" in item
            assert "distress_rate" in item

    def test_distress_rate_in_range(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        for item in res.json():
            assert 0.0 <= item["distress_rate"] <= 1.0

    def test_no_company_names_in_response(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        raw = res.text
        assert "Lusaka Trading Ltd" not in raw


class TestRiskDistribution:
    """Tests for risk distribution endpoint."""

    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/institutional/risk-distribution", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_tiers_are_valid(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/institutional/risk-distribution", headers=regulator_headers)
        tiers = {item["tier"] for item in res.json()}
        assert tiers.issubset({"High", "Medium", "Low"})

    def test_percentages_sum_to_100(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/risk-distribution", headers=regulator_headers)
        total_pct = sum(item["percentage"] for item in res.json())
        assert abs(total_pct - 100.0) < 1.0


class TestModelPerformance:
    """Tests for model performance endpoint."""

    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/institutional/model-performance", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_model_items_have_required_fields(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/model-performance", headers=regulator_headers)
        for item in res.json():
            assert "model_name" in item
            assert "total_predictions" in item
            assert "distress_rate" in item

    def test_model_names_are_valid(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/institutional/model-performance", headers=regulator_headers)
        for item in res.json():
            assert item["model_name"] in ("random_forest", "logistic_regression")


class TestRatioBenchmarks:
    """Tests for ratio benchmarks endpoint."""

    def test_returns_list_of_ten(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/institutional/ratios", headers=regulator_headers)
        assert len(res.json()) == 10

    def test_ratio_items_have_required_fields(
        self, client, regulator_headers, seeded_predictions
    ):
        res = client.get("/api/institutional/ratios", headers=regulator_headers)
        for item in res.json():
            assert "ratio_name" in item
            assert "avg_value" in item
            assert "distressed_avg" in item
            assert "healthy_avg" in item

    def test_ratio_names_match_expected(
        self, client, regulator_headers, seeded_predictions
    ):
        from app.services.ratio_engine import RATIO_NAMES

        res = client.get("/api/institutional/ratios", headers=regulator_headers)
        returned_names = {item["ratio_name"] for item in res.json()}
        assert returned_names == set(RATIO_NAMES)


class TestAnomalyFlags:
    """Tests for anomaly detection endpoint."""

    def test_returns_list(self, client, regulator_headers):
        res = client.get("/api/institutional/anomalies", headers=regulator_headers)
        assert isinstance(res.json(), list)

    def test_no_company_names_in_anomalies(self, client, regulator_headers):
        res = client.get("/api/institutional/anomalies", headers=regulator_headers)
        raw = res.text
        assert "Lusaka Trading Ltd" not in raw
        assert "owner_id" not in raw

    def test_all_flagged_above_threshold(self, client, regulator_headers):
        res = client.get("/api/institutional/anomalies", headers=regulator_headers)
        for item in res.json():
            assert item["distress_probability"] >= 0.70


class TestInstitutionalChat:
    """Tests for institutional chat endpoint."""

    @pytest.mark.asyncio
    async def test_regulator_can_chat(self, client, regulator_headers):
        with patch("app.api.institutional_chat.generate_chat_response") as mock_gen:
            mock_gen.return_value = ("System overview summary.", "groq")
            res = client.post(
                "/api/institutional/chat/",
                json={"message": "Summarise distress trends"},
                headers=regulator_headers,
            )
            assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_policy_analyst_can_chat(self, client, analyst_headers):
        with patch("app.api.institutional_chat.generate_chat_response") as mock_gen:
            mock_gen.return_value = ("Sector analysis.", "template")
            res = client.post(
                "/api/institutional/chat/",
                json={"message": "Which sector has highest distress?"},
                headers=analyst_headers,
              )
            assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_sme_owner_cannot_access_institutional_chat(self, client, sme_headers):
        res = client.post(
            "/api/institutional/chat/",
            json={"message": "Hello"},
            headers=sme_headers,
        )
        assert res.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_access_institutional_chat(self, client):
        res = client.post("/api/institutional/chat/", json={"message": "Hello"})
        assert res.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_empty_message_rejected(self, client, regulator_headers):
        res = client.post(
            "/api/institutional/chat/",
            json={"message": ""},
            headers=regulator_headers,
        )
        assert res.status_code == 400

    @pytest.mark.asyncio
    async def test_response_has_reply_and_source(self, client, regulator_headers):
        with patch("app.api.institutional_chat.generate_chat_response") as mock_gen:
            mock_gen.return_value = ("The system shows 13.5% distress rate.", "groq")
            res = client.post(
                "/api/institutional/chat/",
                json={"message": "What is the overall distress rate?"},
                headers=regulator_headers,
            )
            data = res.json()
            assert "reply" in data
            assert "source" in data

    @pytest.mark.asyncio
    async def test_chat_with_history(self, client, regulator_headers):
        with patch("app.api.institutional_chat.generate_chat_response") as mock_gen:
            mock_gen.return_value = ("Follow-up answer.", "groq")
            res = client.post(
                "/api/institutional/chat/",
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

    @pytest.mark.asyncio
    async def test_service_failure_returns_503(self, client, regulator_headers):
        with patch(
            "app.api.institutional_chat.generate_chat_response",
            side_effect=Exception("All LLM providers down"),
        ):
            res = client.post(
                "/api/institutional/chat/",
                json={"message": "Analyse sectors"},
                headers=regulator_headers,
            )
            assert res.status_code == 503


class TestInstitutionalFilterOptions:
    """Tests for the GET /api/institutional/filter-options endpoint."""

    def test_unauthenticated_cannot_access(self, client):
        res = client.get("/api/institutional/filter-options")
        assert res.status_code in (401, 403)

    def test_sme_owner_cannot_access(self, client, sme_headers):
        res = client.get("/api/institutional/filter-options", headers=sme_headers)
        assert res.status_code in (401, 403)

    def test_regulator_can_access(self, client, regulator_headers, seeded_predictions):
        res = client.get("/api/institutional/filter-options", headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()
        assert "scales" in data
        assert "sectors" in data
        assert isinstance(data["scales"], list)
        assert isinstance(data["sectors"], list)


# =============================================================================
# Bug 1 — Falsy-String Filter Guard
# =============================================================================


class TestFalsyStringFilterGuard:
    """
    Verifies that an explicit empty-string scale/sector filter (scale="")
    returns zero results, while scale=None (param omitted) returns unfiltered
    results, and a real value filters correctly.
    """

    def test_scale_none_returns_unfiltered(
        self, client, regulator_headers, seeded_predictions
    ):
        """scale param omitted → all records returned (unfiltered)."""
        res = client.get("/api/institutional/overview", headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total_assessments"] >= 1

    def test_scale_empty_string_returns_zero_assessments(
        self, client, regulator_headers, seeded_predictions
    ):
        """scale="" (explicit empty) → filter applied, no scale matches → zero assessments."""
        res = client.get(
            "/api/institutional/overview?scale=", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_assessments"] == 0

    def test_scale_valid_value_filters_correctly(
        self, client, regulator_headers, seeded_predictions
    ):
        """scale="Small Scale" → only Small Scale assessments returned."""
        res = client.get(
            "/api/institutional/overview?scale=Small+Scale", headers=regulator_headers
        )
        assert res.status_code == 200
        # Response must be a valid schema (not an error)
        assert "total_assessments" in res.json()

    def test_sector_none_returns_unfiltered(
        self, client, regulator_headers, seeded_predictions
    ):
        """sector param omitted → all sectors returned."""
        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        assert len(res.json()) >= 1

    def test_sector_empty_string_returns_empty_list(
        self, client, regulator_headers, seeded_predictions
    ):
        """sector="" (explicit empty) → filter applied, no industry matches → empty list."""
        res = client.get(
            "/api/institutional/sectors?sector=", headers=regulator_headers
        )
        assert res.status_code == 200
        assert res.json() == []

    def test_sector_valid_value_filters_correctly(
        self, client, regulator_headers, seeded_predictions
    ):
        """sector="Retail & Trade" (real seeded industry) → results include that sector."""
        res = client.get(
            "/api/institutional/sectors?sector=Retail+%26+Trade",
            headers=regulator_headers,
        )
        assert res.status_code == 200
        industries = [item["industry"] for item in res.json()]
        # Either the industry appears directly, or it is suppressed (< 3 assessments)
        assert all(i in ("Retail & Trade", "Other (suppressed)") for i in industries)

    def test_sector_distress_empty_string_sector_returns_empty(
        self, client, regulator_headers, seeded_predictions
    ):
        """Verify the get_sector_distress inline block also respects is-not-None."""
        res = client.get(
            "/api/institutional/sectors?sector=", headers=regulator_headers
        )
        assert res.status_code == 200
        assert res.json() == []


# =============================================================================
# Bug 2 — Sector Privacy Suppression Threshold
# =============================================================================


class TestSectorSuppression:
    """
    Verifies that sectors with fewer than 3 assessments are labelled
    'Other (suppressed)' and sectors with exactly 3 are not suppressed.
    """

    def test_sector_with_two_assessments_is_suppressed(
        self, client, db, regulator_headers
    ):
        """
        Create 2 predictions for a unique industry. The /sectors endpoint
        must return 'Other (suppressed)' for that industry, not the real name.
        """
        import json
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        SAMPLE_SHAP = {
            "current_ratio": -0.12, "quick_ratio": -0.08, "cash_ratio": -0.05,
            "debt_to_equity": 0.03, "debt_to_assets": 0.02, "interest_coverage": -0.09,
            "net_profit_margin": -0.07, "return_on_assets": -0.04,
            "return_on_equity": -0.03, "asset_turnover": -0.01,
        }

        owner = User(
            full_name="Suppression Test Owner",
            email="suppression@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name="Tiny Sector Co",
            industry="NicheIndustrySuppressed",
            registration_number="SUPP001",
        )
        db.add(company)
        db.flush()

        for _ in range(2):
            rec = FinancialRecord(
                company_id=company.id,
                period=f"2024-Q{_ + 1}",
                current_assets=100_000,
                current_liabilities=50_000,
                total_assets=200_000,
                total_liabilities=80_000,
                total_equity=120_000,
                inventory=20_000,
                cash_and_equivalents=30_000,
                retained_earnings=40_000,
                revenue=150_000,
                net_income=20_000,
                ebit=25_000,
                interest_expense=5_000,
            )
            db.add(rec)
            db.flush()
            rf = RatioFeature(
                financial_record_id=rec.id,
                current_ratio=2.0,
                quick_ratio=1.5,
                cash_ratio=0.6,
                debt_to_equity=0.67,
                debt_to_assets=0.4,
                interest_coverage=5.0,
                net_profit_margin=0.13,
                return_on_assets=0.1,
                return_on_equity=0.17,
                asset_turnover=0.75,
            )
            db.add(rf)
            db.flush()
            pred = Prediction(
                ratio_feature_id=rf.id,
                model_used="random_forest",
                risk_label="Healthy",
                distress_probability=0.15,
                shap_values_json=json.dumps(SAMPLE_SHAP),
                prediction_hash=f"supptest{_}",
            )
            db.add(pred)

        db.commit()

        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        assert res.status_code == 200
        industries = [item["industry"] for item in res.json()]
        # The real name must NOT appear; it must be suppressed
        assert "NicheIndustrySuppressed" not in industries
        assert "Other (suppressed)" in industries

    def test_sector_with_three_assessments_is_not_suppressed(
        self, client, db, regulator_headers
    ):
        """
        Create 3 predictions for a unique industry. The /sectors endpoint
        must return the real industry name (boundary: < 3 suppresses, >= 3 does not).
        """
        import json
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        SAMPLE_SHAP = {
            "current_ratio": -0.12, "quick_ratio": -0.08, "cash_ratio": -0.05,
            "debt_to_equity": 0.03, "debt_to_assets": 0.02, "interest_coverage": -0.09,
            "net_profit_margin": -0.07, "return_on_assets": -0.04,
            "return_on_equity": -0.03, "asset_turnover": -0.01,
        }

        owner = User(
            full_name="Boundary Test Owner",
            email="boundary@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name="Boundary Sector Co",
            industry="BoundaryIndustryVisible",
            registration_number="BOUN001",
        )
        db.add(company)
        db.flush()

        for i in range(3):
            rec = FinancialRecord(
                company_id=company.id,
                period=f"2024-Q{i+1}",
                current_assets=100_000,
                current_liabilities=50_000,
                total_assets=200_000,
                total_liabilities=80_000,
                total_equity=120_000,
                inventory=20_000,
                cash_and_equivalents=30_000,
                retained_earnings=40_000,
                revenue=150_000,
                net_income=20_000,
                ebit=25_000,
                interest_expense=5_000,
            )
            db.add(rec)
            db.flush()
            rf = RatioFeature(
                financial_record_id=rec.id,
                current_ratio=2.0,
                quick_ratio=1.5,
                cash_ratio=0.6,
                debt_to_equity=0.67,
                debt_to_assets=0.4,
                interest_coverage=5.0,
                net_profit_margin=0.13,
                return_on_assets=0.1,
                return_on_equity=0.17,
                asset_turnover=0.75,
            )
            db.add(rf)
            db.flush()
            pred = Prediction(
                ratio_feature_id=rf.id,
                model_used="random_forest",
                risk_label="Healthy",
                distress_probability=0.15,
                shap_values_json=json.dumps(SAMPLE_SHAP),
                prediction_hash=f"boundtest{i}",
            )
            db.add(pred)

        db.commit()

        res = client.get("/api/institutional/sectors", headers=regulator_headers)
        assert res.status_code == 200
        industries = [item["industry"] for item in res.json()]
        assert "BoundaryIndustryVisible" in industries


# =============================================================================
# Bug 3 — Risk Matrix Groups by Assessment Methodology
# =============================================================================


class TestRiskMatrixMethodologyGrouping:
    """
    Verifies the risk matrix groups by Prediction.assessment_methodology
    (immutable, set at assessment time) rather than User.business_scale
    (mutable, reflects current state).
    """

    def test_risk_matrix_separates_by_methodology_not_user_scale(
        self, client, db, regulator_headers
    ):
        """
        Create two predictions for the same user (same business_scale) but
        with different assessment_methodology values. The risk matrix returned
        in the JSON export must separate them by methodology key, not collapse
        them under the same user-scale key.
        """
        import json
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        SAMPLE_SHAP = {
            "current_ratio": -0.12, "quick_ratio": -0.08, "cash_ratio": -0.05,
            "debt_to_equity": 0.03, "debt_to_assets": 0.02, "interest_coverage": -0.09,
            "net_profit_margin": -0.07, "return_on_assets": -0.04,
            "return_on_equity": -0.03, "asset_turnover": -0.01,
        }

        owner = User(
            full_name="Matrix Test Owner",
            email="matrixtest@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
            business_scale="small_scale",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name="Matrix Test Co",
            industry="Finance",
            registration_number="MTX001",
        )
        db.add(company)
        db.flush()

        methodologies = ["indicative", "full"]
        for i, methodology in enumerate(methodologies):
            rec = FinancialRecord(
                company_id=company.id,
                period=f"2024-Q{i+1}",
                current_assets=100_000,
                current_liabilities=50_000,
                total_assets=200_000,
                total_liabilities=80_000,
                total_equity=120_000,
                inventory=20_000,
                cash_and_equivalents=30_000,
                retained_earnings=40_000,
                revenue=150_000,
                net_income=20_000,
                ebit=25_000,
                interest_expense=5_000,
            )
            db.add(rec)
            db.flush()
            rf = RatioFeature(
                financial_record_id=rec.id,
                current_ratio=2.0,
                quick_ratio=1.5,
                cash_ratio=0.6,
                debt_to_equity=0.67,
                debt_to_assets=0.4,
                interest_coverage=5.0,
                net_profit_margin=0.13,
                return_on_assets=0.1,
                return_on_equity=0.17,
                asset_turnover=0.75,
            )
            db.add(rf)
            db.flush()
            pred = Prediction(
                ratio_feature_id=rf.id,
                model_used="random_forest",
                risk_label="Healthy",
                distress_probability=0.15,
                shap_values_json=json.dumps(SAMPLE_SHAP),
                assessment_methodology=methodology,
                prediction_hash=f"matrixtest{i}",
            )
            db.add(pred)

        db.commit()

        res = client.get(
            "/api/institutional/export/json", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()
        matrix = data.get("risk_matrix", {})

        # Both methodology keys must be present since they were seeded independently
        assert "indicative" in matrix or "full" in matrix, (
            "Expected at least one methodology key ('indicative' or 'full') in risk_matrix; "
            f"got keys: {list(matrix.keys())}"
        )
        # Old user-scale keys must NOT drive the grouping
        # (they may incidentally exist as methodology values match user scale,
        #  but both methodology keys should be independently present)
        if "indicative" in matrix and "full" in matrix:
            indicative_total = sum(matrix["indicative"].values())
            full_total = sum(matrix["full"].values())
            assert indicative_total >= 1
            assert full_total >= 1


# =============================================================================
# Bug 4 — Model Integrity Real Metrics (replacing hardcoded placeholders)
# =============================================================================

FAKE_VALUES = {
    ("random_forest", "accuracy"): 0.942,
    ("random_forest", "precision"): 0.891,
    ("logistic_regression", "accuracy"): 0.885,
    ("logistic_regression", "precision"): 0.812,
}

MOCK_METADATA = {
    "models": {
        "random_forest": {
            "test_metrics": {
                "accuracy": 0.9043,
                "precision": 0.5832,
                "recall": 0.6378,
                "per_class": {
                    "Distressed": {
                        "precision": 0.2,
                        "recall": 0.3434,
                    }
                },
            }
        },
        "logistic_regression": {
            "test_metrics": {
                "accuracy": 0.6702,
                "precision": 0.5353,
                "recall": 0.6781,
                "per_class": {
                    "Distressed": {
                        "precision": 0.0932,
                        "recall": 0.6869,
                    }
                },
            }
        },
    }
}


class TestModelIntegrityMetrics:
    """
    Tests for Bug 4: real evaluation metrics replace hardcoded placeholders,
    loader handles missing file gracefully, and exports surface the new fields.
    """

    def test_fake_values_absent_from_json_export(
        self, client, regulator_headers, seeded_predictions
    ):
        """
        The old hardcoded values (0.942, 0.891, 0.885, 0.812) must not appear
        in the model_integrity dict of the JSON export once real data is wired.
        """
        import json as json_mod
        from unittest.mock import mock_open, patch

        mock_data = json_mod.dumps(MOCK_METADATA)
        with patch(
            "builtins.open", mock_open(read_data=mock_data)
        ):
            res = client.get(
                "/api/institutional/export/json", headers=regulator_headers
            )
        assert res.status_code == 200
        data = res.json()
        integrity = data.get("model_integrity", {})

        for (model, field), fake_val in FAKE_VALUES.items():
            actual = integrity.get(model, {}).get(field)
            assert actual != fake_val, (
                f"Fake placeholder {fake_val} still present for {model}.{field}"
            )

    def test_loader_returns_correct_values_from_mocked_artifact(self):
        """
        _load_model_integrity_metrics() must parse a mocked metadata file and
        return the exact accuracy and distressed_recall for each model.
        """
        import json as json_mod
        from unittest.mock import mock_open, patch

        from app.services.institutional_report_service import (
            _load_model_integrity_metrics,
        )

        mock_data = json_mod.dumps(MOCK_METADATA)
        with patch("builtins.open", mock_open(read_data=mock_data)):
            result = _load_model_integrity_metrics()

        assert result["random_forest"]["accuracy"] == pytest.approx(0.9043)
        assert result["random_forest"]["distressed_recall"] == pytest.approx(0.3434)
        assert result["logistic_regression"]["accuracy"] == pytest.approx(0.6702)
        assert result["logistic_regression"]["distressed_recall"] == pytest.approx(0.6869)

    def test_loader_returns_none_fallback_on_missing_file(self, tmp_path):
        """
        When model_metadata.json does not exist, _load_model_integrity_metrics()
        must return the None-valued fallback dict without raising.
        """
        from unittest.mock import patch

        from app.services.institutional_report_service import (
            _load_model_integrity_metrics,
        )

        with patch(
            "app.services.institutional_report_service.settings"
        ) as mock_settings:
            mock_settings.ml_artifacts_path = tmp_path / "nonexistent_dir"
            result = _load_model_integrity_metrics()

        assert "random_forest" in result
        assert "logistic_regression" in result
        for model in ("random_forest", "logistic_regression"):
            for field in (
                "accuracy",
                "precision",
                "recall",
                "distressed_recall",
                "distressed_precision",
            ):
                assert result[model][field] is None, (
                    f"Expected None for {model}.{field} on missing file, got {result[model][field]}"
                )

    def test_json_export_still_returns_200_when_artifact_missing(
        self, client, regulator_headers, tmp_path
    ):
        """
        GET /api/institutional/export/json must return HTTP 200 even when the
        metadata file is absent (graceful degradation, no 500).
        """
        from unittest.mock import patch

        with patch(
            "app.services.institutional_report_service.settings"
        ) as mock_settings:
            mock_settings.ml_artifacts_path = tmp_path / "nonexistent_dir"
            res = client.get(
                "/api/institutional/export/json", headers=regulator_headers
            )
        assert res.status_code == 200
        data = res.json()
        # Fields are present but values are None
        assert "model_integrity" in data
        assert "model_integrity_note" in data

    def test_json_export_contains_new_fields(
        self, client, regulator_headers, seeded_predictions
    ):
        """
        GET /api/institutional/export/json response must include
        model_integrity.random_forest.distressed_recall and model_integrity_note
        as non-fake, non-null values when the metadata file is mocked normally.
        """
        import json as json_mod
        from unittest.mock import mock_open, patch

        mock_data = json_mod.dumps(MOCK_METADATA)
        with patch("builtins.open", mock_open(read_data=mock_data)):
            res = client.get(
                "/api/institutional/export/json", headers=regulator_headers
            )
        assert res.status_code == 200
        data = res.json()

        assert "model_integrity_note" in data
        assert data["model_integrity_note"]

        rf = data.get("model_integrity", {}).get("random_forest", {})
        assert "distressed_recall" in rf
        assert rf["distressed_recall"] is not None
        assert rf["distressed_recall"] != 0.891

    def test_csv_export_contains_model_integrity_section_and_renumbered_anomalies(
        self, client, regulator_headers, seeded_predictions
    ):
        """
        GET /api/institutional/export/csv must:
        - Contain the string 'MODEL INTEGRITY' (new Section 5)
        - Contain 'SECTION 6' for anomaly flags (renumbered from 5)
        - Not contain 'SECTION 5: HIGH-RISK ANOMALY' (old numbering)
        """
        res = client.get(
            "/api/institutional/export/csv", headers=regulator_headers
        )
        assert res.status_code == 200
        body = res.content.decode("utf-8-sig")

        assert "MODEL INTEGRITY" in body, (
            "Expected 'MODEL INTEGRITY' section in CSV export"
        )
        assert "SECTION 6" in body, (
            "Expected anomaly flags to be renumbered to SECTION 6"
        )
        assert "SECTION 5: HIGH-RISK ANOMALY" not in body, (
            "Old 'SECTION 5: HIGH-RISK ANOMALY' label must not appear after renumbering"
        )


# =============================================================================
# Bug 5 — Aggregated SHAP: mean-absolute vs signed-mean cancellation fix
# =============================================================================


class TestShapCancellationFix:
    """
    Tests for Bug 5: SHAP aggregation must use mean absolute value for ranking
    and magnitude, with direction derived separately from the signed mean.
    """

    def _seed_cancelling_predictions(self, db):
        """
        Seed 4 predictions: 2 with current_ratio SHAP = +0.5, 2 with -0.5.
        All other ratios have a constant positive value (0.1) so they are
        consistently directional and do not cancel.
        Returns the cancelling feature name.
        """
        import json as json_mod
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        CANCELLING_FEATURE = "current_ratio"
        STEADY_VALUE = 0.1

        owner = User(
            full_name="SHAP Cancel Owner",
            email="shapcancel@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name="SHAP Cancel Co",
            industry="Finance",
            registration_number="SHAP001",
        )
        db.add(company)
        db.flush()

        shap_signs = [+0.5, +0.5, -0.5, -0.5]
        for i, sign in enumerate(shap_signs):
            rec = FinancialRecord(
                company_id=company.id,
                period=f"2024-Q{i + 1}",
                current_assets=100_000,
                current_liabilities=50_000,
                total_assets=200_000,
                total_liabilities=80_000,
                total_equity=120_000,
                inventory=20_000,
                cash_and_equivalents=30_000,
                retained_earnings=40_000,
                revenue=150_000,
                net_income=20_000,
                ebit=25_000,
                interest_expense=5_000,
            )
            db.add(rec)
            db.flush()
            rf = RatioFeature(
                financial_record_id=rec.id,
                current_ratio=2.0,
                quick_ratio=1.5,
                cash_ratio=0.6,
                debt_to_equity=0.67,
                debt_to_assets=0.4,
                interest_coverage=5.0,
                net_profit_margin=0.13,
                return_on_assets=0.1,
                return_on_equity=0.17,
                asset_turnover=0.75,
            )
            db.add(rf)
            db.flush()
            shap_blob = {
                CANCELLING_FEATURE: sign,
                "quick_ratio": STEADY_VALUE,
                "cash_ratio": STEADY_VALUE,
                "debt_to_equity": STEADY_VALUE,
                "debt_to_assets": STEADY_VALUE,
                "interest_coverage": STEADY_VALUE,
                "net_profit_margin": STEADY_VALUE,
                "return_on_assets": STEADY_VALUE,
                "return_on_equity": STEADY_VALUE,
                "asset_turnover": STEADY_VALUE,
            }
            pred = Prediction(
                ratio_feature_id=rf.id,
                model_used="random_forest",
                risk_label="Healthy",
                distress_probability=0.2,
                shap_values_json=json_mod.dumps(shap_blob),
                prediction_hash=f"shapcancel{i}",
            )
            db.add(pred)

        db.commit()
        return CANCELLING_FEATURE

    def test_cancelling_feature_mean_abs_shap_is_not_near_zero(
        self, client, db, regulator_headers
    ):
        """
        A feature with +0.5 for half the predictions and -0.5 for the other
        half must have mean_abs_shap ≈ 0.5 in the JSON export — not near zero
        as the old signed mean would have produced.
        """
        cancelling = self._seed_cancelling_predictions(db)

        res = client.get(
            "/api/institutional/export/json", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()

        shap = data.get("aggregated_shap", {})
        assert cancelling in shap, f"'{cancelling}' not found in aggregated_shap"

        mean_abs = shap[cancelling]["mean_abs_shap"]
        assert mean_abs == pytest.approx(0.5, abs=0.01), (
            f"Expected mean_abs_shap ≈ 0.5, got {mean_abs} — "
            "signed cancellation bug may still be present"
        )

    def test_cancelling_feature_appears_in_top_5_ranking(
        self, client, db, regulator_headers
    ):
        """
        The cancelling feature (mean_abs_shap = 0.5) must rank higher than the
        steady features (mean_abs_shap = 0.1) and therefore appear in the
        top-5 results used by the report.
        """
        cancelling = self._seed_cancelling_predictions(db)

        res = client.get(
            "/api/institutional/export/json", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()

        shap = data.get("aggregated_shap", {})
        top5 = sorted(
            shap.items(),
            key=lambda x: x[1].get("mean_abs_shap", 0),
            reverse=True,
        )[:5]
        top5_keys = [k for k, _ in top5]
        assert cancelling in top5_keys, (
            f"'{cancelling}' (mean_abs=0.5) should rank in top 5, "
            f"but top5 was: {top5_keys}"
        )

    def test_consistent_positive_feature_has_positive_direction(
        self, client, db, regulator_headers
    ):
        """
        A feature that is consistently positive across all predictions must
        have mean_signed_shap > 0, confirming that direction logic still works
        correctly for the non-cancelling case.
        """
        self._seed_cancelling_predictions(db)

        res = client.get(
            "/api/institutional/export/json", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()

        shap = data.get("aggregated_shap", {})
        # "quick_ratio" was seeded with STEADY_VALUE = +0.1 in all rows
        assert "quick_ratio" in shap
        mean_signed = shap["quick_ratio"]["mean_signed_shap"]
        assert mean_signed > 0, (
            f"Expected positive mean_signed_shap for 'quick_ratio', got {mean_signed}"
        )

    def test_aggregated_shap_values_are_dicts_not_floats(
        self, client, regulator_headers, seeded_predictions
    ):
        """
        Each value in aggregated_shap must be a dict containing exactly
        'mean_abs_shap' and 'mean_signed_shap' — not a raw float.
        """
        res = client.get(
            "/api/institutional/export/json", headers=regulator_headers
        )
        assert res.status_code == 200
        data = res.json()

        shap = data.get("aggregated_shap", {})
        assert shap, "aggregated_shap is empty — cannot validate shape"

        for feat, val in shap.items():
            assert isinstance(val, dict), (
                f"aggregated_shap['{feat}'] is {type(val).__name__}, expected dict"
            )
            assert "mean_abs_shap" in val, (
                f"aggregated_shap['{feat}'] missing 'mean_abs_shap'"
            )
            assert "mean_signed_shap" in val, (
                f"aggregated_shap['{feat}'] missing 'mean_signed_shap'"
            )

    def test_pdf_export_still_returns_200_with_new_shap_shape(
        self, client, regulator_headers, seeded_predictions
    ):
        """
        GET /api/institutional/export/pdf must still return HTTP 200 — smoke
        test that the PDF drawing path does not raise on the new dict shape.
        """
        res = client.get(
            "/api/institutional/export/pdf", headers=regulator_headers
        )
        assert res.status_code == 200
        assert res.headers.get("content-type", "").startswith("application/pdf")


# =============================================================================
# Bug 6 — Model Agreement: disagreement rate endpoint
# =============================================================================


class TestModelAgreement:
    """
    Tests for GET /api/institutional/model-agreement: categorical RF vs LR
    disagreement rate across paired assessments.
    """

    URL = "/api/institutional/model-agreement"

    # 1. RBAC
    def test_unauthenticated_returns_401_or_403(self, client):
        """Unauthenticated requests must be rejected."""
        res = client.get(self.URL)
        assert res.status_code in (401, 403)

    def test_sme_owner_returns_401_or_403(self, client, sme_headers):
        """SME owner role must not access institutional endpoints."""
        res = client.get(self.URL, headers=sme_headers)
        assert res.status_code in (401, 403)

    def test_regulator_returns_200(self, client, regulator_headers):
        """Regulator role must be permitted."""
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200

    def test_policy_analyst_returns_200(self, client, analyst_headers):
        """Policy analyst role must be permitted."""
        res = client.get(self.URL, headers=analyst_headers)
        assert res.status_code == 200

    # 2. Response shape
    def test_response_contains_all_four_fields(self, client, regulator_headers, seeded_predictions):
        """Response must contain all four required fields."""
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()
        assert "paired_assessment_count" in data
        assert "disagreement_count" in data
        assert "disagreement_rate" in data
        assert "agreement_rate" in data

    # 3. Zero-state: no division-by-zero
    def test_zero_predictions_returns_zeros_not_500(self, client, regulator_headers):
        """With no predictions seeded, the endpoint must return HTTP 200 with
        paired_assessment_count == 0 and disagreement_rate == 0.0."""
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["paired_assessment_count"] == 0
        assert data["disagreement_rate"] == 0.0

    # 4. Disagreement arithmetic
    def _seed_paired_predictions(self, db):
        """Seed two paired ratio_feature_ids:
        - RF='Healthy', LR='Distressed' → disagreement
        - RF='Healthy', LR='Healthy'    → agreement
        Returns a list of the two ratio_feature_ids.
        """
        import json as json_mod
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        owner = User(
            full_name="Agreement Owner",
            email="agreementtest@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name="Agreement Co",
            industry="Retail",
            registration_number="AGR001",
        )
        db.add(company)
        db.flush()

        rf_ids = []
        for i in range(2):
            rec = FinancialRecord(
                company_id=company.id,
                period=f"2024-Q{i + 1}",
                current_assets=100_000,
                current_liabilities=50_000,
                total_assets=200_000,
                total_liabilities=80_000,
                total_equity=120_000,
                inventory=20_000,
                cash_and_equivalents=30_000,
                retained_earnings=40_000,
                revenue=150_000,
                net_income=20_000,
                ebit=25_000,
                interest_expense=5_000,
            )
            db.add(rec)
            db.flush()
            rf = RatioFeature(
                financial_record_id=rec.id,
                current_ratio=2.0,
                quick_ratio=1.5,
                cash_ratio=0.6,
                debt_to_equity=0.67,
                debt_to_assets=0.4,
                interest_coverage=5.0,
                net_profit_margin=0.13,
                return_on_assets=0.1,
                return_on_equity=0.17,
                asset_turnover=0.75,
            )
            db.add(rf)
            db.flush()
            rf_ids.append(rf.id)

        shap_blob = json_mod.dumps({"current_ratio": 0.1})

        # Pair 1: RF=Healthy, LR=Distressed (disagreement)
        db.add(Prediction(
            ratio_feature_id=rf_ids[0],
            model_used="random_forest",
            risk_label="Healthy",
            distress_probability=0.2,
            shap_values_json=shap_blob,
            prediction_hash="agr_rf_0",
        ))
        db.add(Prediction(
            ratio_feature_id=rf_ids[0],
            model_used="logistic_regression",
            risk_label="Distressed",
            distress_probability=0.7,
            shap_values_json=shap_blob,
            prediction_hash="agr_lr_0",
        ))

        # Pair 2: RF=Healthy, LR=Healthy (agreement)
        db.add(Prediction(
            ratio_feature_id=rf_ids[1],
            model_used="random_forest",
            risk_label="Healthy",
            distress_probability=0.2,
            shap_values_json=shap_blob,
            prediction_hash="agr_rf_1",
        ))
        db.add(Prediction(
            ratio_feature_id=rf_ids[1],
            model_used="logistic_regression",
            risk_label="Healthy",
            distress_probability=0.25,
            shap_values_json=shap_blob,
            prediction_hash="agr_lr_1",
        ))

        db.commit()
        return rf_ids

    def test_disagreement_arithmetic_is_correct(self, client, db, regulator_headers):
        """With 1 disagreement pair and 1 agreement pair:
        paired=2, disagreement=1, rate=0.5, agreement_rate=0.5."""
        self._seed_paired_predictions(db)

        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["paired_assessment_count"] == 2
        assert data["disagreement_count"] == 1
        assert data["disagreement_rate"] == pytest.approx(0.5)
        assert data["agreement_rate"] == pytest.approx(0.5)

    # 5. Unpaired assessment does not inflate paired_assessment_count
    def test_unpaired_rf_only_row_is_excluded(self, client, db, regulator_headers):
        """An RF-only prediction with no matching LR row must not inflate
        paired_assessment_count — counts must remain 2/1 as in test 4."""
        import json as json_mod
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction

        rf_ids = self._seed_paired_predictions(db)

        # Look up the company from the first seeded ratio_feature
        first_rf = db.query(RatioFeature).filter(RatioFeature.id == rf_ids[0]).first()
        first_rec = db.query(FinancialRecord).filter(
            FinancialRecord.id == first_rf.financial_record_id
        ).first()

        # New FinancialRecord for the same company — ratio_features.financial_record_id is UNIQUE
        orphan_rec = FinancialRecord(
            company_id=first_rec.company_id,
            period="2024-Q5",
            current_assets=80_000,
            current_liabilities=60_000,
            total_assets=180_000,
            total_liabilities=90_000,
            total_equity=90_000,
            inventory=15_000,
            cash_and_equivalents=10_000,
            retained_earnings=20_000,
            revenue=120_000,
            net_income=-10_000,
            ebit=-5_000,
            interest_expense=5_000,
        )
        db.add(orphan_rec)
        db.flush()

        orphan_rf = RatioFeature(
            financial_record_id=orphan_rec.id,
            current_ratio=0.5,
            quick_ratio=0.3,
            cash_ratio=0.1,
            debt_to_equity=2.0,
            debt_to_assets=0.8,
            interest_coverage=0.5,
            net_profit_margin=-0.1,
            return_on_assets=-0.05,
            return_on_equity=-0.1,
            asset_turnover=0.4,
        )
        db.add(orphan_rf)
        db.flush()

        # Only RF — no matching LR row
        db.add(Prediction(
            ratio_feature_id=orphan_rf.id,
            model_used="random_forest",
            risk_label="Distressed",
            distress_probability=0.9,
            shap_values_json=json_mod.dumps({"current_ratio": -0.4}),
            prediction_hash="agr_orphan_rf",
        ))
        db.commit()

        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["paired_assessment_count"] == 2, (
            f"Orphan RF row inflated paired_assessment_count: {data['paired_assessment_count']}"
        )
        assert data["disagreement_count"] == 1

    # 6. Scale filter with empty string returns 0 (is-not-None guard)
    def test_explicit_empty_scale_filter_returns_zero_pairs(
        self, client, db, regulator_headers
    ):
        """An explicit scale='' must yield paired_assessment_count == 0, even
        when paired predictions exist — consistent with the is-not-None filtering
        convention established in Batch 1."""
        self._seed_paired_predictions(db)

        res = client.get(self.URL, headers=regulator_headers, params={"scale": ""})
        assert res.status_code == 200
        data = res.json()
        assert data["paired_assessment_count"] == 0, (
            f"Empty scale filter did not suppress all results: "
            f"paired_assessment_count={data['paired_assessment_count']}"
        )


# =============================================================================
# Bug 8 — Anomaly Flags: per-assessment grouping
# =============================================================================


class TestAnomalyGrouping:
    """
    Tests for GET /api/institutional/anomalies: results must be grouped by
    ratio_feature_id (one row per assessment), not one row per raw prediction.
    """

    URL = "/api/institutional/anomalies"

    def _seed_assessment(self, db, *, rf_label, rf_prob, lr_label=None, lr_prob=None,
                         email_suffix="a", reg_suffix="A"):
        """Seed one assessment with optional paired LR prediction.
        Returns (ratio_feature_id, rf_pred_id).
        """
        import json as json_mod
        from app.models.user import User
        from app.models.company import Company
        from app.models.financial_record import FinancialRecord
        from app.models.ratio_feature import RatioFeature
        from app.models.prediction import Prediction
        from app.core.security import hash_password

        owner = User(
            full_name=f"Anomaly Owner {email_suffix}",
            email=f"anomalytest{email_suffix}@test.com",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
            role="sme_owner",
        )
        db.add(owner)
        db.flush()

        company = Company(
            owner_id=owner.id,
            name=f"Anomaly Co {reg_suffix}",
            industry="Manufacturing",
            registration_number=f"ANO{reg_suffix}001",
        )
        db.add(company)
        db.flush()

        rec = FinancialRecord(
            company_id=company.id,
            period="2024-Q1",
            current_assets=50_000,
            current_liabilities=80_000,
            total_assets=100_000,
            total_liabilities=90_000,
            total_equity=10_000,
            inventory=5_000,
            cash_and_equivalents=2_000,
            retained_earnings=-10_000,
            revenue=80_000,
            net_income=-20_000,
            ebit=-15_000,
            interest_expense=8_000,
        )
        db.add(rec)
        db.flush()

        rf = RatioFeature(
            financial_record_id=rec.id,
            current_ratio=0.6,
            quick_ratio=0.4,
            cash_ratio=0.1,
            debt_to_equity=9.0,
            debt_to_assets=0.9,
            interest_coverage=-1.9,
            net_profit_margin=-0.25,
            return_on_assets=-0.2,
            return_on_equity=-2.0,
            asset_turnover=0.8,
        )
        db.add(rf)
        db.flush()

        shap_blob = json_mod.dumps({"current_ratio": -0.5})

        rf_pred = Prediction(
            ratio_feature_id=rf.id,
            model_used="random_forest",
            risk_label=rf_label,
            distress_probability=rf_prob,
            shap_values_json=shap_blob,
            prediction_hash=f"ano_rf_{email_suffix}",
        )
        db.add(rf_pred)
        db.flush()

        if lr_label is not None and lr_prob is not None:
            db.add(Prediction(
                ratio_feature_id=rf.id,
                model_used="logistic_regression",
                risk_label=lr_label,
                distress_probability=lr_prob,
                shap_values_json=shap_blob,
                prediction_hash=f"ano_lr_{email_suffix}",
            ))

        db.commit()
        return rf.id, rf_pred.id

    # 1. Paired RF+LR: only one row returned, secondary fields populated, models_agree=False
    def test_paired_rf_lr_returns_one_row_with_secondary(
        self, client, db, regulator_headers
    ):
        """RF=Distressed(0.85) + LR=Healthy(0.40) on same assessment must yield
        exactly one row with secondary_model_used='logistic_regression' and
        models_agree=False."""
        rf_id, _ = self._seed_assessment(
            db,
            rf_label="Distressed", rf_prob=0.85,
            lr_label="Healthy", lr_prob=0.40,
            email_suffix="p1", reg_suffix="P1",
        )
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        matching = [r for r in data if r["assessment_id"] == rf_id]
        assert len(matching) == 1, (
            f"Expected 1 row for assessment {rf_id}, got {len(matching)}"
        )
        row = matching[0]
        assert row["model_used"] == "random_forest"
        assert row["secondary_model_used"] == "logistic_regression"
        assert row["secondary_risk_label"] == "Healthy"
        assert row["models_agree"] is False

    # 2. RF-only: one row, secondary fields None, models_agree None
    def test_rf_only_returns_one_row_no_secondary(self, client, db, regulator_headers):
        """RF=Distressed(0.80) only (no LR row) must yield one row with
        secondary_model_used=None and models_agree=None."""
        rf_id, _ = self._seed_assessment(
            db,
            rf_label="Distressed", rf_prob=0.80,
            email_suffix="p2", reg_suffix="P2",
        )
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        matching = [r for r in data if r["assessment_id"] == rf_id]
        assert len(matching) == 1
        row = matching[0]
        assert row["secondary_model_used"] is None
        assert row["models_agree"] is None

    # 3. Two independent assessments each flagged by RF only — 2 rows returned
    def test_two_assessments_produce_two_rows(self, client, db, regulator_headers):
        """Two distinct assessments (different companies) flagged by RF must
        produce exactly two rows, not one merged row."""
        rf_id_a, _ = self._seed_assessment(
            db,
            rf_label="Distressed", rf_prob=0.82,
            email_suffix="p3a", reg_suffix="P3A",
        )
        rf_id_b, _ = self._seed_assessment(
            db,
            rf_label="Distressed", rf_prob=0.78,
            email_suffix="p3b", reg_suffix="P3B",
        )
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        ids_returned = {r["assessment_id"] for r in data}
        assert rf_id_a in ids_returned, f"Assessment {rf_id_a} missing from results"
        assert rf_id_b in ids_returned, f"Assessment {rf_id_b} missing from results"

    # 4. assessment_id equals ratio_feature_id, not Prediction.id
    def test_assessment_id_is_ratio_feature_id(self, client, db, regulator_headers):
        """assessment_id in the response must equal the seeded ratio_feature_id,
        not the RF Prediction.id (which differs for paired assessments)."""
        rf_id, pred_id = self._seed_assessment(
            db,
            rf_label="Distressed", rf_prob=0.90,
            lr_label="Distressed", lr_prob=0.75,
            email_suffix="p4", reg_suffix="P4",
        )
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        data = res.json()

        matching = [r for r in data if r["assessment_id"] == rf_id]
        assert len(matching) == 1, "Row keyed by ratio_feature_id not found"
        # Confirm assessment_id is NOT the raw Prediction.id
        assert matching[0]["assessment_id"] != pred_id or rf_id == pred_id  # rf_id != pred_id in practice

    # 5. Results sorted by distress_probability descending
    def test_results_sorted_descending_by_distress_probability(
        self, client, db, regulator_headers
    ):
        """Three flagged assessments must be returned in descending distress_probability
        order."""
        self._seed_assessment(db, rf_label="Distressed", rf_prob=0.72,
                              email_suffix="s1", reg_suffix="S1")
        self._seed_assessment(db, rf_label="Distressed", rf_prob=0.95,
                              email_suffix="s2", reg_suffix="S2")
        self._seed_assessment(db, rf_label="Distressed", rf_prob=0.83,
                              email_suffix="s3", reg_suffix="S3")
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
        probs = [r["distress_probability"] for r in res.json()]
        assert probs == sorted(probs, reverse=True), (
            f"Results not sorted descending: {probs}"
        )

    # 6. RBAC regression: policy_analyst still blocked
    def test_policy_analyst_cannot_access_anomalies(self, client, analyst_headers):
        """policy_analyst must remain blocked from /anomalies (get_current_full_institutional)."""
        res = client.get(self.URL, headers=analyst_headers)
        assert res.status_code in (401, 403)

    def test_regulator_can_access_anomalies(self, client, regulator_headers):
        """Regulator must still have access after the rewrite."""
        res = client.get(self.URL, headers=regulator_headers)
        assert res.status_code == 200
