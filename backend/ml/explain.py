"""
FinWatch Zambia - SHAP Explanation Pipeline

Generates SHAP (SHapley Additive exPlanations) explanations for both trained models.

Explainer selection:
- Random Forest → shap.TreeExplainer (exact, no background dataset needed)
- Logistic Regression → shap.LinearExplainer (requires background dataset)

Artifacts saved:
- ml/artifacts/shap_explainer_random_forest.joblib
- ml/artifacts/shap_explainer_logistic_regression.joblib
- ml/artifacts/shap_global_random_forest.json
- ml/artifacts/shap_global_logistic_regression.json
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

GLOBAL_SHAP_SAMPLE_LIMIT = 500

DISTRESS_CLASS_INDEX = 1




def _explain_random_forest(
    model: Any,
    X_train: np.ndarray,
    X_test: np.ndarray,
    artifacts_path: Path,
) -> shap.TreeExplainer:
    """Create and serialize a SHAP TreeExplainer for the Random Forest model."""
    logger.info("Creating SHAP TreeExplainer for Random Forest...")
    explainer = shap.TreeExplainer(model)

    sample_size = min(GLOBAL_SHAP_SAMPLE_LIMIT, len(X_test))
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_sample = X_test[sample_idx]

    logger.info(
        "Computing TreeExplainer SHAP values on %d test samples...", sample_size
    )
    shap_values = explainer.shap_values(X_sample)

    if isinstance(shap_values, list):
        shap_distress = shap_values[DISTRESS_CLASS_INDEX]
    else:
        shap_distress = shap_values

    global_importance = {
        name: round(float(np.mean(np.abs(shap_distress[:, i]))), 6)
        for i, name in enumerate(RATIO_NAMES)
    }

    global_importance = dict(
        sorted(global_importance.items(), key=lambda x: x[1], reverse=True)
    )

    logger.info("Random Forest — Top 5 SHAP features:")
    for i, (name, val) in enumerate(list(global_importance.items())[:5], 1):
        logger.info("  %d. %-25s  mean|SHAP| = %.6f", i, name, val)

    joblib.dump(explainer, artifacts_path / "shap_explainer_random_forest.joblib")
    (artifacts_path / "shap_global_random_forest.json").write_text(
        json.dumps(global_importance, indent=2)
    )
    logger.info("RF SHAP artifacts saved.")

    return explainer


def _explain_logistic_regression(
    model: Any,
    X_train: np.ndarray,
    X_test: np.ndarray,
    artifacts_path: Path,
) -> shap.LinearExplainer:
    """Create and serialize a SHAP LinearExplainer for the Logistic Regression model."""
    logger.info("Creating SHAP LinearExplainer for Logistic Regression...")

    explainer = shap.LinearExplainer(
        model,
        X_train,
        feature_perturbation="interventional",
    )

    sample_size = min(GLOBAL_SHAP_SAMPLE_LIMIT, len(X_test))
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_sample = X_test[sample_idx]

    logger.info(
        "Computing LinearExplainer SHAP values on %d test samples...", sample_size
    )
    shap_values = explainer.shap_values(X_sample)

    if len(shap_values.shape) == 3:
        shap_values = shap_values[:, :, DISTRESS_CLASS_INDEX]

    global_importance = {
        name: round(float(np.mean(np.abs(shap_values[:, i]))), 6)
        for i, name in enumerate(RATIO_NAMES)
    }
    global_importance = dict(
        sorted(global_importance.items(), key=lambda x: x[1], reverse=True)
    )

    logger.info("Logistic Regression — Top 5 SHAP features:")
    for i, (name, val) in enumerate(list(global_importance.items())[:5], 1):
        logger.info("  %d. %-25s  mean|SHAP| = %.6f", i, name, val)

    joblib.dump(explainer, artifacts_path / "shap_explainer_logistic_regression.joblib")
    (artifacts_path / "shap_global_logistic_regression.json").write_text(
        json.dumps(global_importance, indent=2)
    )
    logger.info("LR SHAP artifacts saved.")

    return explainer




def explain_all_models(
    models: dict[str, Any],
    X_train: np.ndarray,
    X_test: np.ndarray,
    artifacts_path: Path,
) -> dict[str, Any]:
    """Generate SHAP explanations for all trained models."""
    artifacts_path.mkdir(parents=True, exist_ok=True)
    explainers = {}

    if "random_forest" in models:
        logger.info("=" * 60)
        logger.info("SHAP: Random Forest (TreeExplainer)")
        logger.info("=" * 60)
        explainers["random_forest"] = _explain_random_forest(
            models["random_forest"], X_train, X_test, artifacts_path
        )

    if "logistic_regression" in models:
        logger.info("=" * 60)
        logger.info("SHAP: Logistic Regression (LinearExplainer)")
        logger.info("=" * 60)
        explainers["logistic_regression"] = _explain_logistic_regression(
            models["logistic_regression"], X_train, X_test, artifacts_path
        )

    logger.info("SHAP explanation pipeline complete.")
    return explainers
