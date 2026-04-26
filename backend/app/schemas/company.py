"""
FinWatch Zambia - Company Schemas
"""

import re
from datetime import datetime

from pydantic import BaseModel, field_validator


class CompanyCreateRequest(BaseModel):
    name: str
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be blank.")
        
        if not re.match(r"^[a-zA-Z0-9\s&.,\-’'()]+$", stripped):
            raise ValueError(
                "Invalid company name. Please use only standard characters "
                "(letters, numbers, spaces, and & . , - ' ). Avoid excessive symbols."
            )
        
        if re.match(r"^[&.,\-’'()]+$", stripped):
            raise ValueError("Company name must contain at least one letter or number.")
            
        return stripped

    @field_validator("registration_number")
    @classmethod
    def validate_reg_number(cls, v: str | None) -> str | None:
        if v is None:
            return None
        
        stripped = v.strip()
        if not stripped:
            return None
            
        if not re.match(r"^\d{12}$", stripped):
            raise ValueError(
                "Company Registration Number must be exactly 12 digits. "
                "No letters or special characters are allowed."
            )
            
        return stripped

    @field_validator("industry", mode="before")
    @classmethod
    def strip_optional_strings(cls, v: str | None) -> str | None:
        """Strip whitespace from optional string fields; treat blank as None."""
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class CompanyUpdateRequest(BaseModel):
    """Partial update schema — all fields optional."""

    name: str | None = None
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_company_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        
        stripped = v.strip()
        if not stripped:
            raise ValueError("Company name cannot be blank.")
        
        if not re.match(r"^[a-zA-Z0-9\s&.,\-’'()]+$", stripped):
            raise ValueError(
                "Invalid company name. Please use only standard characters "
                "(letters, numbers, spaces, and & . , - ' )."
            )
            
        if re.match(r"^[&.,\-’'()]+$", stripped):
            raise ValueError("Company name must contain at least one letter or number.")
            
        return stripped

    @field_validator("registration_number")
    @classmethod
    def validate_reg_number(cls, v: str | None) -> str | None:
        if v is None:
            return None
        
        stripped = v.strip()
        if not stripped:
            return None
            
        if not re.match(r"^\d{12}$", stripped):
            raise ValueError(
                "Company Registration Number must be exactly 12 digits. "
                "No letters or special characters are allowed."
            )
            
        return stripped

    @field_validator("industry", mode="before")
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
    """Extended company response that includes aggregate counts."""

    total_records: int = 0
    total_predictions: int = 0
    latest_risk_label: str | None = None
    latest_distress_probability: float | None = None
    latest_predicted_at: datetime | None = None
