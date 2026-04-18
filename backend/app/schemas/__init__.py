# =============================================================================
# FinWatch Zambia — Schemas Package
# Centralised exports for all Pydantic request/response models.
# Import from here for cleaner cross-module usage.
# =============================================================================

from app.schemas.auth import (
    ChangePasswordRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.schemas.company import (
    CompanyCreateRequest,
    CompanyResponse,
    CompanyUpdateRequest,
    CompanyWithStatsResponse,
)
from app.schemas.financial_record import (
    FinancialRecordRequest,
    FinancialRecordResponse,
)
from app.schemas.narrative import NarrativeDetailResponse
from app.schemas.prediction import (
    ModelComparisonResponse,
    NarrativeResponse,
    PredictionCreateRequest,
    PredictionResponse,
    PredictionSummaryResponse,
    RatioFeatureResponse,
)

__all__ = [
    # Auth
    "UserCreateRequest",
    "UserUpdateRequest",
    "UserResponse",
    "ChangePasswordRequest",
    "TokenResponse",
    # Company
    "CompanyCreateRequest",
    "CompanyUpdateRequest",
    "CompanyResponse",
    "CompanyWithStatsResponse",
    # Financial Record
    "FinancialRecordRequest",
    "FinancialRecordResponse",
    # Narrative
    "NarrativeDetailResponse",
    # Prediction
    "PredictionCreateRequest",
    "PredictionResponse",
    "PredictionSummaryResponse",
    "RatioFeatureResponse",
    "NarrativeResponse",
    "ModelComparisonResponse",
]
