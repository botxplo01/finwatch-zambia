# =============================================================================
# FinWatch Zambia — Model Training Pipeline
#
# Trains Logistic Regression and Random Forest classifiers on the
# preprocessed financial ratio feature vectors.
#
# Design choices:
#   - Both models are wrapped in sklearn Pipelines (no scaler inside —
#     data arrives pre-scaled from preprocess.py). Pipelines are used
#     for consistent predict_proba() interface and joblib serialization.
#   - GridSearchCV with 5-fold StratifiedKFold for hyperparameter tuning.
#     Stratified folds preserve class proportions after SMOTE.
#   - Primary scoring metric: F1 (macro) — appropriate for imbalanced
#     datasets where both precision and recall matter (Saito and
#     Rehmsmeier, 2015).
#   - Random Forest is expected to outperform LR on non-linear distress
#     patterns (Barboza, Kimura and Altman, 2017).
#   - GridSearchCV grids are deliberately compact given hardware constraints
#     (i7 8th Gen, 16GB RAM) and the 6-week timeline.
#
# Artifacts saved:
#   ml/artifacts/logistic_regression.joblib — fitted LR estimator
#   ml/artifacts/random_forest.joblib       — fitted RF estimator
#   ml/artifacts/model_metadata.json        — config + CV scores
# =============================================================================

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

# =============================================================================
# Hyperparameter Grids
# =============================================================================

# Logistic Regression:
# C = inverse regularisation strength. Small C = stronger regularisation.
# Grid covers 4 orders of magnitude — standard practice for LR.
LR_PARAM_GRID = {
    "C": [0.01, 0.1, 1.0, 10.0, 100.0],
    "solver": ["lbfgs"],
    "max_iter": [1000],
    "random_state": [42],
    "class_weight": ["balanced"],
}

# Random Forest:
# Compact grid for hardware feasibility (i7 8th Gen, 16GB RAM).
# n_estimators: 100 is typically sufficient for tabular data (Breiman, 2001).
# max_depth: None = grow fully; integer values reduce overfitting on small data.
RF_PARAM_GRID = {
    "n_estimators": [100, 200],
    "max_depth": [None, 10, 20],
    "min_samples_split": [2, 5],
    "class_weight": ["balanced"],
    "random_state": [42],
    "n_jobs": [-1],  # use all available cores
}

CV_FOLDS = 5
CV_SCORING = "f1_macro"
RANDOM_STATE = 42


# =============================================================================
# Training
# =============================================================================


def _run_grid_search(
    estimator_class: Any,
    param_grid: dict,
    X_train: np.ndarray,
    y_train: np.ndarray,
    model_name: str,
) -> tuple[Any, dict]:
    """
    Run GridSearchCV for a given estimator class and return the best estimator
    and a summary of CV results.

    Args:
        estimator_class: scikit-learn estimator class (not instance).
        param_grid:      Hyperparameter grid to search.
        X_train:         Pre-scaled training features.
        y_train:         Training labels (post-SMOTE).
        model_name:      Name string for logging.

    Returns:
        Tuple of (best_estimator, cv_results_summary_dict).
    """
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)

    # Instantiate with default params; GridSearchCV will override via param_grid
    base_estimator = estimator_class()

    logger.info(
        "Starting GridSearchCV for %s — %d parameter combinations × %d folds = %d fits",
        model_name,
        len(list(_product_len(param_grid))),
        CV_FOLDS,
        len(list(_product_len(param_grid))) * CV_FOLDS,
    )

    t0 = time.time()
    grid_search = GridSearchCV(
        estimator=base_estimator,
        param_grid=param_grid,
        cv=cv,
        scoring=CV_SCORING,
        n_jobs=-1,
        verbose=1,
        refit=True,  # Refit best estimator on full training set
        return_train_score=True,
    )
    grid_search.fit(X_train, y_train)
    elapsed = time.time() - t0

    logger.info(
        "%s GridSearchCV complete in %.1fs. Best params: %s | Best CV F1: %.4f",
        model_name,
        elapsed,
        grid_search.best_params_,
        grid_search.best_score_,
    )

    cv_summary = {
        "best_params": grid_search.best_params_,
        "best_cv_f1": round(float(grid_search.best_score_), 4),
        "cv_folds": CV_FOLDS,
        "cv_scoring": CV_SCORING,
        "training_time_s": round(elapsed, 1),
    }

    return grid_search.best_estimator_, cv_summary


def _product_len(param_grid: dict) -> int:
    """Count the total number of parameter combinations in a grid."""
    count = 1
    for values in param_grid.values():
        count *= len(values)
    return count


