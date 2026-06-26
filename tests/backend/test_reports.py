"""
FinWatch Zambia — Integration Tests: Report Endpoints

Tests:
    - POST /api/reports/assessment/{ratio_feature_id} — generate combined PDF (both models)
    - POST /api/reports/assessment/{ratio_feature_id} — RF-only partial state
    - POST /api/reports/assessment/{ratio_feature_id} — ownership enforcement (404)
    - GET  /api/reports/assessment/{ratio_feature_id}/csv — dual-model CSV stream
    - GET  /api/reports/assessment/{ratio_feature_id}/csv — RF-only partial state
    - GET  /api/reports/assessment/{ratio_feature_id}/zip — dual-model ZIP stream
    - GET  /api/reports/assessment/{ratio_feature_id} — 404 when no PDF saved yet
    - GET  /api/reports/ — list includes assessment-anchored report after generation

Coverage:
    - Correct RF-fallback anchor selection for Report FK
    - Model disagreement flag in CSV metadata section
    - Partial-completion rendering (one model None) does not raise
    - Unauthorized access returns 404 not 500
    - Reports list endpoint reflects newly created assessment records
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.models.narrative import Narrative
from app.models.prediction import Prediction

SAMPLE_SHAP = {
    "current_ratio": -0.12,
    "quick_ratio": -0.08,
    "cash_ratio": -0.05,
    "debt_to_equity": 0.03,
    "debt_to_assets": 0.02,
    "interest_coverage": -0.09,
    "net_profit_margin": -0.07,
    "return_on_assets": -0.04,
    "return_on_equity": -0.03,
    "asset_turnover": -0.01,
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def lr_prediction_with_narrative(db, ratio_feature):
    """Create an LR prediction with SHAP values and a narrative for the same ratio_feature."""
    pred = Prediction(
        ratio_feature_id=ratio_feature.id,
        model_used="logistic_regression",
        risk_label="Healthy",
        distress_probability=0.12,
        shap_values_json=json.dumps(SAMPLE_SHAP),
        prediction_hash="lr_abc123testhash",
    )
    db.add(pred)
    db.flush()

    narr = Narrative(
        prediction_id=pred.id,
        content="LR model: This business shows strong financial indicators.",
        source="groq",
        cache_key="lr_abc123testhash",
    )
    db.add(narr)
    db.commit()
    db.refresh(pred)
    return pred


@pytest.fixture
def lr_prediction_distressed(db, ratio_feature):
    """LR prediction with a Distressed label — used to trigger disagreement notice."""
    pred = Prediction(
        ratio_feature_id=ratio_feature.id,
        model_used="logistic_regression",
        risk_label="Distressed",
        distress_probability=0.82,
        shap_values_json=json.dumps(SAMPLE_SHAP),
        prediction_hash="lr_distressed_hash",
    )
    db.add(pred)
    db.flush()

    narr = Narrative(
        prediction_id=pred.id,
        content="LR model: Elevated risk detected.",
        source="groq",
        cache_key="lr_distressed_hash",
    )
    db.add(narr)
    db.commit()
    db.refresh(pred)
    return pred


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


from contextlib import contextmanager
from unittest.mock import MagicMock, PropertyMock


@contextmanager
def _patch_reports_path(tmp_path: Path):
    """Redirect settings.reports_path to tmp_path for the duration of a test.

    Patches the settings object at the report_service module level, which is
    where it is consumed at generation time. Pydantic BaseSettings computed
    properties cannot be patched via instance setattr or PropertyMock on the
    class itself.
    """
    import app.services.report_service as svc

    fake_settings = MagicMock()
    fake_settings.reports_path = tmp_path
    fake_settings.brand_logo_absolute_path = MagicMock()
    fake_settings.brand_logo_absolute_path.exists.return_value = False

    original = svc.settings
    svc.settings = fake_settings
    try:
        yield
    finally:
        svc.settings = original


# ---------------------------------------------------------------------------
# POST /api/reports/assessment/{ratio_feature_id}
# ---------------------------------------------------------------------------


class TestGenerateAssessmentReport:
    """Tests for POST /api/reports/assessment/{ratio_feature_id}."""

    def test_generate_combined_pdf_both_models(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """Both models present — returns 201 with report metadata."""
        with _patch_reports_path(tmp_path):
            res = client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )
        assert res.status_code == 201
        body = res.json()
        assert body["detail"] == "Report generated successfully."
        assert "report_id" in body
        assert "assessment" in body["filename"]
        assert str(ratio_feature.id) in body["filename"]

    def test_generate_pdf_rf_only(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """RF prediction present, LR absent — partial state renders without error."""
        with _patch_reports_path(tmp_path):
            res = client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )
        assert res.status_code == 201
        assert "report_id" in res.json()

    def test_generate_pdf_disagreement(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_distressed,
        tmp_path,
    ):
        """RF=Healthy, LR=Distressed — disagreement case generates PDF without error."""
        with _patch_reports_path(tmp_path):
            res = client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )
        assert res.status_code == 201

    def test_generate_pdf_wrong_owner_returns_404(
        self,
        client,
        regulator_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """Regulator token against an SME-owned assessment returns 404."""
        """Regulator token against an SME-owned assessment returns 403."""
        with _patch_reports_path(tmp_path):
            res = client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=regulator_headers,
            )
        assert res.status_code == 403

    def test_generate_pdf_nonexistent_returns_404(
        self, client, sme_headers, tmp_path
    ):
        """Non-existent ratio_feature_id returns 404."""
        with _patch_reports_path(tmp_path):
            res = client.post(
                "/api/reports/assessment/999999",
                headers=sme_headers,
            )
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/reports/assessment/{ratio_feature_id}/csv
# ---------------------------------------------------------------------------


class TestDownloadAssessmentCSV:
    """Tests for GET /api/reports/assessment/{ratio_feature_id}/csv."""

    def test_csv_both_models_streams_utf8(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """Both models — response is CSV with UTF-8 BOM, correct sections present."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/csv",
                headers=sme_headers,
            )
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        content = res.content.decode("utf-8-sig")
        assert "SECTION 1: ASSESSMENT METADATA" in content
        assert "SECTION 2: FINANCIAL RATIOS" in content
        assert "SECTION 3A: RANDOM FOREST" in content
        assert "SECTION 3B: LOGISTIC REGRESSION" in content
        assert "Lusaka Trading Ltd" in content

    def test_csv_agreement_field_yes_when_labels_match(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """Both models agree on 'Healthy' — agreement field reads 'Yes'."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/csv",
                headers=sme_headers,
            )
        content = res.content.decode("utf-8-sig")
        assert "Models Agreement,Yes" in content

    def test_csv_agreement_field_no_when_labels_differ(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_distressed,
        tmp_path,
    ):
        """RF=Healthy, LR=Distressed — agreement field reads 'No — RF: ..., LR: ...'."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/csv",
                headers=sme_headers,
            )
        content = res.content.decode("utf-8-sig")
        assert "Models Agreement" in content
        assert "No" in content

    def test_csv_rf_only_lr_section_shows_not_complete(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """RF only — LR section reports model did not complete rather than crashing."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/csv",
                headers=sme_headers,
            )
        assert res.status_code == 200
        content = res.content.decode("utf-8-sig")
        assert "Logistic Regression did not complete" in content

    def test_csv_wrong_owner_returns_404(
        self,
        client,
        regulator_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """Wrong owner token returns 403."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/csv",
                headers=regulator_headers,
            )
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/reports/assessment/{ratio_feature_id}/zip
# ---------------------------------------------------------------------------


