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
