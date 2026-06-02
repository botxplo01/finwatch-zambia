"""
FinWatch Zambia - Canonical Business & Domain Rules

This module serves as the single source of truth for high-level business logic
and regulatory constraints. It decouples domain governance from technical
implementations in APIs and models.
"""

from app.core.config import settings


def is_regulated_industry(industry: str | None) -> bool:
    """
    Returns True if the industry belongs to the 'Regulated Quadrant'.
    These sectors require high-fidelity financial oversight.
    """
    if not industry:
        return False
    return industry in settings.RESTRICTED_INDUSTRIES


def requires_full_assessment(
    business_scale: str | None,
    industry: str | None,
) -> bool:
    """
    Canonical methodology-selection rule.
    A company requires Full Financial Assessment if it operates in a
    regulated sector OR belongs to an established Medium Scale enterprise.
    """
    return business_scale == "medium_scale" or is_regulated_industry(industry)
