"""
FinWatch Zambia - Unit Tests: ML Service

Tests:
    - Model loading
    - Inference interface
    - Error handling
    - Prediction output contract

Note: Uses simulated sklearn models - no artifacts required
"""

import pytest
from unittest.mock import MagicMock, patch
import numpy as np

from app.services.ml_service import (
    predict,
    is_model_loaded,
    get_available_models,
    ratios_to_feature_vector,
    SUPPORTED_MODELS,
    DISTRESS_CLASS_INDEX,
)
from .conftest import SAMPLE_RATIOS


DISTRESSED_RATIOS = {
    "current_ratio": 0.4,
    "quick_ratio": 0.15,
    "cash_ratio": 0.05,
    "debt_to_equity": 5.25,
    "debt_to_assets": 0.84,
    "interest_coverage": -0.6,
    "net_profit_margin": -0.533,
    "return_on_assets": -0.16,
    "return_on_equity": -1.0,
    "asset_turnover": 0.3,
}


class TestConstants:
    """Tests for ML service constants."""
    def test_distress_class_index_is_one(self):
        """Class 1 must always correspond to Distressed — training assumption."""
        assert DISTRESS_CLASS_INDEX == 1

    def test_supported_models_contains_both(self):
        assert "random_forest" in SUPPORTED_MODELS
        assert "logistic_regression" in SUPPORTED_MODELS

    def test_supported_models_has_exactly_two(self):
        assert len(SUPPORTED_MODELS) == 2


class TestRatiosToFeatureVector:
    """Tests for ratio to feature vector conversion."""
    def test_returns_list_of_ten_floats(self):
        vec = ratios_to_feature_vector(SAMPLE_RATIOS)
        assert isinstance(vec, list)
        assert len(vec) == 10
        assert all(isinstance(v, float) for v in vec)

    def test_order_matches_ratio_names(self):
        from app.services.ratio_engine import RATIO_NAMES
        vec = ratios_to_feature_vector(SAMPLE_RATIOS)
        for i, name in enumerate(RATIO_NAMES):
            assert abs(vec[i] - float(SAMPLE_RATIOS[name])) < 1e-9


class TestModelRegistryEmpty:
    """Tests for model registry when empty."""
    def test_model_not_loaded_without_artifacts(self):
        """Without calling load_models(), models should not be in registry."""
        with patch("app.services.ml_service._models", {}):
            assert not is_model_loaded("random_forest")
            assert not is_model_loaded("logistic_regression")

    def test_get_available_models_returns_empty_list(self):
        with patch("app.services.ml_service._models", {}):
            assert get_available_models() == []


class TestModelRegistryWithMocks:
    """Tests for model registry with simulated models."""
    def test_is_model_loaded_true_when_present(self, mock_models):
        assert is_model_loaded("random_forest")
        assert is_model_loaded("logistic_regression")

    def test_get_available_models_returns_both(self, mock_models):
        available = get_available_models()
        assert "random_forest" in available
        assert "logistic_regression" in available

    def test_unknown_model_not_loaded(self, mock_models):
        assert not is_model_loaded("xgboost")


class TestPredictHealthy:
    """Tests for prediction with healthy company data."""
    def test_returns_healthy_label(self, mock_models):
        # mock returns [[0.95, 0.05]] → 5% distress → Healthy
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert result["risk_label"] == "Healthy"

    def test_distress_probability_is_float(self, mock_models):
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert isinstance(result["distress_probability"], float)

    def test_distress_probability_in_range(self, mock_models):
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert 0.0 <= result["distress_probability"] <= 1.0

    def test_distress_probability_is_low(self, mock_models):
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert result["distress_probability"] < 0.5

    def test_model_name_echoed_back(self, mock_models):
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert result["model_name"] == "random_forest"

    def test_result_has_required_keys(self, mock_models):
        result = predict(SAMPLE_RATIOS, model_name="random_forest")
        assert "risk_label" in result
        assert "distress_probability" in result
        assert "model_name" in result


class TestPredictDistressed:
    """Tests for prediction with distressed company data."""
    def test_returns_distressed_label_when_prob_high(self):
        """Mock RF to return high distress probability."""
        mock_rf = MagicMock()
        mock_rf.predict_proba.return_value = [[0.15, 0.85]]  # 85% distress
        mock_scaler = MagicMock()
        mock_scaler.transform.side_effect = lambda x: x

        with patch("app.services.ml_service._models", {"random_forest": mock_rf}), \
             patch("app.services.ml_service._scaler", mock_scaler):
            result = predict(DISTRESSED_RATIOS, model_name="random_forest")
            assert result["risk_label"] == "Distressed"
            assert result["distress_probability"] >= 0.5


class TestPredictErrors:
    """Tests for prediction error handling."""
    def test_invalid_model_name_raises_value_error(self, mock_models):
        with pytest.raises(ValueError, match="Unknown model"):
            predict(SAMPLE_RATIOS, model_name="xgboost")

    def test_model_not_loaded_raises_runtime_error(self):
        with patch("app.services.ml_service._models", {}), \
             patch("app.services.ml_service._scaler", None):
            with pytest.raises(RuntimeError):
                predict(SAMPLE_RATIOS, model_name="random_forest")

    def test_logistic_regression_model(self, mock_models):
        """LR model should also work through the same interface."""
        result = predict(SAMPLE_RATIOS, model_name="logistic_regression")
        assert "risk_label" in result
        assert "distress_probability" in result

    def test_scaler_applied_when_present(self, mock_models):
        """Scaler transform must be called exactly once during inference."""
        from app.services.ml_service import _scaler
        predict(SAMPLE_RATIOS, model_name="random_forest")
        # The mock scaler's transform should have been called
        import app.services.ml_service as ml_svc
        ml_svc._scaler.transform.assert_called_once()
