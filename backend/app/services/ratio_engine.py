"""
FinWatch Zambia - Ratio Engine Service

Single source of truth for financial ratio metadata and computation.
Computes the 10 core financial ratios from raw financial statement inputs.

Ratio groups:
- Liquidity: current_ratio, quick_ratio, cash_ratio
- Leverage: debt_to_equity, debt_to_assets, interest_coverage
- Profitability: net_profit_margin, return_on_assets, return_on_equity
- Activity: asset_turnover

Division-by-zero handling: All ratios guard against zero denominators by returning 0.0.
"""

from __future__ import annotations

import logging

from app.schemas.financial_record import FinancialRecordRequest

logger = logging.getLogger(__name__)

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

RATIO_GROUPS: dict[str, list[str]] = {
    "Liquidity": ["current_ratio", "quick_ratio", "cash_ratio"],
    "Leverage": ["debt_to_equity", "debt_to_assets", "interest_coverage"],
    "Profitability": ["net_profit_margin", "return_on_assets", "return_on_equity"],
    "Activity": ["asset_turnover"],
}


def compute_ratios(record: FinancialRecordRequest) -> dict[str, float]:
    """Derive the 10 financial ratios from a validated FinancialRecordRequest."""
    def safe_div(numerator: float, denominator: float) -> float:
        if denominator == 0.0:
            return 0.0
        return round(numerator / denominator, 6)

    ratios: dict[str, float] = {
        "current_ratio": safe_div(record.current_assets, record.current_liabilities),
        "quick_ratio": safe_div(record.current_assets - record.inventory, record.current_liabilities),
        "cash_ratio": safe_div(record.cash_and_equivalents, record.current_liabilities),
        "debt_to_equity": safe_div(record.total_liabilities, record.total_equity),
        "debt_to_assets": safe_div(record.total_liabilities, record.total_assets),
        "interest_coverage": safe_div(record.ebit, record.interest_expense),
        "net_profit_margin": safe_div(record.net_income, record.revenue),
        "return_on_assets": safe_div(record.net_income, record.total_assets),
        "return_on_equity": safe_div(record.net_income, record.total_equity),
        "asset_turnover": safe_div(record.revenue, record.total_assets),
    }

    logger.debug("Computed ratios for record: %s", ratios)
    return ratios


def ratios_to_feature_vector(ratios: dict[str, float]) -> list[float]:
    """Convert the ratios dict to an ordered list matching the ML training feature order."""
    validate_ratio_keys(ratios)
    return [ratios[name] for name in RATIO_NAMES]


def validate_ratio_keys(ratios: dict[str, float]) -> None:
    """Assert that a ratios dict contains exactly the expected keys."""
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
    """Return a structured benchmark table for frontend display."""
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