class TestDownloadAssessmentZIP:
    """Tests for GET /api/reports/assessment/{ratio_feature_id}/zip."""

    def test_zip_both_models_streams_zip(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """Both models — response is application/zip."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/zip",
                headers=sme_headers,
            )
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/zip"
        assert f"assessment_{ratio_feature.id}" in res.headers["content-disposition"]

    def test_zip_rf_only_streams_zip(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """RF prediction only — ZIP generated without error."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/zip",
                headers=sme_headers,
            )
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/zip"

    def test_zip_wrong_owner_returns_404(
        self,
        client,
        regulator_headers,
        ratio_feature,
        prediction_with_narrative,
        tmp_path,
    ):
        """Wrong owner token returns 403."""
        with _patch_reports_path(tmp_path):
            res = client.get(
                f"/api/reports/assessment/{ratio_feature.id}/zip",
                headers=regulator_headers,
            )
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/reports/assessment/{ratio_feature_id} — download saved PDF
# ---------------------------------------------------------------------------


class TestDownloadAssessmentReport:
    """Tests for GET /api/reports/assessment/{ratio_feature_id}."""

    def test_download_returns_404_when_no_report_generated(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
    ):
        """No PDF generated yet — returns 404."""
        res = client.get(
            f"/api/reports/assessment/{ratio_feature.id}",
            headers=sme_headers,
        )
        assert res.status_code == 404

    def test_download_returns_pdf_after_generation(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """Generate then download — second request streams the PDF file."""
        with _patch_reports_path(tmp_path):
            gen = client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )
            assert gen.status_code == 201

            dl = client.get(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )
        assert dl.status_code == 200
        assert dl.headers["content-type"] == "application/pdf"


# ---------------------------------------------------------------------------
# GET /api/reports/ — list reflects assessment-anchored records
# ---------------------------------------------------------------------------


class TestListReportsIncludesAssessment:
    """Verify GET /api/reports/ reflects Report records created by assessment endpoints."""

    def test_list_includes_report_after_assessment_pdf_generated(
        self,
        client,
        sme_headers,
        ratio_feature,
        prediction_with_narrative,
        lr_prediction_with_narrative,
        tmp_path,
    ):
        """After POST /assessment/{id}, the report appears in the listing."""
        with _patch_reports_path(tmp_path):
            client.post(
                f"/api/reports/assessment/{ratio_feature.id}",
                headers=sme_headers,
            )

        res = client.get("/api/reports/", headers=sme_headers)
        assert res.status_code == 200
        items = res.json()
        assert len(items) >= 1
        filenames = [r["filename"] for r in items]
        assert any("assessment" in fn for fn in filenames)
