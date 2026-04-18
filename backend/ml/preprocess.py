# =============================================================================
# FinWatch Zambia — Data Preprocessing Pipeline
#
# Loads the UCI Polish Companies Bankruptcy dataset, maps the 10 most
# relevant features to our RATIO_NAMES, handles data quality issues,
# applies SMOTE for class imbalance, and fits a StandardScaler.
#
# Dataset:
#   Zieba, M., Tomczak, S.K. and Tomczak, J.M. (2016) 'Ensemble boosted
#   trees with synthetic features generation in application to bankruptcy
#   prediction', Expert Systems with Applications, 58, pp. 93–101.
#   DOI: 10.24432/C5V61K
#
# Feature mapping (UCI Attr → FinWatch ratio):
#   Attr1  → return_on_assets     Net profit / Total assets                [Exact]
#   Attr2  → debt_to_assets       Total liabilities / Total assets          [Exact]
#   Attr4  → current_ratio        Current assets / Short-term liabilities   [Exact]
#   Attr46 → quick_ratio          (CA − Inventory) / Short-term liabilities [Exact]
#   Attr40 → cash_ratio           (CA − Inv − Recv) / STL                  [Proxy]
#   Attr8  → debt_to_equity       Equity/Liabilities → inverted to L/E     [Proxy]
#   Attr27 → interest_coverage    Op. profit / Financial expenses           [Proxy]
#   Attr23 → net_profit_margin    Net profit / Sales                        [Exact]
#   Attr9  → asset_turnover       Sales / Total assets                      [Exact]
#   Attr10 → (equity_ratio)       Equity / Total assets (intermediate only)
#   derived → return_on_equity    Attr1 / Attr10 = ROA / equity ratio       [Derived]
#
# Contextual note:
#   The UCI dataset contains Polish firm data. The World Bank Zambia
#   Enterprise Survey 2019–2020 confirms that Zambian SME financial
#   vulnerability patterns (cash flow constraints, leverage pressure,
#   low profitability) are structurally analogous to the distress
#   signals captured in the Polish dataset, justifying its use as a
#   training proxy (World Bank, 2020; FSD Zambia, 2020).
# =============================================================================

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

# Ensure imports from backend/ work when running as a script
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.ratio_engine import RATIO_NAMES

logger = logging.getLogger(__name__)

# =============================================================================
# Feature Mapping
# =============================================================================

# Ordered mapping: UCI attribute name → FinWatch ratio name.
# ORDER determines feature vector position — must stay in RATIO_NAMES order.
# Attr10 is included as an intermediate for deriving return_on_equity.
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

# Features used in UCI → maps to the final RATIO_NAMES (minus intermediate)
UCI_FEATURES = list(UCI_TO_RATIO_MAPPING.keys())

# Clipping percentiles — preserves extreme distress signals while removing
# erroneous data entry artefacts (e.g. division errors producing values > 1000)
CLIP_LOWER_PCT = 1
CLIP_UPPER_PCT = 99

# Reproducibility seed — fixed for dissertation replicability
RANDOM_STATE = 42

# Train/test split ratio
TEST_SIZE = 0.2

# SMOTE k-neighbours — default 5 is standard; reduced if minority class is small
SMOTE_K_NEIGHBOURS = 5


# =============================================================================
# Loading
# =============================================================================


def load_arff(file_path: Path) -> pd.DataFrame:
    """
    Load a UCI Polish Companies Bankruptcy ARFF file into a DataFrame.

    Handles byte-string class labels produced by scipy.io.arff
    (class values appear as b'0' and b'1' in Python 3).

    Args:
        file_path: Path to the .arff file.

    Returns:
        DataFrame with columns Attr1–Attr64 + 'class' (integer 0/1).
    """
    logger.info("Loading ARFF file: %s", file_path)
    data, meta = arff.loadarff(str(file_path))
    df = pd.DataFrame(data)

    # Decode byte-string columns (scipy.io.arff produces bytes in Python 3)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(
                lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
            )

    # Convert class to integer — 1 = distressed (bankrupt), 0 = healthy
    df["class"] = pd.to_numeric(df["class"], errors="coerce").astype(int)

    logger.info(
        "Loaded %d records, %d features. Class distribution: %s",
        len(df),
        len(df.columns) - 1,
        df["class"].value_counts().to_dict(),
    )
    return df


def load_csv(file_path: Path) -> pd.DataFrame:
    """
    Load the dataset from CSV format (alternative to ARFF).
    Expects columns named Attr1, Attr2, ..., AttrN, class.
    """
    logger.info("Loading CSV file: %s", file_path)
    df = pd.read_csv(str(file_path))
    df["class"] = df["class"].astype(int)
    return df


def load_dataset(file_path: Path) -> pd.DataFrame:
    """
    Load dataset from ARFF or CSV based on file extension.

    Args:
        file_path: Path to .arff or .csv file.

    Returns:
        Raw DataFrame.
    """
    suffix = file_path.suffix.lower()
    if suffix == ".arff":
        return load_arff(file_path)
    elif suffix == ".csv":
        return load_csv(file_path)
    else:
        raise ValueError(f"Unsupported file format: {suffix}. Use .arff or .csv")


# =============================================================================
# Feature Engineering
# =============================================================================


