# =============================================================================
# FinWatch Zambia — Company Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel


class CompanyCreateRequest(BaseModel):
    name: str
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None


class CompanyUpdateRequest(BaseModel):
    name: str | None = None
    industry: str | None = None
    registration_number: str | None = None
    description: str | None = None


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
