"""
FinWatch Zambia - Data Preprocessing Pipeline

Loads the UCI Polish Companies Bankruptcy dataset, maps the 10 most
relevant features to our RATIO_NAMES, handles data quality issues,
applies SMOTE for class imbalance, and fits a StandardScaler.

Dataset: Zieba et al. (2016), Expert Systems with Applications, DOI: 10.24432/C5V61K
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from scipy.io import arff
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

UCI_TO_RATIO_MAPPING: dict[str, str] = {
    "Attr4": "current_ratio",
    "Attr46": "quick_ratio",
    "Attr40": "cash_ratio",
    "Attr2": "debt_to_assets",
    "Attr8": "debt_to_equity",  # equity/liabilities → will be inverted
    "Attr27": "interest_coverage",
    "Attr23": "net_profit_margin",
    "Attr1": "return_on_assets",
    "Attr10": "_equity_ratio",  # intermediate: equity/total_assets
    "Attr9": "asset_turnover",
}

UCI_FEATURES = list(UCI_TO_RATIO_MAPPING.keys())

CLIP_LOWER_PCT = 1
CLIP_UPPER_PCT = 99

RANDOM_STATE = 42

TEST_SIZE = 0.2

SMOTE_K_NEIGHBOURS = 5




def load_arff(file_path: Path) -> pd.DataFrame:
    """Load a UCI Polish Companies Bankruptcy ARFF file into a DataFrame."""
    logger.info("Loading ARFF file: %s", file_path)
    data, meta = arff.loadarff(str(file_path))
    df = pd.DataFrame(data)

    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(
                lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
            )

    df["class"] = pd.to_numeric(df["class"], errors="coerce").astype(int)

    logger.info(
        "Loaded %d records, %d features. Class distribution: %s",
        len(df),
        len(df.columns) - 1,
        df["class"].value_counts().to_dict(),
    )
    return df


def load_csv(file_path: Path) -> pd.DataFrame:
    """Load the dataset from CSV format (alternative to ARFF)."""
    logger.info("Loading CSV file: %s", file_path)
    df = pd.read_csv(str(file_path))
    df["class"] = df["class"].astype(int)
    return df


def load_dataset(file_path: Path) -> pd.DataFrame:
    """Load dataset from ARFF or CSV based on file extension."""
    suffix = file_path.suffix.lower()
    if suffix == ".arff":
        return load_arff(file_path)
    elif suffix == ".csv":
        return load_csv(file_path)
    else:
        raise ValueError(f"Unsupported file format: {suffix}. Use .arff or .csv")




def select_and_map_features(df: pd.DataFrame) -> pd.DataFrame:
    """Select the 10 proxy features from the UCI dataset and map them to FinWatch RATIO_NAMES."""
    missing = [f for f in UCI_FEATURES if f not in df.columns]
    if missing:
        raise ValueError(
            f"UCI dataset is missing required features: {missing}. "
            f"Ensure you are using the Polish Companies Bankruptcy dataset "
            f"(doi: 10.24432/C5V61K)."
        )

    selected = df[UCI_FEATURES + ["class"]].copy()
    rename_map = {k: v for k, v in UCI_TO_RATIO_MAPPING.items()}
    selected = selected.rename(columns=rename_map)

    selected["debt_to_equity"] = np.where(
        selected["debt_to_equity"] == 0,
        0.0,
        1.0 / selected["debt_to_equity"],
    )

    selected["return_on_equity"] = np.where(
        selected["_equity_ratio"] == 0,
        0.0,
        selected["return_on_assets"] / selected["_equity_ratio"],
    )

    selected = selected.drop(columns=["_equity_ratio"])

    selected = selected[RATIO_NAMES + ["class"]]

    logger.info("Feature mapping complete. Final columns: %s", list(selected.columns))
    return selected




def handle_data_quality(df: pd.DataFrame) -> pd.DataFrame:
    """Address data quality issues in financial ratio data."""
    feature_cols = RATIO_NAMES

    initial_na = df[feature_cols].isna().sum().sum()
    logger.info("Missing values before imputation: %d", initial_na)

    df[feature_cols] = df[feature_cols].replace([np.inf, -np.inf], np.nan)

    inf_count = df[feature_cols].isna().sum().sum() - initial_na
    logger.info("Infinite values converted to NaN: %d", inf_count)

    medians = df[feature_cols].median()
    df[feature_cols] = df[feature_cols].fillna(medians)

    final_na = df[feature_cols].isna().sum().sum()
    logger.info("Missing values after median imputation: %d", final_na)

    for col in feature_cols:
        lower = df[col].quantile(CLIP_LOWER_PCT / 100)
        upper = df[col].quantile(CLIP_UPPER_PCT / 100)
        df[col] = df[col].clip(lower=lower, upper=upper)

    logger.info(
        "Outlier clipping applied at [%d%%, %d%%] percentiles",
        CLIP_LOWER_PCT,
        CLIP_UPPER_PCT,
    )

    return df




def load_and_preprocess(
    data_path: Path,
    artifacts_path: Path,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> dict:
    """Full preprocessing pipeline: load → map → clean → split → SMOTE → scale."""
    artifacts_path.mkdir(parents=True, exist_ok=True)

    raw_df = load_dataset(data_path)

    mapped_df = select_and_map_features(raw_df)

    X = mapped_df[RATIO_NAMES].copy()
    y = mapped_df["class"].values

    X = handle_data_quality(X)

    unique, counts = np.unique(y, return_counts=True)
    class_dist = dict(zip(unique.tolist(), counts.tolist()))
    total = sum(counts)
    imbalance_ratio = max(counts) / min(counts)
    logger.info(
        "Class distribution — Healthy (0): %d (%.1f%%), Distressed (1): %d (%.1f%%) | "
        "Imbalance ratio: %.2f:1",
        class_dist.get(0, 0),
        class_dist.get(0, 0) / total * 100,
        class_dist.get(1, 0),
        class_dist.get(1, 0) / total * 100,
        imbalance_ratio,
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X.values,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,  # Preserves class proportions in both splits
    )
    logger.info(
        "Train/test split: %d train (%.0f%%), %d test (%.0f%%)",
        len(X_train),
        (1 - test_size) * 100,
        len(X_test),
        test_size * 100,
    )

    minority_count = int(np.sum(y_train == 1))
    k_neighbours = min(SMOTE_K_NEIGHBOURS, minority_count - 1)
    if k_neighbours < SMOTE_K_NEIGHBOURS:
        logger.warning(
            "SMOTE k_neighbours reduced to %d (minority class has only %d samples)",
            k_neighbours,
            minority_count,
        )

    smote = SMOTE(k_neighbors=k_neighbours, random_state=random_state)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

    unique_r, counts_r = np.unique(y_train_resampled, return_counts=True)
    logger.info(
        "After SMOTE — Train class distribution: %s (total: %d)",
        dict(zip(unique_r.tolist(), counts_r.tolist())),
        len(y_train_resampled),
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_resampled)
    X_test_scaled = scaler.transform(X_test)

    logger.info(
        "StandardScaler fitted. Feature means: %s",
        dict(zip(RATIO_NAMES, scaler.mean_.round(4).tolist())),
    )

    joblib.dump(scaler, artifacts_path / "scaler.joblib")
    np.save(artifacts_path / "X_train.npy", X_train_scaled)
    np.save(artifacts_path / "X_test.npy", X_test_scaled)
    np.save(artifacts_path / "y_train.npy", y_train_resampled)
    np.save(artifacts_path / "y_test.npy", y_test)

    import json

    (artifacts_path / "feature_names.json").write_text(
        json.dumps(
            {"feature_names": RATIO_NAMES, "n_features": len(RATIO_NAMES)}, indent=2
        )
    )

    logger.info(
        "Preprocessing complete. Artifacts saved to: %s\n"
        "  X_train shape: %s | X_test shape: %s",
        artifacts_path,
        X_train_scaled.shape,
        X_test_scaled.shape,
    )

    return {
        "X_train": X_train_scaled,
        "X_test": X_test_scaled,
        "y_train": y_train_resampled,
        "y_test": y_test,
        "scaler": scaler,
        "feature_names": RATIO_NAMES,
        "class_distribution": class_dist,
    }
