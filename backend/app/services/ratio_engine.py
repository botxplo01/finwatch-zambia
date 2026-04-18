# =============================================================================
# FinWatch Zambia — Ratio Engine Service
#
# Single source of truth for all financial ratio metadata and computation.
# Computes the 10 core financial ratios from raw financial statement inputs.
# These ratios form the feature vector fed directly into the ML models.
#
# Ratio groups:
#   Liquidity     — current_ratio, quick_ratio, cash_ratio
#   Leverage      — debt_to_equity, debt_to_assets, interest_coverage
#   Profitability — net_profit_margin, return_on_assets, return_on_equity
#   Activity      — asset_turnover
#
# Division-by-zero handling:
#   All ratios guard against zero denominators by returning 0.0.
#   The ML model was trained on data imputed with this same convention
#   (see ml/preprocess.py), so 0.0 is the correct sentinel for undefined ratios.
# =============================================================================

from __future__ import annotations

import logging

from app.schemas.financial_record import FinancialRecordRequest

logger = logging.getLogger(__name__)


# =============================================================================
# Ratio Metadata
# =============================================================================

# Ordered list of ratio names — ORDER IS CRITICAL.
# This order defines the feature vector passed to the ML models and SHAP.
# Must match FEATURE_COLUMNS in ml/preprocess.py exactly.
RATIO_NAMES: list[str] = [
    "current_ratio",
    "quick_ratio",
    "cash_ratio",
    "debt_to_equity",
    "debt_to_assets",
    "interest_coverage",
    "net_profit_margin",
    "return_on_assets",
    "return_on_equity",
    "asset_turnover",
]

# Clean benchmark values — used internally for ML metadata and ratio flagging.
# These are threshold strings for inequality comparisons.
RATIO_BENCHMARKS: dict[str, str] = {
    "current_ratio": ">= 1.5",
    "quick_ratio": ">= 1.0",
    "cash_ratio": ">= 0.2",
    "debt_to_equity": "<= 1.0",
    "debt_to_assets": "<= 0.5",
    "interest_coverage": ">= 3.0",
    "net_profit_margin": ">= 0.05",
    "return_on_assets": ">= 0.05",
    "return_on_equity": ">= 0.10",
    "asset_turnover": ">= 0.5",
}

# Human-readable benchmark strings — used in NLP prompts and UI display.
# Include percentage equivalents where relevant so non-specialists understand.
RATIO_BENCHMARKS_DISPLAY: dict[str, str] = {
    "current_ratio": ">= 1.5",
    "quick_ratio": ">= 1.0",
    "cash_ratio": ">= 0.2",
    "debt_to_equity": "<= 1.0",
    "debt_to_assets": "<= 0.5",
    "interest_coverage": ">= 3.0",
    "net_profit_margin": ">= 0.05 (5%)",
    "return_on_assets": ">= 0.05 (5%)",
    "return_on_equity": ">= 0.10 (10%)",
    "asset_turnover": ">= 0.5",
}

# Human-readable ratio display names for the UI and NLP narratives.
RATIO_DISPLAY_NAMES: dict[str, str] = {
    "current_ratio": "Current Ratio",
    "quick_ratio": "Quick Ratio",
    "cash_ratio": "Cash Ratio",
    "debt_to_equity": "Debt-to-Equity",
    "debt_to_assets": "Debt-to-Assets",
    "interest_coverage": "Interest Coverage",
    "net_profit_margin": "Net Profit Margin",
    "return_on_assets": "Return on Assets",
    "return_on_equity": "Return on Equity",
    "asset_turnover": "Asset Turnover",
}

# Ratio group classification — used for UI section grouping
RATIO_GROUPS: dict[str, list[str]] = {
    "Liquidity": ["current_ratio", "quick_ratio", "cash_ratio"],
    "Leverage": ["debt_to_equity", "debt_to_assets", "interest_coverage"],
    "Profitability": ["net_profit_margin", "return_on_assets", "return_on_equity"],
    "Activity": ["asset_turnover"],
}


# =============================================================================
# Computation
# =============================================================================


