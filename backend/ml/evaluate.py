"""
FinWatch Zambia - Model Evaluation Pipeline

Evaluates both trained models on the held-out test set and computes all dissertation metrics:
Accuracy, Precision, Recall, F1, ROC-AUC, PR-AUC.

Artifacts saved:
- ml/artifacts/model_metadata.json — extended with test-set metrics
- ml/artifacts/roc_curve_{model}.json — FPR/TPR arrays for plotting
- ml/artifacts/pr_curve_{model}.json — Precision/Recall arrays
- ml/artifacts/confusion_matrix_{model}.json
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    auc,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

DISTRESS_CLASS_INDEX = 1




def compute_test_metrics(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
    model_name: str,
) -> dict:
    """Compute the full set of dissertation evaluation metrics on the test set."""
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, DISTRESS_CLASS_INDEX]

    accuracy = round(float(accuracy_score(y_test, y_pred)), 4)
    precision = round(
        float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4
    )
    recall = round(
        float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4
    )
    f1 = round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4)
    roc_auc = round(float(roc_auc_score(y_test, y_proba)), 4)
    pr_auc = round(float(average_precision_score(y_test, y_proba)), 4)

    report = classification_report(
        y_test,
        y_pred,
        target_names=["Healthy", "Distressed"],
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    logger.info(
        "\n%s Test Set Evaluation:\n"
        "  Accuracy:  %.4f\n"
        "  Precision: %.4f (macro)\n"
        "  Recall:    %.4f (macro)\n"
        "  F1:        %.4f (macro)\n"
        "  ROC-AUC:   %.4f\n"
        "  PR-AUC:    %.4f\n"
        "  Confusion Matrix:\n"
        "    TN=%d  FP=%d\n"
        "    FN=%d  TP=%d",
        model_name,
        accuracy,
        precision,
        recall,
        f1,
        roc_auc,
        pr_auc,
        tn,
        fp,
        fn,
        tp,
    )

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "per_class": report,
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
        "n_test_samples": int(len(y_test)),
        "n_distressed": int(np.sum(y_test == 1)),
        "n_healthy": int(np.sum(y_test == 0)),
    }


def compute_curves(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> dict:
    """Compute ROC curve and Precision-Recall curve arrays for plotting."""
    y_proba = model.predict_proba(X_test)[:, DISTRESS_CLASS_INDEX]

    fpr, tpr, roc_thresholds = roc_curve(y_test, y_proba)
    roc_auc_val = auc(fpr, tpr)

    precision_arr, recall_arr, pr_thresholds = precision_recall_curve(y_test, y_proba)
    pr_auc_val = auc(recall_arr, precision_arr)

    return {
        "roc": {
            "fpr": fpr.tolist(),
            "tpr": tpr.tolist(),
            "thresholds": roc_thresholds.tolist(),
            "auc": round(float(roc_auc_val), 4),
        },
        "pr": {
            "precision": precision_arr.tolist(),
            "recall": recall_arr.tolist(),
            "thresholds": pr_thresholds.tolist(),
            "auc": round(float(pr_auc_val), 4),
        },
    }




def evaluate_all_models(
    models: dict[str, Any],
    X_test: np.ndarray,
    y_test: np.ndarray,
    artifacts_path: Path,
) -> dict:
    """Evaluate all trained models on the test set and save metrics."""
    metadata_path = artifacts_path / "model_metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        metadata = {"models": {}, "feature_names": RATIO_NAMES}

    all_results = {}

    for model_name, model in models.items():
        logger.info("=" * 60)
        logger.info("Evaluating: %s", model_name)
        logger.info("=" * 60)

        metrics = compute_test_metrics(model, X_test, y_test, model_name)
        all_results[model_name] = metrics

        curves = compute_curves(model, X_test, y_test)

        (artifacts_path / f"roc_curve_{model_name}.json").write_text(
            json.dumps(curves["roc"], indent=2)
        )
        (artifacts_path / f"pr_curve_{model_name}.json").write_text(
            json.dumps(curves["pr"], indent=2)
        )
        (artifacts_path / f"confusion_matrix_{model_name}.json").write_text(
            json.dumps(metrics["confusion_matrix"], indent=2)
        )

        if model_name not in metadata["models"]:
            metadata["models"][model_name] = {}
        metadata["models"][model_name]["test_metrics"] = metrics

    logger.info("\n" + "=" * 60)
    logger.info("MODEL COMPARISON (Test Set)")
    logger.info("=" * 60)
    logger.info(
        "%-30s  %-8s  %-8s  %-8s  %-8s  %-8s  %-8s",
        "Model",
        "Acc",
        "Prec",
        "Recall",
        "F1",
        "ROC-AUC",
        "PR-AUC",
    )
    logger.info("-" * 90)
    for name, r in all_results.items():
        logger.info(
            "%-30s  %-8.4f  %-8.4f  %-8.4f  %-8.4f  %-8.4f  %-8.4f",
            name,
            r["accuracy"],
            r["precision"],
            r["recall"],
            r["f1"],
            r["roc_auc"],
            r["pr_auc"],
        )

    metadata_path.write_text(json.dumps(metadata, indent=2, default=str))
    logger.info("Evaluation complete. Metrics saved to: %s", metadata_path)

    return all_results
