"""
FinWatch Zambia - Unit Tests: SHAP Service

Tests:
    - Explainer loading
    - Per-prediction SHAP computation
    - Global importance calculation
    - Graceful fallback to zero attributions when explainers are absent
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from app.services.shap_service import (
    compute_shap_values,
    get_global_shap_importance,
    is_explainer_loaded,
    DISTRESS_CLASS_INDEX,
)
from app.services.ratio_engine import RATIO_NAMES
from .conftest import SAMPLE_RATIOS


FEATURE_VECTOR = [SAMPLE_RATIOS[k] for k in RATIO_NAMES]


class TestConstants:
    """Tests for SHAP service constants."""
    def test_distress_class_index(self):
        """Must match ml_service.DISTRESS_CLASS_INDEX — training consistency."""
        assert DISTRESS_CLASS_INDEX == 1


class TestShapWithoutExplainers:
    """Tests for SHAP behavior without loaded explainers."""
    def test_is_explainer_loaded_false_when_empty(self):
        with patch("app.services.shap_service._explainers", {}):
            assert not is_explainer_loaded("random_forest")
            assert not is_explainer_loaded("logistic_regression")

    def test_compute_shap_returns_zeros_when_not_loaded(self):
        with patch("app.services.shap_service._explainers", {}):
            result = compute_shap_values("random_forest", FEATURE_VECTOR)
            assert all(v == 0.0 for v in result.values())

    def test_zero_shap_has_all_ratio_names(self):
        with patch("app.services.shap_service._explainers", {}):
            result = compute_shap_values("random_forest", FEATURE_VECTOR)
            assert set(result.keys()) == set(RATIO_NAMES)

    def test_global_importance_returns_equal_weights_when_empty(self):
        with patch("app.services.shap_service._global_shap", {}):
            result = get_global_shap_importance("random_forest")
            values = list(result.values())
            assert len(values) == len(RATIO_NAMES)
            # All equal weights
            assert all(abs(v - values[0]) < 1e-9 for v in values)

class TestShapRandomForest:
    """Tests for Random Forest explainer."""
    def test_is_explainer_loaded_true(self, mock_explainers):
        assert is_explainer_loaded("random_forest")

    def test_compute_shap_returns_dict(self, mock_explainers):
        result = compute_shap_values("random_forest", FEATURE_VECTOR)
        assert isinstance(result, dict)

    def test_compute_shap_has_all_ratio_keys(self, mock_explainers):
        result = compute_shap_values("random_forest", FEATURE_VECTOR)
        assert set(result.keys()) == set(RATIO_NAMES)

    def test_compute_shap_all_values_are_floats(self, mock_explainers):
        result = compute_shap_values("random_forest", FEATURE_VECTOR)
        for k, v in result.items():
            assert isinstance(v, float), f"{k} should be float"

    def test_compute_shap_values_are_finite(self, mock_explainers):
        result = compute_shap_values("random_forest", FEATURE_VECTOR)
        for v in result.values():
            assert np.isfinite(v), "All SHAP values must be finite"

class TestShapLogisticRegression:
    """Tests for Logistic Regression explainer."""
    def test_is_explainer_loaded_true(self, mock_explainers):
        assert is_explainer_loaded("logistic_regression")

    def test_compute_shap_returns_dict(self, mock_explainers):
        result = compute_shap_values("logistic_regression", FEATURE_VECTOR)
        assert isinstance(result, dict)

    def test_compute_shap_has_all_ratio_keys(self, mock_explainers):
        result = compute_shap_values("logistic_regression", FEATURE_VECTOR)
        assert set(result.keys()) == set(RATIO_NAMES)

    def test_lr_shap_values_are_floats(self, mock_explainers):
        result = compute_shap_values("logistic_regression", FEATURE_VECTOR)
        for v in result.values():
            assert isinstance(v, float)


class TestShapErrors:
    """Tests for SHAP error handling."""
    def test_wrong_feature_vector_length_raises(self, mock_explainers):
        wrong_len = [0.5] * 5  # should be 10
        with pytest.raises(ValueError, match="length"):
            compute_shap_values("random_forest", wrong_len)

    def test_exception_in_explainer_returns_zeros(self, mock_explainers):
        """If the explainer raises internally, graceful fallback to zeros."""
        with patch("app.services.shap_service._explainers") as mock_reg:
            bad_explainer = MagicMock()
            bad_explainer.shap_values.side_effect = RuntimeError("SHAP exploded")
            mock_reg.__contains__ = lambda s, k: True
            mock_reg.__getitem__ = lambda s, k: bad_explainer
            result = compute_shap_values("random_forest", FEATURE_VECTOR)
            # Should fall back to zeros gracefully
            assert all(v == 0.0 for v in result.values())


class TestGlobalShapImportance:
    """Tests for global SHAP importance calculation."""
    def test_returns_sorted_descending_by_absolute_value(self):
        mock_data = {
            "random_forest": {
                "current_ratio": 0.05,
                "quick_ratio": 0.12,
                "cash_ratio": 0.02,
                "debt_to_equity": 0.08,
                "debt_to_assets": 0.03,
                "interest_coverage": 0.10,
                "net_profit_margin": 0.07,
                "return_on_assets": 0.04,
                "return_on_equity": 0.01,
                "asset_turnover": 0.06,
            }
        }
        with patch("app.services.shap_service._global_shap", mock_data):
            result = get_global_shap_importance("random_forest")
            values = list(result.values())
            assert values == sorted(values, reverse=True)

    def test_returns_all_ratio_names(self):
        mock_data = {"random_forest": {k: 0.05 for k in RATIO_NAMES}}
        with patch("app.services.shap_service._global_shap", mock_data):
            result = get_global_shap_importance("random_forest")
            assert set(result.keys()) == set(RATIO_NAMES)
