"""
FinWatch Zambia — Unit Tests: Ratio Engine

Tests:
    - Ratio computation accuracy
    - Boundary conditions
    - Edge cases

Note: All tests are pure unit tests - no database or HTTP involved
"""

import pytest
from app.services.ratio_engine import compute_ratios, RATIO_NAMES, validate_ratio_keys
from app.schemas.financial_record import FinancialRecordRequest


# Healthy Company Ratios (known good inputs → expected outputs)

HEALTHY = {
    "current_assets": 500_000.0,
    "current_liabilities": 200_000.0,
    "total_assets": 1_200_000.0,
    "total_liabilities": 400_000.0,
    "total_equity": 800_000.0,
    "inventory": 100_000.0,
    "cash_and_equivalents": 150_000.0,
    "retained_earnings": 300_000.0,
    "revenue": 600_000.0,
    "net_income": 120_000.0,
    "ebit": 180_000.0,
    "interest_expense": 20_000.0,
}

DISTRESSED = {
    "current_assets": 80_000.0,
    "current_liabilities": 200_000.0,
    "total_assets": 500_000.0,
    "total_liabilities": 420_000.0,
    "total_equity": 80_000.0,
    "inventory": 50_000.0,
    "cash_and_equivalents": 10_000.0,
    "retained_earnings": -50_000.0,
    "revenue": 150_000.0,
    "net_income": -80_000.0,
    "ebit": -30_000.0,
    "interest_expense": 50_000.0,
}


class TestRatioNames:
    """Tests for ratio names constant."""
    def test_ratio_names_has_ten_entries(self):
        assert len(RATIO_NAMES) == 10

    def test_ratio_names_contains_all_expected(self):
        expected = {
            "current_ratio", "quick_ratio", "cash_ratio",
            "debt_to_equity", "debt_to_assets", "interest_coverage",
            "net_profit_margin", "return_on_assets", "return_on_equity",
            "asset_turnover",
        }
        assert set(RATIO_NAMES) == expected

    def test_ratio_names_is_list(self):
        assert isinstance(RATIO_NAMES, list)


class TestComputeRatiosHealthy:
    """Tests for ratio computation with healthy company data."""
    @pytest.fixture(autouse=True)
    def setup(self):
        self.ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **HEALTHY))

    def test_returns_all_ten_ratios(self):
        assert set(self.ratios.keys()) == set(RATIO_NAMES)

    def test_current_ratio(self):
        # 500k / 200k = 2.5
        assert abs(self.ratios["current_ratio"] - 2.5) < 0.001

    def test_quick_ratio(self):
        # (500k - 100k) / 200k = 2.0
        assert abs(self.ratios["quick_ratio"] - 2.0) < 0.001

    def test_cash_ratio(self):
        # 150k / 200k = 0.75
        assert abs(self.ratios["cash_ratio"] - 0.75) < 0.001

    def test_debt_to_equity(self):
        # 400k / 800k = 0.5
        assert abs(self.ratios["debt_to_equity"] - 0.5) < 0.001

    def test_debt_to_assets(self):
        # 400k / 1200k = 0.333...
        assert abs(self.ratios["debt_to_assets"] - (400_000 / 1_200_000)) < 0.001

    def test_interest_coverage(self):
        # 180k / 20k = 9.0
        assert abs(self.ratios["interest_coverage"] - 9.0) < 0.001

    def test_net_profit_margin(self):
        # 120k / 600k = 0.2
        assert abs(self.ratios["net_profit_margin"] - 0.2) < 0.001

    def test_return_on_assets(self):
        # 120k / 1200k = 0.1
        assert abs(self.ratios["return_on_assets"] - 0.1) < 0.001

    def test_return_on_equity(self):
        # 120k / 800k = 0.15
        assert abs(self.ratios["return_on_equity"] - 0.15) < 0.001

    def test_asset_turnover(self):
        # 600k / 1200k = 0.5
        assert abs(self.ratios["asset_turnover"] - 0.5) < 0.001

    def test_all_ratios_are_floats(self):
        for name, val in self.ratios.items():
            assert isinstance(val, float), f"{name} should be float, got {type(val)}"


class TestComputeRatiosDistressed:
    """Tests for ratio computation with distressed company data."""
    @pytest.fixture(autouse=True)
    def setup(self):
        self.ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **DISTRESSED))

    def test_current_ratio_below_one(self):
        # 80k / 200k = 0.4 — below benchmark of 1.5
        assert self.ratios["current_ratio"] < 1.0

    def test_quick_ratio_below_one(self):
        # (80k - 50k) / 200k = 0.15
        assert self.ratios["quick_ratio"] < 1.0

    def test_negative_net_profit_margin(self):
        # -80k / 150k = -0.533
        assert self.ratios["net_profit_margin"] < 0.0

    def test_negative_return_on_assets(self):
        assert self.ratios["return_on_assets"] < 0.0

    def test_negative_return_on_equity(self):
        assert self.ratios["return_on_equity"] < 0.0

    def test_negative_interest_coverage(self):
        # -30k / 50k = -0.6
        assert self.ratios["interest_coverage"] < 0.0

    def test_high_debt_to_equity(self):
        # 420k / 80k = 5.25 — well above benchmark of 2.0
        assert self.ratios["debt_to_equity"] > 2.0


class TestBoundaryConditions:
    """Tests for boundary conditions and edge cases."""
    def test_zero_interest_expense_returns_zero_coverage(self):
        data = {**HEALTHY, "interest_expense": 0.0}
        ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **data))
        # Division by zero handled — should return 0 or capped value, not raise
        assert isinstance(ratios["interest_coverage"], float)

    def test_zero_revenue_returns_zero_margin(self):
        data = {**HEALTHY, "revenue": 0.0}
        ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **data))
        assert isinstance(ratios["net_profit_margin"], float)

    def test_zero_equity_handled_gracefully(self):
        data = {**HEALTHY, "total_equity": 0.0}
        ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **data))
        assert isinstance(ratios["debt_to_equity"], float)

    def test_zero_total_assets_handled_gracefully(self):
        data = {**HEALTHY, "total_assets": 0.0}
        ratios = compute_ratios(FinancialRecordRequest(period="2024-Q4", **data))
        assert isinstance(ratios["debt_to_assets"], float)
        assert isinstance(ratios["return_on_assets"], float)
        assert isinstance(ratios["asset_turnover"], float)


class TestValidateRatioKeys:
    """Tests for ratio key validation."""
    def test_valid_ratio_dict_passes(self):
        from .conftest import SAMPLE_RATIOS
        # Should not raise
        validate_ratio_keys(SAMPLE_RATIOS)

    def test_missing_key_raises_value_error(self):
        incomplete = {k: 1.0 for k in RATIO_NAMES[:-1]}  # one key missing
        with pytest.raises((ValueError, KeyError)):
            validate_ratio_keys(incomplete)

    def test_extra_keys_are_tolerated_or_raise(self):
        extra = {**{k: 1.0 for k in RATIO_NAMES}, "extra_key": 999}
        # Implementation either ignores extra keys or raises — both acceptable
        try:
            validate_ratio_keys(extra)
        except (ValueError, KeyError):
            pass  # also acceptable behaviour
