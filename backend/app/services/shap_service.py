# =============================================================================
# FinWatch Zambia — SHAP Service
#
# Computes SHAP (SHapley Additive exPlanations) feature attributions for
# individual predictions and global feature importance rankings.
#
# Model-specific explainers (Lundberg and Lee, 2017):
#   Random Forest     → shap.TreeExplainer
#     Exact Shapley values computed natively for tree ensembles.
#     Fast, exact, no approximation needed.
#
#   Logistic Regression → shap.LinearExplainer
#     Exact Shapley values for linear models using feature covariances.
#     Requires the background dataset or its mean/covariance summary.
#
# Explainers are loaded ONCE at startup alongside their models.
# After loading, compute_shap_values() is stateless and thread-safe.
#
# Artifact files (written by ml/explain.py, Stage 3):
#   ml/artifacts/shap_explainer_random_forest.joblib
#   ml/artifacts/shap_explainer_logistic_regression.joblib
#   ml/artifacts/shap_global_random_forest.json    — pre-computed global means
#   ml/artifacts/shap_global_logistic_regression.json
#
# Stage 3 implementation note:
#   Replace the NotImplementedError bodies with shap.TreeExplainer /
#   shap.LinearExplainer calls. The interface is locked — do not change
#   function signatures.
# =============================================================================

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.services.ratio_engine import RATIO_NAMES, validate_ratio_keys

logger = logging.getLogger(__name__)


# =============================================================================
# Module-level explainer registry
# =============================================================================

# Fitted SHAP explainer objects keyed by model name
_explainers: dict[str, Any] = {}

# Pre-computed global SHAP importance (mean |SHAP| per feature across training set)
# Written by ml/explain.py and loaded here for fast serving without recomputation
_global_shap: dict[str, dict[str, float]] = {}


# =============================================================================
# Loading
# =============================================================================


def load_explainers() -> None:
    """
    Load all serialized SHAP explainer artifacts from the artifacts directory.

    Must be called after load_models() since explainers reference fitted models.
    Called by the lifespan handler in main.py alongside load_models().

    Safe to call if artifacts do not yet exist — logs a warning and returns
    without raising. compute_shap_values() will fall back to zero attributions
    until Stage 3 artifacts are present.

    Stage 3 implementation:
        import joblib, shap
        for model_name in ["random_forest", "logistic_regression"]:
            path = settings.ml_artifacts_path / f"shap_explainer_{model_name}.joblib"
            _explainers[model_name] = joblib.load(path)
            global_path = settings.ml_artifacts_path / f"shap_global_{model_name}.json"
            _global_shap[model_name] = json.loads(global_path.read_text())
    """
    artifacts_path = settings.ml_artifacts_path
    logger.info("Loading SHAP explainers from: %s", artifacts_path)

    if not artifacts_path.exists():
        logger.warning(
            "SHAP artifacts directory not found. "
            "SHAP explanations will return zero attributions until Stage 3 artifacts exist."
        )
        return

    for model_name in ["random_forest", "logistic_regression"]:
        explainer_file = artifacts_path / f"shap_explainer_{model_name}.joblib"
        global_file = artifacts_path / f"shap_global_{model_name}.json"

        if explainer_file.exists():
            # Stage 3: _explainers[model_name] = joblib.load(explainer_file)
            logger.info(
                "Found SHAP explainer for %s — load implementation in Stage 3",
                model_name,
            )
        if global_file.exists():
            # Stage 3: _global_shap[model_name] = json.loads(global_file.read_text())
            logger.info(
                "Found global SHAP file for %s — load implementation in Stage 3",
                model_name,
            )


def is_explainer_loaded(model_name: str) -> bool:
    """Return True if the SHAP explainer for the given model is loaded."""
    return model_name in _explainers


# =============================================================================
# Per-prediction SHAP
# =============================================================================


def compute_shap_values(
    model_name: str,
    feature_vector: list[float],
) -> dict[str, float]:
    """
    Compute SHAP attribution values for a single prediction.

    Returns a dict mapping each ratio name to its SHAP value for this
    specific prediction instance. Positive values increase distress
    probability; negative values decrease it.

    Args:
        model_name:     "random_forest" or "logistic_regression"
        feature_vector: Ordered list of ratio values matching RATIO_NAMES.
                        Use ratio_engine.ratios_to_feature_vector() to build.

    Returns:
        Dict[ratio_name → SHAP_value] with exactly len(RATIO_NAMES) entries.
        Returns zero attributions if the explainer is not yet loaded,
        allowing the prediction pipeline to continue gracefully.

    Stage 3 implementation:
        explainer = _explainers[model_name]
        shap_vals = explainer.shap_values([feature_vector])
        # TreeExplainer returns array of shape (n_classes, n_features)
        # for Random Forest; take index DISTRESS_CLASS_INDEX
        # LinearExplainer returns shape (n_samples, n_features)
        values = shap_vals[DISTRESS_CLASS_INDEX][0]  # RF
        # or values = shap_vals[0]  # LR
        return dict(zip(RATIO_NAMES, [float(v) for v in values]))
    """
    if len(feature_vector) != len(RATIO_NAMES):
        raise ValueError(
            f"Feature vector length {len(feature_vector)} does not match "
            f"expected {len(RATIO_NAMES)} ratios."
        )

    if not is_explainer_loaded(model_name):
        logger.warning(
            "SHAP explainer for '%s' not loaded — returning zero attributions. "
            "Run `python ml/train.py` and restart the server.",
            model_name,
        )
        return {name: 0.0 for name in RATIO_NAMES}

    # TODO Stage 3: Replace with actual SHAP computation
    raise NotImplementedError("SHAP computation will be implemented in Stage 3.")


# =============================================================================
# Global feature importance
# =============================================================================


def get_global_shap_importance(model_name: str) -> dict[str, float]:
    """
    Return pre-computed global SHAP feature importance for a model.

    Global importance = mean(|SHAP values|) across all training samples.
    Pre-computed by ml/explain.py during training to avoid recomputing
    over the full dataset on every request.

    Used by the dashboard to display which financial ratios most
    consistently drive distress predictions across all companies.

    Args:
        model_name: "random_forest" or "logistic_regression"

    Returns:
        Dict[ratio_name → mean_absolute_shap] sorted by importance descending.
        Returns equal weights (1/n_ratios) if global data is not yet loaded.

    Stage 3: This will be populated from _global_shap[model_name].
    """
    if model_name in _global_shap:
        return dict(
            sorted(
                _global_shap[model_name].items(),
                key=lambda x: abs(x[1]),
                reverse=True,
            )
        )

    # Pre-Stage 3 fallback — equal weights signal that real data is missing
    logger.warning(
        "Global SHAP data for '%s' not loaded — returning equal weights.",
        model_name,
    )
    equal_weight = round(1.0 / len(RATIO_NAMES), 6)
    return {name: equal_weight for name in RATIO_NAMES}
