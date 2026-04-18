# =============================================================================
# FinWatch Zambia — Company Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel, field_validator


class CompanyCreateRequest(BaseModel):
    name: str
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be blank.")
        return stripped

    @field_validator("industry", "registration_number", mode="before")
    @classmethod
    def strip_optional_strings(cls, v: str | None) -> str | None:
        """Strip whitespace from optional string fields; treat blank as None."""
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class CompanyUpdateRequest(BaseModel):
    """
    Partial update schema — all fields optional.
    Only fields explicitly provided are updated (exclude_unset=True in router).
    """

    name: str | None = None
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_not_blank_if_provided(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be set to blank.")
        return stripped

    @field_validator("industry", "registration_number", mode="before")
    @classmethod
    def strip_optional_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class CompanyResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    industry: str | None
    registration_number: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyWithStatsResponse(CompanyResponse):
    """
    Extended company response that includes aggregate counts.
    Used by admin endpoints and the company detail view.
    """

    total_records: int = 0
    total_predictions: int = 0
    latest_risk_label: str | None = None
    latest_distress_probability: float | None = None
    latest_predicted_at: datetime | None = None