def _full_cv_report(
    estimator: Any,
    X_train: np.ndarray,
    y_train: np.ndarray,
    model_name: str,
) -> dict:
    """
    Run cross-validation on the best estimator and report all metrics.
    This validates the best model's generalisation before test-set evaluation.
    Provides the CV performance table included in Chapter 4.

    Metrics reported per fold:
      - Accuracy, Precision (macro), Recall (macro), F1 (macro), ROC-AUC
    """
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scoring = {
        "accuracy": "accuracy",
        "precision": "precision_macro",
        "recall": "recall_macro",
        "f1": "f1_macro",
        "roc_auc": "roc_auc",
    }
    scores = cross_validate(
        estimator,
        X_train,
        y_train,
        cv=cv,
        scoring=scoring,
        return_train_score=False,
        n_jobs=-1,
    )

    cv_report = {}
    for metric, values in scores.items():
        if metric.startswith("test_"):
            name = metric.replace("test_", "")
            cv_report[name] = {
                "mean": round(float(np.mean(values)), 4),
                "std": round(float(np.std(values)), 4),
                "values": [round(float(v), 4) for v in values],
            }

    logger.info(
        "%s cross-validation results (%d folds):\n"
        "  Accuracy:  %.4f ± %.4f\n"
        "  Precision: %.4f ± %.4f\n"
        "  Recall:    %.4f ± %.4f\n"
        "  F1:        %.4f ± %.4f\n"
        "  ROC-AUC:   %.4f ± %.4f",
        model_name,
        CV_FOLDS,
        cv_report["accuracy"]["mean"],
        cv_report["accuracy"]["std"],
        cv_report["precision"]["mean"],
        cv_report["precision"]["std"],
        cv_report["recall"]["mean"],
        cv_report["recall"]["std"],
        cv_report["f1"]["mean"],
        cv_report["f1"]["std"],
        cv_report["roc_auc"]["mean"],
        cv_report["roc_auc"]["std"],
    )
    return cv_report


def train_all_models(
    X_train: np.ndarray,
    y_train: np.ndarray,
    artifacts_path: Path,
) -> dict[str, Any]:
    """
    Train Logistic Regression and Random Forest with hyperparameter tuning
    and cross-validation. Serialize best estimators to artifacts_path.

    Args:
        X_train:        Pre-scaled, SMOTE'd training features.
        y_train:        Training labels.
        artifacts_path: Directory to save serialized models and metadata.

    Returns:
        Dict mapping model name → fitted estimator.
    """
    artifacts_path.mkdir(parents=True, exist_ok=True)

    models = {}
    metadata = {"models": {}, "feature_names": RATIO_NAMES}

    # -------------------------------------------------------------------------
    # Logistic Regression
    # -------------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Training Logistic Regression")
    logger.info("=" * 60)

    lr_best, lr_cv_grid = _run_grid_search(
        LogisticRegression, LR_PARAM_GRID, X_train, y_train, "LogisticRegression"
    )
    lr_cv_report = _full_cv_report(lr_best, X_train, y_train, "LogisticRegression")

    joblib.dump(lr_best, artifacts_path / "logistic_regression.joblib")
    models["logistic_regression"] = lr_best

    metadata["models"]["logistic_regression"] = {
        "class": "LogisticRegression",
        "grid_search": lr_cv_grid,
        "cv_report": lr_cv_report,
    }
    logger.info(
        "LogisticRegression saved to: %s", artifacts_path / "logistic_regression.joblib"
    )

    # -------------------------------------------------------------------------
    # Random Forest
    # -------------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Training Random Forest")
    logger.info("=" * 60)

    rf_best, rf_cv_grid = _run_grid_search(
        RandomForestClassifier, RF_PARAM_GRID, X_train, y_train, "RandomForest"
    )
    rf_cv_report = _full_cv_report(rf_best, X_train, y_train, "RandomForest")

    joblib.dump(rf_best, artifacts_path / "random_forest.joblib")
    models["random_forest"] = rf_best

    metadata["models"]["random_forest"] = {
        "class": "RandomForestClassifier",
        "grid_search": rf_cv_grid,
        "cv_report": rf_cv_report,
    }
    logger.info("RandomForest saved to: %s", artifacts_path / "random_forest.joblib")

    # -------------------------------------------------------------------------
    # Save metadata (partial — evaluate.py will add test-set metrics)
    # -------------------------------------------------------------------------
    (artifacts_path / "model_metadata.json").write_text(
        json.dumps(metadata, indent=2, default=str)
    )
    logger.info("Model metadata saved (partial — evaluate.py will add test metrics)")
    logger.info("Training pipeline complete.")

    return models
