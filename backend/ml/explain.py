# =============================================================================
# FinWatch Zambia — SHAP Explanation Pipeline
#
# Generates SHAP (SHapley Additive exPlanations) explanations for both
# trained models using model-appropriate explainer types.
#
# Explainer selection (Lundberg and Lee, 2017):
#   Random Forest     → shap.TreeExplainer
#     Computes exact Shapley values natively for tree ensembles.
#     Does not require a background dataset.
#     Fast on CPU — suitable for i7 8th Gen hardware.
#
#   Logistic Regression → shap.LinearExplainer
#     Computes exact Shapley values for linear models.
#     Requires a background dataset (training features or their summary).
#     Uses feature covariance for the 'interventional' estimation.
#
# Note on SHAP vs LIME:
#   SHAP is used exclusively — LIME is excluded from this project.
#   Justification: SHAP provides consistent, theoretically grounded
#   attributions (Shapley values from cooperative game theory), tighter
#   scikit-learn integration, and supports both global and local
#   explanations from a single framework.
#
# Artifacts saved:
#   ml/artifacts/shap_explainer_random_forest.joblib
#   ml/artifacts/shap_explainer_logistic_regression.joblib
#   ml/artifacts/shap_global_random_forest.json
#   ml/artifacts/shap_global_logistic_regression.json
# =============================================================================

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

# Maximum number of test samples to use for global SHAP computation.
# SHAP over the full test set can be slow on CPU. 500 samples gives a
# representative global importance estimate within hardware constraints.
GLOBAL_SHAP_SAMPLE_LIMIT = 500

# Distress class index for multi-output TreeExplainer
DISTRESS_CLASS_INDEX = 1


# =============================================================================
# Per-model SHAP computation
# =============================================================================


def _explain_random_forest(
    model: Any,
    X_train: np.ndarray,
    X_test: np.ndarray,
    artifacts_path: Path,
) -> shap.TreeExplainer:
    """
    Create and serialize a SHAP TreeExplainer for the Random Forest model.

    TreeExplainer computes exact Shapley values for tree ensembles without
    approximation. It does not require a background dataset — the tree
    structure encodes the necessary distributional information.

    Args:
        model:          Fitted RandomForestClassifier.
        X_train:        Scaled training features (not used by TreeExplainer,
                        but available for reference).
        X_test:         Scaled test features for global importance computation.
        artifacts_path: Directory to save explainer artifacts.

    Returns:
        Fitted TreeExplainer.
    """
    logger.info("Creating SHAP TreeExplainer for Random Forest...")
    explainer = shap.TreeExplainer(model)

    # Compute global SHAP importance on a sample of the test set
    sample_size = min(GLOBAL_SHAP_SAMPLE_LIMIT, len(X_test))
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_sample = X_test[sample_idx]

    logger.info(
        "Computing TreeExplainer SHAP values on %d test samples...", sample_size
    )
    shap_values = explainer.shap_values(X_sample)

    # TreeExplainer for multi-class RF returns list: [class_0_values, class_1_values]
    # We take class 1 (distressed) SHAP values
    if isinstance(shap_values, list):
        shap_distress = shap_values[DISTRESS_CLASS_INDEX]
    else:
        shap_distress = shap_values

    # Global importance = mean(|SHAP|) across samples per feature
    global_importance = {
        name: round(float(np.mean(np.abs(shap_distress[:, i]))), 6)
        for i, name in enumerate(RATIO_NAMES)
    }

    # Sort by importance descending for readability
    global_importance = dict(
        sorted(global_importance.items(), key=lambda x: x[1], reverse=True)
    )

    logger.info("Random Forest — Top 5 SHAP features:")
    for i, (name, val) in enumerate(list(global_importance.items())[:5], 1):
        logger.info("  %d. %-25s  mean|SHAP| = %.6f", i, name, val)

    # Save explainer and global importance
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
    """
    Create and serialize a SHAP LinearExplainer for the Logistic Regression model.

    LinearExplainer computes exact Shapley values for linear models using
    the feature covariance structure. The training data summary (mean + covariance)
    serves as the background distribution for the interventional estimation.

    Using the full training set for covariance estimation ensures the background
    distribution is representative. For very large training sets, a random
    subsample can be used without significant quality loss.

    Args:
        model:          Fitted LogisticRegression.
        X_train:        Scaled training features — used as background distribution.
        X_test:         Scaled test features for global importance computation.
        artifacts_path: Directory to save explainer artifacts.

    Returns:
        Fitted LinearExplainer.
    """
    logger.info("Creating SHAP LinearExplainer for Logistic Regression...")

    # Use training data as background — LinearExplainer uses its covariance
    # to estimate the interventional Shapley values
    explainer = shap.LinearExplainer(
        model,
        X_train,
        feature_perturbation="interventional",
    )

    # Compute global SHAP importance on test sample
    sample_size = min(GLOBAL_SHAP_SAMPLE_LIMIT, len(X_test))
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(len(X_test), size=sample_size, replace=False)
    X_sample = X_test[sample_idx]

    logger.info(
        "Computing LinearExplainer SHAP values on %d test samples...", sample_size
    )
    shap_values = explainer.shap_values(X_sample)

    # LinearExplainer returns shape (n_samples, n_features) for binary classification
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

    # Save explainer and global importance
    joblib.dump(explainer, artifacts_path / "shap_explainer_logistic_regression.joblib")
    (artifacts_path / "shap_global_logistic_regression.json").write_text(
        json.dumps(global_importance, indent=2)
    )
    logger.info("LR SHAP artifacts saved.")

    return explainer


# =============================================================================
# Main
# =============================================================================


def explain_all_models(
    models: dict[str, Any],
    X_train: np.ndarray,
    X_test: np.ndarray,
    artifacts_path: Path,
) -> dict[str, Any]:
    """
    Generate SHAP explanations for all trained models.

    Args:
        models:         Dict of model_name → fitted estimator.
        X_train:        Scaled training features (used by LinearExplainer).
        X_test:         Scaled test features (used for global importance).
        artifacts_path: Directory to save explainer artifacts.

    Returns:
        Dict mapping model_name → fitted SHAP explainer.
    """
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
