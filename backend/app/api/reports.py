"""
FinWatch Zambia - Reports Router (SME Portal)

Endpoints:
- POST /api/reports/{prediction_id} - Generate and save PDF report
- GET /api/reports/{prediction_id} - Download existing PDF
- GET /api/reports/{prediction_id}/csv - Generate and stream CSV
- GET /api/reports/{prediction_id}/zip - Generate and stream ZIP bundle
- GET /api/reports/ - List all reports for current user
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_active_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.report import Report
from app.models.user import User
from app.services.report_service import (
    generate_csv_report,
    generate_pdf_report,
    generate_zip_bundle,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_owned_prediction(prediction_id: int, user: User, db: Session) -> Prediction:
    """Fetch a prediction by ID and verify ownership."""
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found."
        )
    return prediction


def _require_narrative(prediction: Prediction) -> None:
    """Ensure prediction has an associated narrative."""
    if not prediction.narrative:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No narrative found. Ensure the prediction completed successfully before exporting.",
        )


@router.get("/", summary="List all generated PDF reports for the current user")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return list of all generated PDF reports for the current user."""
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


@router.post(
    "/{prediction_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Generate and save a PDF assessment report for a prediction",
)
def generate_report(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate and persist a PDF report for a prediction."""
    prediction = _get_owned_prediction(prediction_id, current_user, db)

    if prediction.report:
        return {
            "detail": "Report already exists.",
            "report_id": prediction.report.id,
            "filename": prediction.report.filename,
            "generated_at": prediction.report.generated_at.isoformat(),
        }

    _require_narrative(prediction)

    try:
        file_path, filename = generate_pdf_report(prediction=prediction, db=db)
    except Exception as exc:
        logger.error("PDF generation failed for prediction %d: %s", prediction_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {exc}",
        )

    report = Report(prediction_id=prediction.id, filename=filename, file_path=file_path)
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(
        "PDF report persisted: id=%d prediction_id=%d", report.id, prediction_id
    )
    return {
        "detail": "Report generated successfully.",
        "report_id": report.id,
        "filename": report.filename,
        "generated_at": report.generated_at.isoformat(),
    }


@router.get(
    "/{prediction_id}", summary="Download the saved PDF report for a prediction"
)
def download_report(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download the saved PDF report for a prediction."""
    prediction = _get_owned_prediction(prediction_id, current_user, db)

    if not prediction.report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PDF report found. Generate one first via POST /api/reports/{prediction_id}.",
        )

    file_path = prediction.report.file_path
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Report file no longer exists. Please regenerate it.",
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=prediction.report.filename,
    )


@router.get(
    "/{prediction_id}/csv", summary="Generate and stream a CSV export for a prediction"
)
def download_csv(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate and stream a CSV export for a prediction."""
    prediction = _get_owned_prediction(prediction_id, current_user, db)
    _require_narrative(prediction)

    try:
        csv_bytes, filename = generate_csv_report(prediction=prediction, db=db)
    except Exception as exc:
        logger.error("CSV generation failed for prediction %d: %s", prediction_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSV generation failed: {exc}",
        )

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{prediction_id}/zip",
    summary="Generate and stream a ZIP bundle (PDF + CSV) for a prediction",
)
def download_zip(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate and stream a ZIP bundle containing PDF and CSV."""
    prediction = _get_owned_prediction(prediction_id, current_user, db)
    _require_narrative(prediction)

    try:
        zip_bytes, filename = generate_zip_bundle(prediction=prediction, db=db)
    except Exception as exc:
        logger.error("ZIP generation failed for prediction %d: %s", prediction_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ZIP bundle generation failed: {exc}",
        )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
