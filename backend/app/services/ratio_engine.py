# =============================================================================
# FinWatch Zambia — Ratio Engine Service
#
# Computes the 10 core financial ratios from raw financial statement inputs.
# These ratios form the feature vector fed into the ML models.
#
# Ratio groups:
#   Liquidity     — current_ratio, quick_ratio, cash_ratio
#   Leverage      — debt_to_equity, debt_to_assets, interest_coverage
#   Profitability — net_profit_margin, return_on_assets, return_on_equity
#   Activity      — asset_turnover
#
# Division-by-zero handling:
#   All ratios guard against zero denominators by returning 0.0.
#   This is a deliberate design decision — the ML model was trained on
#   imputed data using the same convention (see ml/preprocess.py).
# =============================================================================

from __future__ import annotations

import logging

from app.schemas.financial_record import FinancialRecordRequest

logger = logging.getLogger(__name__)

# Healthy benchmark reference values for display in the UI and NLP narratives
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

RATIO_NAMES: list[str] = list(RATIO_BENCHMARKS.keys())


def compute_ratios(record: FinancialRecordRequest) -> dict[str, float]:
    """
    Derive the 10 financial ratios from a validated FinancialRecordRequest.

    Args:
        record: Validated financial statement inputs.

    Returns:
        Dictionary mapping ratio name → computed float value.
        All values are rounded to 6 decimal places for storage precision.
    """

    def safe_div(numerator: float, denominator: float) -> float:
        """Return numerator / denominator, or 0.0 if denominator is zero."""
        if denominator == 0.0:
            return 0.0
        return round(numerator / denominator, 6)

    ratios: dict[str, float] = {
        # ------------------------------------------------------------------
        # Liquidity Ratios
        # Measure ability to meet short-term obligations
        # ------------------------------------------------------------------
        # Current Assets / Current Liabilities
        # A ratio >= 1.5 indicates the firm can comfortably cover short-term debts
        "current_ratio": safe_div(
            record.current_assets,
            record.current_liabilities,
        ),
        # (Current Assets - Inventory) / Current Liabilities
        # Excludes inventory since it may not be quickly convertible to cash
        "quick_ratio": safe_div(
            record.current_assets - record.inventory,
            record.current_liabilities,
        ),
        # Cash & Equivalents / Current Liabilities
        # Most conservative liquidity measure — pure cash coverage
        "cash_ratio": safe_div(
            record.cash_and_equivalents,
            record.current_liabilities,
        ),
        # ------------------------------------------------------------------
        # Leverage Ratios
        # Measure degree of financial risk from debt obligations
        # ------------------------------------------------------------------
        # Total Liabilities / Total Equity
        # High values indicate heavy reliance on debt financing
        "debt_to_equity": safe_div(
            record.total_liabilities,
            record.total_equity,
        ),
        # Total Liabilities / Total Assets
        # Proportion of assets financed by liabilities; > 0.5 signals risk
        "debt_to_assets": safe_div(
            record.total_liabilities,
            record.total_assets,
        ),
        # EBIT / Interest Expense
        # Measures how easily the firm services its debt interest payments
        "interest_coverage": safe_div(
            record.ebit,
            record.interest_expense,
        ),
        # ------------------------------------------------------------------
        # Profitability Ratios
        # Measure efficiency in generating earnings
        # ------------------------------------------------------------------
        # Net Income / Revenue
        # Percentage of revenue that translates into profit
        "net_profit_margin": safe_div(
            record.net_income,
            record.revenue,
        ),
        # Net Income / Total Assets
        # How efficiently assets are used to generate profit
        "return_on_assets": safe_div(
            record.net_income,
            record.total_assets,
        ),
        # Net Income / Total Equity
        # Return generated for shareholders on their equity investment
        "return_on_equity": safe_div(
            record.net_income,
            record.total_equity,
        ),
        # ------------------------------------------------------------------
        # Activity Ratios
        # Measure efficiency in using assets to generate revenue
        # ------------------------------------------------------------------
        # Revenue / Total Assets
        # How much revenue is generated per unit of assets held
        "asset_turnover": safe_div(
            record.revenue,
            record.total_assets,
        ),
    }

    logger.debug("Computed ratios: %s", ratios)
    return ratios


def ratios_to_feature_vector(ratios: dict[str, float]) -> list[float]:
    """
    Convert the ratios dict to an ordered list matching the training
    feature order. Order must match ml/preprocess.py FEATURE_COLUMNS exactly.
    """
    return [ratios[name] for name in RATIO_NAMES]
