# =============================================================================
# FinWatch Zambia — Reports Router
#
# Endpoints:
#   POST /api/reports/{prediction_id}   — generate PDF report for a prediction
#   GET  /api/reports/{prediction_id}   — download an existing PDF report
#   GET  /api/reports/                  — list all reports for the current user
# =============================================================================

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_active_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.report import Report
from app.models.user import User
from app.services.report_service import generate_pdf_report

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


def _get_owned_prediction(prediction_id: int, user: User, db: Session) -> Prediction:
    """
    Fetch a prediction and verify it belongs to the current user
    by joining through the full ownership chain.
    """
    prediction = (
        db.query(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            Prediction.id == prediction_id,
            Company.owner_id == user.id,
        )
        .options(
            joinedload(Prediction.ratio_feature),
            joinedload(Prediction.narrative),
            joinedload(Prediction.report),
        )
        .first()
    )
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found.",
        )
    return prediction


# =============================================================================
# POST /api/reports/{prediction_id}
# =============================================================================


@router.post(
    "/{prediction_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Generate a PDF assessment report for a prediction",
)
def generate_report(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate a PDF financial assessment report for the specified prediction.

    - If a report already exists for this prediction, the existing report
      metadata is returned without regenerating the file (idempotent).
    - The PDF includes: company name, period, risk score, distress probability,
      ratio table with benchmarks, SHAP attribution summary, and NLP narrative.
    - Report file is stored server-side; use the GET endpoint to download it.

    Report generation requires:
    - A completed prediction with SHAP values
    - A generated NLP narrative
    """
    prediction = _get_owned_prediction(prediction_id, current_user, db)

    # Idempotency — return existing report metadata if already generated
    if prediction.report:
        return {
            "detail": "Report already exists.",
            "report_id": prediction.report.id,
            "filename": prediction.report.filename,
            "generated_at": prediction.report.generated_at.isoformat(),
        }

    if not prediction.narrative:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No narrative found for this prediction. "
                "Ensure the prediction was created successfully before generating a report."
            ),
        )

    # Generate PDF via report service (implemented in Stage 5)
    try:
        file_path, filename = generate_pdf_report(
            prediction=prediction,
            db=db,
        )
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF report generation will be available in Stage 5.",
        )

    # Persist report metadata
    report = Report(
        prediction_id=prediction.id,
        filename=filename,
        file_path=file_path,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(
        "Report generated: id=%d prediction_id=%d filename=%s",
        report.id,
        prediction_id,
        filename,
    )
    return {
        "detail": "Report generated successfully.",
        "report_id": report.id,
        "filename": report.filename,
        "generated_at": report.generated_at.isoformat(),
    }


# =============================================================================
# GET /api/reports/{prediction_id}
# =============================================================================


@router.get(
    "/{prediction_id}",
    summary="Download the PDF report for a prediction",
)
def download_report(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Download the PDF report associated with the specified prediction.
    The report must have been generated first via POST /api/reports/{prediction_id}.
    Returns the PDF file as a binary download.
    """
    prediction = _get_owned_prediction(prediction_id, current_user, db)

    if not prediction.report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No report found for this prediction. "
                "Generate one first via POST /api/reports/{prediction_id}."
            ),
        )

    file_path = prediction.report.file_path
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=(
                "Report file no longer exists on the server. "
                "Please regenerate the report."
            ),
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=prediction.report.filename,
    )


# =============================================================================
# GET /api/reports/
# =============================================================================


@router.get(
    "/",
    summary="List all generated reports for the current user",
)
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns metadata for all PDF reports generated by the current user,
    ordered by generation date descending. Does not stream file content.
    """
    results = (
        db.query(Report, Company.name.label("company_name"))
        .join(Prediction, Report.prediction_id == Prediction.id)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Company.owner_id == current_user.id)
        .order_by(Report.generated_at.desc())
        .all()
    )

    return [
        {
            "report_id": report.id,
            "prediction_id": report.prediction_id,
            "company_name": company_name,
            "filename": report.filename,
            "generated_at": report.generated_at.isoformat(),
        }
        for report, company_name in results
    ]