def select_and_map_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Select the 10 proxy features from the UCI dataset and map them to
    FinWatch RATIO_NAMES.

    Transformations applied:
      debt_to_equity:    UCI Attr8 = equity/liabilities → inverted to L/E
      return_on_equity:  Derived as Attr1 / Attr10 (ROA / equity_ratio)

    Args:
        df: Raw UCI DataFrame with Attr1–Attr64 + class.

    Returns:
        DataFrame with exactly RATIO_NAMES columns + class.
    """
    # Verify required UCI features are present
    missing = [f for f in UCI_FEATURES if f not in df.columns]
    if missing:
        raise ValueError(
            f"UCI dataset is missing required features: {missing}. "
            f"Ensure you are using the Polish Companies Bankruptcy dataset "
            f"(doi: 10.24432/C5V61K)."
        )

    # Select and rename mapped features
    selected = df[UCI_FEATURES + ["class"]].copy()
    rename_map = {k: v for k, v in UCI_TO_RATIO_MAPPING.items()}
    selected = selected.rename(columns=rename_map)

    # --- Transformation 1: debt_to_equity ---
    # UCI Attr8 = book_equity / total_liabilities
    # Our ratio = total_liabilities / book_equity = 1 / Attr8
    # Safe inversion: 0.0 where Attr8 is 0 (matches ratio_engine safe_div convention)
    selected["debt_to_equity"] = np.where(
        selected["debt_to_equity"] == 0,
        0.0,
        1.0 / selected["debt_to_equity"],
    )

    # --- Transformation 2: return_on_equity ---
    # return_on_equity = net_income / equity
    # = (net_income / total_assets) / (equity / total_assets)
    # = return_on_assets / _equity_ratio
    selected["return_on_equity"] = np.where(
        selected["_equity_ratio"] == 0,
        0.0,
        selected["return_on_assets"] / selected["_equity_ratio"],
    )

    # Drop the intermediate equity_ratio column
    selected = selected.drop(columns=["_equity_ratio"])

    # Reorder columns to match RATIO_NAMES exactly
    selected = selected[RATIO_NAMES + ["class"]]

    logger.info("Feature mapping complete. Final columns: %s", list(selected.columns))
    return selected


# =============================================================================
# Data Quality
# =============================================================================


def handle_data_quality(df: pd.DataFrame) -> pd.DataFrame:
    """
    Address data quality issues in financial ratio data:

    1. Replace inf/-inf with NaN — common in ratios with near-zero denominators
    2. Impute NaN with column median — robust to outliers and skewed distributions.
       Median imputation is preferred over mean for financial ratios because
       ratio distributions are typically right-skewed (Bellovary et al., 2007).
    3. Clip outliers at 1st/99th percentile — preserves genuine extreme distress
       signals while removing data entry artefacts.

    Args:
        df: Feature DataFrame (no class column).

    Returns:
        Cleaned DataFrame.
    """
    feature_cols = RATIO_NAMES

    initial_na = df[feature_cols].isna().sum().sum()
    logger.info("Missing values before imputation: %d", initial_na)

    # Step 1: Replace inf/-inf with NaN
    df[feature_cols] = df[feature_cols].replace([np.inf, -np.inf], np.nan)

    inf_count = df[feature_cols].isna().sum().sum() - initial_na
    logger.info("Infinite values converted to NaN: %d", inf_count)

    # Step 2: Median imputation per feature column
    medians = df[feature_cols].median()
    df[feature_cols] = df[feature_cols].fillna(medians)

    final_na = df[feature_cols].isna().sum().sum()
    logger.info("Missing values after median imputation: %d", final_na)

    # Step 3: Clip outliers at 1st/99th percentile
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


# =============================================================================
# Main Pipeline
# =============================================================================


def load_and_preprocess(
    data_path: Path,
    artifacts_path: Path,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> dict:
    """
    Full preprocessing pipeline: load → map → clean → split → SMOTE → scale.

    Pipeline design choices:
      - SMOTE applied AFTER train/test split to prevent data leakage:
        synthetic samples must not appear in the test set.
      - StandardScaler fitted AFTER SMOTE on the augmented training set.
      - Test set is scaled using the training-fitted scaler only.
      - SMOTE k_neighbours reduced if minority class is very small.

    Args:
        data_path:      Path to the UCI .arff or .csv dataset file.
        artifacts_path: Directory to save all preprocessing artifacts.
        test_size:      Proportion of data reserved for test (default 0.2).
        random_state:   Seed for reproducibility (default 42).

    Returns:
        Dict with keys: X_train, X_test, y_train, y_test, scaler,
                        feature_names, class_distribution.
    """
    artifacts_path.mkdir(parents=True, exist_ok=True)

    # --- Stage 1: Load ---
    raw_df = load_dataset(data_path)

    # --- Stage 2: Feature selection and mapping ---
    mapped_df = select_and_map_features(raw_df)

    # --- Stage 3: Separate features and target ---
    X = mapped_df[RATIO_NAMES].copy()
    y = mapped_df["class"].values

    # --- Stage 4: Data quality ---
    X = handle_data_quality(X)

    # --- Stage 5: Log class distribution ---
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

    # --- Stage 6: Stratified train/test split ---
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

    # --- Stage 7: SMOTE on training data only ---
    # Adjust k_neighbours if minority class count is very small
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

    # --- Stage 8: StandardScaler fit on SMOTE'd training data ---
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_resampled)
    X_test_scaled = scaler.transform(X_test)

    logger.info(
        "StandardScaler fitted. Feature means: %s",
        dict(zip(RATIO_NAMES, scaler.mean_.round(4).tolist())),
    )

    # --- Stage 9: Save artifacts ---
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
