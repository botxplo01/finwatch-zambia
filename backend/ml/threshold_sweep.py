"""
FinWatch Zambia - LR Decision Threshold Calibration

Uses the preferred nested-split approach:
- Full dataset is split 80/20 into train_pool and test (RANDOM_STATE=42, stratified)
  — this is identical to the existing pipeline, reproducing the same test set.
- From train_pool, a further stratified 80/20 split gives train_fit and val_split
  BEFORE SMOTE is applied. SMOTE is applied only to train_fit.
- The LR model is retrained identically (same hyperparams) on the SMOTE-augmented
  train_fit, so val_split was NEVER seen during fitting.
- Threshold sweep is performed on val_split only (0.30 to 0.70, step 0.05).
- The chosen threshold is evaluated ONCE on the original held-out test set.

Limitation: This is a fresh fit on a slightly smaller training set (64% of total
vs 80%), so the exact model weights differ from the production artifact. However,
the threshold selection is methodologically clean and the chosen threshold is
applied to the PRODUCTION model artifact for final test evaluation.
The dual-evaluation (val sweep + single test-set eval on production model) is
the methodologically correct and academically defensible approach.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.constants import DISTRESS_CLASS_INDEX, RANDOM_STATE
from ml.preprocess import (
    handle_data_quality,
    load_dataset,
    select_and_map_features,
    SMOTE_K_NEIGHBOURS,
)
from app.services.ratio_engine import RATIO_NAMES

try:
    from imblearn.over_sampling import SMOTE
except ImportError:
    raise SystemExit("imblearn not found — run: pip install imbalanced-learn")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("threshold_sweep")

DATA_PATH = _BACKEND_DIR.parent / "data" / "3year.arff"
ARTIFACTS_PATH = _BACKEND_DIR / "ml" / "artifacts"
METADATA_PATH = ARTIFACTS_PATH / "model_metadata.json"

THRESHOLDS = [round(t, 2) for t in np.arange(0.30, 0.71, 0.05)]
TEST_SIZE = 0.20
VAL_SIZE = 0.20
MIN_RECALL_FLOOR = 0.55

# LR hyperparams matching the production grid-search best params
LR_PARAMS = {
    "C": 1.0,
    "class_weight": "balanced",
    "max_iter": 1000,
    "random_state": RANDOM_STATE,
    "solver": "lbfgs",
}

# Sample cases from the task specification
HEALTHY_SAMPLE = {
    "current_assets": 500_000,
    "current_liabilities": 200_000,
    "cash": 150_000,
    "inventory": 100_000,
    "total_assets": 1_200_000,
    "total_liabilities": 400_000,
    "total_equity": 800_000,
    "interest_expense": 20_000,
    "revenue": 600_000,
    "net_income": 120_000,
    "ebit": 180_000,
    "retained_earnings": 300_000,
}

DISTRESSED_SAMPLE = {
    "current_assets": 80_000,
    "current_liabilities": 200_000,
    "cash": 10_000,
    "inventory": 50_000,
    "total_assets": 500_000,
    "total_liabilities": 420_000,
    "total_equity": 80_000,
    "interest_expense": 50_000,
    "revenue": 150_000,
    "net_income": -80_000,
    "ebit": -30_000,
    "retained_earnings": -50_000,
}


def compute_ratios(s: dict) -> dict:
    """Compute the 10 FinWatch ratios from raw financial statement inputs."""
    ca = s["current_assets"]
    cl = s["current_liabilities"]
    cash = s["cash"]
    inv = s["inventory"]
    ta = s["total_assets"]
    tl = s["total_liabilities"]
    eq = s["total_equity"]
    ie = s["interest_expense"]
    rev = s["revenue"]
    ni = s["net_income"]
    ebit = s["ebit"]

    current_ratio = ca / cl if cl else 0.0
    quick_ratio = (ca - inv) / cl if cl else 0.0
    cash_ratio = cash / cl if cl else 0.0
    debt_to_equity = tl / eq if eq else 0.0
    debt_to_assets = tl / ta if ta else 0.0
    interest_coverage = ebit / ie if ie else 0.0
    net_profit_margin = ni / rev if rev else 0.0
    roa = ni / ta if ta else 0.0
    equity_ratio = eq / ta if ta else 0.0
    roe = roa / equity_ratio if equity_ratio else 0.0
    asset_turnover = rev / ta if ta else 0.0

    return {
        "current_ratio": current_ratio,
        "quick_ratio": quick_ratio,
        "cash_ratio": cash_ratio,
        "debt_to_equity": debt_to_equity,
        "debt_to_assets": debt_to_assets,
        "interest_coverage": interest_coverage,
        "net_profit_margin": net_profit_margin,
        "return_on_assets": roa,
        "return_on_equity": roe,
        "asset_turnover": asset_turnover,
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise SystemExit(f"Dataset not found: {DATA_PATH}")

    logger.info("=" * 70)
    logger.info("LR Decision Threshold Calibration — Nested Validation Approach")
    logger.info("=" * 70)

    # --- Stage 1: Reproduce the original 80/20 test split ---
    raw_df = load_dataset(DATA_PATH)
    mapped_df = select_and_map_features(raw_df)
    X_all = mapped_df[RATIO_NAMES].copy()
    y_all = mapped_df["class"].values
    X_all = handle_data_quality(X_all)

    X_train_pool, X_test, y_train_pool, y_test = train_test_split(
        X_all.values,
        y_all,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_all,
    )
    logger.info(
        "Train pool: %d | Test (held-out, untouched): %d | Distressed in test: %d",
        len(X_train_pool),
        len(X_test),
        int(np.sum(y_test == 1)),
    )

    # --- Stage 2: Carve a genuine validation split from train_pool BEFORE SMOTE ---
    X_train_fit, X_val, y_train_fit, y_val = train_test_split(
        X_train_pool,
        y_train_pool,
        test_size=VAL_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_train_pool,
    )
    logger.info(
        "After nested split — Train fit: %d | Val: %d | Distressed in val: %d",
        len(X_train_fit),
        len(X_val),
        int(np.sum(y_val == 1)),
    )

    # --- Stage 3: Apply SMOTE only to train_fit ---
    minority_count = int(np.sum(y_train_fit == 1))
    k = min(SMOTE_K_NEIGHBOURS, minority_count - 1)
    smote = SMOTE(k_neighbors=k, random_state=RANDOM_STATE)
    X_train_smote, y_train_smote = smote.fit_resample(X_train_fit, y_train_fit)
    logger.info(
        "SMOTE applied. Train fit after SMOTE: %d samples. Class dist: %s",
        len(X_train_smote),
        dict(zip(*np.unique(y_train_smote, return_counts=True))),
    )

    # --- Stage 4: Scale (fit only on train_fit, transform val) ---
    from sklearn.preprocessing import StandardScaler
    scaler_val = StandardScaler()
    X_train_smote_scaled = scaler_val.fit_transform(X_train_smote)
    X_val_scaled = scaler_val.transform(X_val)

    # --- Stage 5: Train a fresh LR with identical hyperparams ---
    lr_val = LogisticRegression(**LR_PARAMS)
    lr_val.fit(X_train_smote_scaled, y_train_smote)
    logger.info("Fresh LR fitted on nested train_fit split.")

    # --- Stage 6: Threshold sweep on validation split ---
    val_proba = lr_val.predict_proba(X_val_scaled)[:, DISTRESS_CLASS_INDEX]

    logger.info("\n%s", "=" * 70)
    logger.info("THRESHOLD SWEEP ON VALIDATION SPLIT")
    logger.info("%-10s  %-10s  %-10s  %-10s", "Threshold", "Precision", "Recall", "F1")
    logger.info("-" * 45)

    sweep_rows = []
    for thresh in THRESHOLDS:
        y_pred_val = (val_proba >= thresh).astype(int)
        prec = precision_score(y_val, y_pred_val, pos_label=1, zero_division=0)
        rec = recall_score(y_val, y_pred_val, pos_label=1, zero_division=0)
        f1 = f1_score(y_val, y_pred_val, pos_label=1, zero_division=0)
        sweep_rows.append({"threshold": thresh, "precision": prec, "recall": rec, "f1": f1})
        logger.info("  %.2f       %.4f     %.4f     %.4f", thresh, prec, rec, f1)

    # --- Stage 7: Select threshold (best F1 with recall >= MIN_RECALL_FLOOR) ---
    candidates = [r for r in sweep_rows if r["recall"] >= MIN_RECALL_FLOOR]
    if not candidates:
        logger.warning(
            "No threshold meets recall >= %.0f%%. Relaxing to best F1 overall.",
            MIN_RECALL_FLOOR * 100,
        )
        candidates = sweep_rows

    best = max(candidates, key=lambda r: r["f1"])
    chosen_threshold = best["threshold"]

    logger.info("\n%s", "=" * 70)
    logger.info(
        "CHOSEN THRESHOLD: %.2f  (val precision=%.4f  recall=%.4f  F1=%.4f)",
        chosen_threshold,
        best["precision"],
        best["recall"],
        best["f1"],
    )

    # --- Stage 8: Load PRODUCTION model + scaler; evaluate ONCE on test set ---
    logger.info("\n%s", "=" * 70)
    logger.info("ONE-TIME EVALUATION ON HELD-OUT TEST SET (production model)")
    logger.info("%s", "=" * 70)

    prod_lr = joblib.load(ARTIFACTS_PATH / "logistic_regression.joblib")
    prod_scaler = joblib.load(ARTIFACTS_PATH / "scaler.joblib")
    X_test_scaled = prod_scaler.transform(X_test)

    # Default 0.5 baseline on prod model
    y_pred_default = prod_lr.predict(X_test_scaled)
    proba_test = prod_lr.predict_proba(X_test_scaled)[:, DISTRESS_CLASS_INDEX]

    # New threshold on prod model
    y_pred_new = (proba_test >= chosen_threshold).astype(int)

    def distressed_class_metrics(y_true, y_pred, label=""):
        prec = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        rec = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
        acc = accuracy_score(y_true, y_pred)
        logger.info("%s:", label)
        logger.info("  Accuracy:              %.4f", acc)
        logger.info("  Distressed Precision:  %.4f  (%.2f%%)", prec, prec * 100)
        logger.info("  Distressed Recall:     %.4f  (%.2f%%)", rec, rec * 100)
        logger.info("  Distressed F1:         %.4f", f1)
        return {"accuracy": round(acc, 4), "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4)}

    logger.info("\n-- BEFORE (default threshold = 0.50) --")
    before = distressed_class_metrics(y_test, y_pred_default, "Default threshold 0.50")

    logger.info("\n-- AFTER (chosen threshold = %.2f) --", chosen_threshold)
    after = distressed_class_metrics(y_test, y_pred_new, f"Chosen threshold {chosen_threshold:.2f}")

    logger.info("\n-- DELTA --")
    logger.info("  Precision change: %+.2f%%", (after["precision"] - before["precision"]) * 100)
    logger.info("  Recall change:    %+.2f%%", (after["recall"] - before["recall"]) * 100)
    logger.info("  F1 change:        %+.4f", after["f1"] - before["f1"])

    # --- Stage 9: Verify RF is completely unaffected ---
    prod_rf = joblib.load(ARTIFACTS_PATH / "random_forest.joblib")
    rf_proba = prod_rf.predict_proba(X_test_scaled)[:, DISTRESS_CLASS_INDEX]
    rf_pred = prod_rf.predict(X_test_scaled)
    rf_acc = accuracy_score(y_test, rf_pred)
    logger.info("\n-- RF METRICS UNCHANGED VERIFICATION --")
    with open(METADATA_PATH) as f:
        meta = json.load(f)
    stored_rf_acc = meta["models"]["random_forest"]["test_metrics"]["accuracy"]
    logger.info("  Stored RF accuracy:   %.4f", stored_rf_acc)
    logger.info("  Recomputed RF acc:    %.4f", rf_acc)
    logger.info("  Match: %s", "YES" % () if abs(rf_acc - stored_rf_acc) < 1e-6 else "NO — MISMATCH")

    # --- Stage 10: Sample case prediction before/after ---
    logger.info("\n%s", "=" * 70)
    logger.info("SAMPLE CASE PREDICTIONS")
    logger.info("%s", "=" * 70)

    for label, sample in [("HEALTHY sample", HEALTHY_SAMPLE), ("DISTRESSED sample", DISTRESSED_SAMPLE)]:
        ratios = compute_ratios(sample)
        fv = np.array([[ratios[n] for n in RATIO_NAMES]])
        fv_scaled = prod_scaler.transform(fv)
        prob = float(prod_lr.predict_proba(fv_scaled)[0, DISTRESS_CLASS_INDEX])
        label_default = "Distressed" if prob >= 0.5 else "Healthy"
        label_new = "Distressed" if prob >= chosen_threshold else "Healthy"
        logger.info(
            "%s | P(distress)=%.4f | Default(0.50)=%s | New(%.2f)=%s",
            label, prob, label_default, chosen_threshold, label_new,
        )

    # --- Stage 11: Persist results as a new field in model_metadata.json ---
    with open(METADATA_PATH) as f:
        meta = json.load(f)

    meta["models"]["logistic_regression"]["recalibrated_threshold"] = {
        "note": "Threshold selected via nested validation split (not test set). "
                "SMOTE applied only to train_fit portion; val_split never seen during fitting. "
                "Production model evaluated ONCE on held-out test set at this threshold.",
        "approach": "preferred_nested_split",
        "chosen_threshold": chosen_threshold,
        "validation_split_metrics": {
            "threshold": chosen_threshold,
            "distressed_precision": round(best["precision"], 4),
            "distressed_recall": round(best["recall"], 4),
            "distressed_f1": round(best["f1"], 4),
        },
        "threshold_sweep_table": sweep_rows,
        "test_set_metrics_at_chosen_threshold": after,
        "test_set_metrics_at_default_050": before,
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(meta, f, indent=2, default=str)

    logger.info("\nResults appended to model_metadata.json under 'recalibrated_threshold'.")
    logger.info("\nCHOSEN THRESHOLD TO SET IN constants.py: LR_DISTRESS_THRESHOLD = %.2f", chosen_threshold)
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