def compute_ratios(record: FinancialRecordRequest) -> dict[str, float]:
    """
    Derive the 10 financial ratios from a validated FinancialRecordRequest.

    Args:
        record: Validated financial statement inputs from the API layer.

    Returns:
        Dictionary mapping ratio name → computed float value.
        All values rounded to 6 decimal places for storage precision.
        Keys are always exactly RATIO_NAMES — no extras, no missing.
    """

    def safe_div(numerator: float, denominator: float) -> float:
        """
        Return numerator / denominator, or 0.0 if denominator is zero.
        Zero is the correct sentinel for undefined ratios — it matches the
        imputation convention used during ML training (ml/preprocess.py).
        """
        if denominator == 0.0:
            return 0.0
        return round(numerator / denominator, 6)

    ratios: dict[str, float] = {
        # ------------------------------------------------------------------
        # Liquidity — ability to meet short-term obligations
        # ------------------------------------------------------------------
        # Current Assets / Current Liabilities
        # >= 1.5: firm can cover short-term debts with room to spare
        "current_ratio": safe_div(
            record.current_assets,
            record.current_liabilities,
        ),
        # (Current Assets − Inventory) / Current Liabilities
        # Excludes inventory — may not be quickly convertible to cash
        "quick_ratio": safe_div(
            record.current_assets - record.inventory,
            record.current_liabilities,
        ),
        # Cash & Equivalents / Current Liabilities
        # Most conservative measure — pure liquid cash coverage only
        "cash_ratio": safe_div(
            record.cash_and_equivalents,
            record.current_liabilities,
        ),
        # ------------------------------------------------------------------
        # Leverage — degree of financial risk from debt obligations
        # ------------------------------------------------------------------
        # Total Liabilities / Total Equity
        # High values signal heavy reliance on debt financing
        "debt_to_equity": safe_div(
            record.total_liabilities,
            record.total_equity,
        ),
        # Total Liabilities / Total Assets
        # > 0.5 means more than half of assets are debt-financed (risk signal)
        "debt_to_assets": safe_div(
            record.total_liabilities,
            record.total_assets,
        ),
        # EBIT / Interest Expense
        # < 1.0 means the firm cannot cover interest from operations
        "interest_coverage": safe_div(
            record.ebit,
            record.interest_expense,
        ),
        # ------------------------------------------------------------------
        # Profitability — efficiency in generating earnings
        # ------------------------------------------------------------------
        # Net Income / Revenue
        # Percentage of revenue converting to profit (can be negative)
        "net_profit_margin": safe_div(
            record.net_income,
            record.revenue,
        ),
        # Net Income / Total Assets
        # Return on every unit of assets deployed (can be negative)
        "return_on_assets": safe_div(
            record.net_income,
            record.total_assets,
        ),
        # Net Income / Total Equity
        # Return generated for equity holders (can be negative)
        "return_on_equity": safe_div(
            record.net_income,
            record.total_equity,
        ),
        # ------------------------------------------------------------------
        # Activity — efficiency in using assets to generate revenue
        # ------------------------------------------------------------------
        # Revenue / Total Assets
        # Revenue generated per unit of assets held
        "asset_turnover": safe_div(
            record.revenue,
            record.total_assets,
        ),
    }

    logger.debug("Computed ratios for record: %s", ratios)
    return ratios


# =============================================================================
# Utility functions
# =============================================================================


def ratios_to_feature_vector(ratios: dict[str, float]) -> list[float]:
    """
    Convert the ratios dict to an ordered list matching the ML training
    feature order. Order is defined by RATIO_NAMES.

    CRITICAL: The order of features in this vector must be identical to
    FEATURE_COLUMNS in ml/preprocess.py. Any mismatch will corrupt
    predictions silently — the model will receive features in the wrong
    order without raising an error.

    Args:
        ratios: Dict of ratio_name → float value (must contain all RATIO_NAMES).

    Returns:
        Ordered list of ratio values ready for model.predict().
    """
    validate_ratio_keys(ratios)
    return [ratios[name] for name in RATIO_NAMES]


def validate_ratio_keys(ratios: dict[str, float]) -> None:
    """
    Assert that a ratios dict contains exactly the expected keys.

    Raises:
        ValueError if any ratio name is missing or unexpected keys are present.

    Used by ml_service.py before passing the feature vector to the model
    to catch mismatches between the ratio engine and the training pipeline.
    """
    expected = set(RATIO_NAMES)
    actual = set(ratios.keys())

    missing = expected - actual
    unexpected = actual - expected

    if missing or unexpected:
        parts = []
        if missing:
            parts.append(f"Missing ratios: {sorted(missing)}")
        if unexpected:
            parts.append(f"Unexpected ratios: {sorted(unexpected)}")
        raise ValueError(
            f"Ratio key mismatch — {'; '.join(parts)}. "
            f"Expected exactly: {sorted(expected)}"
        )


def get_ratio_benchmark_table() -> list[dict]:
    """
    Return a structured benchmark table for frontend display.

    Each entry contains the ratio name, display name, benchmark string,
    and group classification — everything the UI needs to render the
    ratio comparison table without additional lookups.

    Returns:
        List of dicts with keys:
          name         — machine name (e.g. "current_ratio")
          display_name — human label (e.g. "Current Ratio")
          benchmark    — display benchmark (e.g. ">= 1.5")
          group        — category (e.g. "Liquidity")
    """
    # Build a reverse lookup: ratio_name → group
    name_to_group = {
        ratio: group for group, ratios in RATIO_GROUPS.items() for ratio in ratios
    }

    return [
        {
            "name": name,
            "display_name": RATIO_DISPLAY_NAMES[name],
            "benchmark": RATIO_BENCHMARKS_DISPLAY[name],
            "group": name_to_group.get(name, "Other"),
        }
        for name in RATIO_NAMES
    ]
