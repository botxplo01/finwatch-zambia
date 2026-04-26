"""
FinWatch Zambia - SHAP Service

Computes SHAP (SHapley Additive exPlanations) feature attributions for individual predictions and global feature importance rankings.

Model-specific explainers:
- Random Forest → shap.TreeExplainer (exact, native tree support)
- Logistic Regression → shap.LinearExplainer (exact for linear models)

Explainers are loaded once at startup alongside their models.
Artifact files (written by ml/explain.py):
- ml/artifacts/shap_explainer_random_forest.joblib
- ml/artifacts/shap_explainer_logistic_regression.joblib
- ml/artifacts/shap_global_random_forest.json
- ml/artifacts/shap_global_logistic_regression.json
"""

from __future__ import annotations

import json
import logging
from typing import Any

import joblib
import numpy as np

from app.core.config import settings
from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

_explainers: dict[str, Any] = {}
_global_shap: dict[str, dict[str, float]] = {}
DISTRESS_CLASS_INDEX: int = 1


def load_explainers() -> None:
    """Load all serialized SHAP explainer artifacts from the artifacts directory."""
    artifacts_path = settings.ml_artifacts_path
    logger.info("Loading SHAP explainers from: %s", artifacts_path)

    if not artifacts_path.exists():
        logger.warning(
            "SHAP artifacts directory not found at %s. "
            "SHAP explanations will return zero attributions.",
            artifacts_path,
        )
        return

    for model_name in ["random_forest", "logistic_regression"]:
        explainer_file = artifacts_path / f"shap_explainer_{model_name}.joblib"
        global_file = artifacts_path / f"shap_global_{model_name}.json"

        if explainer_file.exists():
            try:
                _explainers[model_name] = joblib.load(explainer_file)
                logger.info("SHAP explainer loaded for '%s'", model_name)
            except Exception as e:
                logger.error(
                    "Failed to load SHAP explainer for '%s': %s", model_name, e
                )
        else:
            logger.warning(
                "SHAP explainer not found for '%s' at %s", model_name, explainer_file
            )

        if global_file.exists():
            try:
                _global_shap[model_name] = json.loads(global_file.read_text())
                logger.info("Global SHAP importance loaded for '%s'", model_name)
            except Exception as e:
                logger.error("Failed to load global SHAP for '%s': %s", model_name, e)
        else:
            logger.warning(
                "Global SHAP file not found for '%s' at %s", model_name, global_file
            )

    logger.info(
        "SHAP loading complete. Explainers available: %s", list(_explainers.keys())
    )


def is_explainer_loaded(model_name: str) -> bool:
    """Return True if the SHAP explainer for the given model is loaded."""
    return model_name in _explainers


def compute_shap_values(
    model_name: str,
    feature_vector: list[float],
) -> dict[str, float]:
    """
    Compute SHAP attribution values for a single prediction instance.

    Args:
        model_name: "random_forest" or "logistic_regression"
        feature_vector: Ordered list of ratio values matching RATIO_NAMES order.

    Returns:
        Dict[ratio_name → SHAP_value] with exactly len(RATIO_NAMES) entries.
        Returns zero attributions if the explainer is not loaded.
    """
    if len(feature_vector) != len(RATIO_NAMES):
        raise ValueError(
            f"Feature vector length {len(feature_vector)} does not match "
            f"expected {len(RATIO_NAMES)} ratios."
        )

    if not is_explainer_loaded(model_name):
        logger.warning(
            "SHAP explainer for '%s' not loaded — returning zero attributions.",
            model_name,
        )
        return {name: 0.0 for name in RATIO_NAMES}

    try:
        explainer = _explainers[model_name]
        X = np.array([feature_vector])

        raw = explainer.shap_values(X)

        if model_name == "random_forest":
            if isinstance(raw, list):
                values = raw[DISTRESS_CLASS_INDEX][0]
            else:
                values = raw[0, :, DISTRESS_CLASS_INDEX]
        else:
            if isinstance(raw, list):
                values = raw[DISTRESS_CLASS_INDEX][0]
            else:
                values = raw[0]

        shap_dict = {name: float(v) for name, v in zip(RATIO_NAMES, values)}

        logger.debug("SHAP computed for '%s': %s", model_name, shap_dict)
        return shap_dict

    except Exception as e:
        logger.error("SHAP computation failed for '%s': %s", model_name, e)
        return {name: 0.0 for name in RATIO_NAMES}


def get_global_shap_importance(model_name: str) -> dict[str, float]:
    """
    Return pre-computed global SHAP feature importance for a model.

    Global importance = mean(|SHAP values|) across all training samples.
    Pre-computed by ml/explain.py during training.

    Args:
        model_name: "random_forest" or "logistic_regression"

    Returns:
        Dict[ratio_name → mean_absolute_shap] sorted by importance descending.
        Returns equal weights if global data is not loaded.
    """
    if model_name in _global_shap:
        return dict(
            sorted(
                _global_shap[model_name].items(),
                key=lambda x: abs(x[1]),
                reverse=True,
            )
        )

    logger.warning(
        "Global SHAP data for '%s' not loaded — returning equal weights.", model_name
    )
    equal_weight = round(1.0 / len(RATIO_NAMES), 6)
    return {name: equal_weight for name in RATIO_NAMES}
