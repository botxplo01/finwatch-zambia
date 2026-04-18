# =============================================================================
# FinWatch Zambia — Companies Router
#
# Endpoints:
#   GET    /api/companies/                          — list all companies for current user
#   POST   /api/companies/                          — create a new SME profile
#   GET    /api/companies/{company_id}              — get a specific company
#   PUT    /api/companies/{company_id}              — full update of a company
#   PATCH  /api/companies/{company_id}              — partial update of a company
#   DELETE /api/companies/{company_id}              — delete company and all records
#   GET    /api/companies/{company_id}/records      — list financial records for a company
#   POST   /api/companies/{company_id}/records      — add a financial record
#   DELETE /api/companies/{company_id}/records/{record_id} — delete a financial record
# =============================================================================

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.schemas.company import (
    CompanyCreateRequest,
    CompanyResponse,
    CompanyUpdateRequest,
)
from app.schemas.financial_record import (
    FinancialRecordRequest,
    FinancialRecordResponse,
)
from app.services.ratio_engine import compute_ratios

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


def _get_owned_company(company_id: int, user: User, db: Session) -> Company:
    """
    Fetch a company by ID and verify it belongs to the current user.
    Raises HTTP 404 if the company does not exist or is not owned by the user.
    Using a single filtered query prevents information leakage about other
    users' companies — a non-owned company returns 404, not 403.
    """
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.owner_id == user.id)
        .first()
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )
    return company


def _get_owned_record(record_id: int, company_id: int, db: Session) -> FinancialRecord:
    """Fetch a financial record that belongs to the specified company."""
    record = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.id == record_id,
            FinancialRecord.company_id == company_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial record not found.",
        )
    return record


# =============================================================================
# Company CRUD
# =============================================================================


@router.get(
    "/",
    response_model=list[CompanyResponse],
    summary="List all SME profiles for the current user",
)
def list_companies(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns all companies owned by the authenticated user,
    ordered by creation date descending. Supports pagination.
    """
    return (
        db.query(Company)
        .filter(Company.owner_id == current_user.id)
        .order_by(Company.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new SME profile",
)
def create_company(
    payload: CompanyCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new SME profile linked to the authenticated user.
    The company name must not be blank; all other fields are optional.
    """
    company = Company(**payload.model_dump(), owner_id=current_user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    logger.info(
        "Company created: id=%d name=%r owner_id=%d",
        company.id,
        company.name,
        current_user.id,
    )
    return company


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Get a specific SME profile",
)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _get_owned_company(company_id, current_user, db)


@router.put(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Full update of an SME profile",
)
def update_company(
    company_id: int,
    payload: CompanyCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Full replacement of a company's fields.
    All required fields must be provided.
    """
    company = _get_owned_company(company_id, current_user, db)
    for field, value in payload.model_dump().items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Partial update of an SME profile",
)
def patch_company(
    company_id: int,
    payload: CompanyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update only the fields provided in the request body.
    Unspecified fields retain their current values.
    """
    company = _get_owned_company(company_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an SME profile and all associated data",
)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Permanently deletes the company and all its financial records,
    ratio features, predictions, narratives, and reports via cascade.
    This action is irreversible.
    """
    company = _get_owned_company(company_id, current_user, db)
    db.delete(company)
    db.commit()
    logger.info("Company deleted: id=%d owner_id=%d", company_id, current_user.id)


# =============================================================================
# Financial Records sub-resource
# =============================================================================


@router.get(
    "/{company_id}/records",
    response_model=list[FinancialRecordResponse],
    summary="List all financial records for a company",
)
def list_records(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns all financial records for the specified company,
    ordered by period descending (most recent first).
    """
    _get_owned_company(company_id, current_user, db)  # ownership check
    return (
        db.query(FinancialRecord)
        .filter(FinancialRecord.company_id == company_id)
        .order_by(FinancialRecord.period.desc())
        .all()
    )


@router.post(
    "/{company_id}/records",
    response_model=FinancialRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a financial record and compute ratios",
)
def create_record(
    company_id: int,
    payload: FinancialRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Add a new financial record for the specified company.

    On creation the ratio engine immediately computes all 10 financial
    ratios from the raw inputs and persists them as a RatioFeature record.
    This means ratio data is always available without recomputation.

    A company cannot have two records for the same period.
    """
    _get_owned_company(company_id, current_user, db)  # ownership check

    # Prevent duplicate period entries for the same company
    existing = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.company_id == company_id,
            FinancialRecord.period == payload.period,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A financial record for period '{payload.period}' already exists for this company.",
        )

    # Persist the raw financial record
    record_data = payload.model_dump()
    period = record_data.pop("period")
    record = FinancialRecord(
        company_id=company_id,
        period=period,
        **record_data,
    )
    db.add(record)
    db.flush()  # get record.id without committing

    # Immediately compute and persist the 10 financial ratios
    ratios = compute_ratios(payload)
    ratio_feature = RatioFeature(
        financial_record_id=record.id,
        **ratios,
    )
    db.add(ratio_feature)
    db.commit()
    db.refresh(record)

    logger.info(
        "Financial record created: id=%d company_id=%d period=%s",
        record.id,
        company_id,
        period,
    )
    return record


@router.delete(
    "/{company_id}/records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a financial record and its associated prediction data",
)
def delete_record(
    company_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Permanently deletes a financial record and all downstream data
    (ratio features, predictions, narratives, reports) via cascade.
    """
    _get_owned_company(company_id, current_user, db)
    record = _get_owned_record(record_id, company_id, db)
    db.delete(record)
    db.commit()
    logger.info("Financial record deleted: id=%d company_id=%d", record_id, company_id)
