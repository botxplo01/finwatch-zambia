"""
FinWatch Zambia - Institutional Report Service

Generates comprehensive aggregate institutional reports including:
- System-wide KPIs
- Sector-wise performance
- Business Scale segmentation
- Temporal distress trends
- Anonymised anomaly flags (high-risk)

Modern minimalist aesthetic matching the SME portal standard.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import os
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    CondPageBreak,
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.nlp_service import RATIO_DISPLAY_NAMES, generate_institutional_summary

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MODEL_INTEGRITY_DISCLAIMER = (
    "Metrics reflect performance on a held-out test split (n=2,101) of the UCI "
    "Polish Companies Bankruptcy dataset only and do not reflect Zambian SME "
    'performance. "Recall" is macro-averaged across both classes; '
    '"Distressed Recall" reflects the minority (distressed) class specifically.'
)


def _load_model_integrity_metrics() -> dict:
    """Read real evaluation metrics for RF and LR from the ML training artifact.

    Source of truth: backend/ml/artifacts/model_metadata.json, written by
    backend/ml/evaluate.py. All figures reflect the held-out Polish Companies
    Bankruptcy test set only and must never be presented as Zambian SME
    performance metrics.
    """
    _fallback = {
        "random_forest": {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "distressed_recall": None,
            "distressed_precision": None,
        },
        "logistic_regression": {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "distressed_recall": None,
            "distressed_precision": None,
        },
    }
    try:
        artifact_path = settings.ml_artifacts_path / "model_metadata.json"
        with open(artifact_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        result = {}
        for model_name in ("random_forest", "logistic_regression"):
            tm = metadata["models"][model_name]["test_metrics"]
            distressed = tm["per_class"]["Distressed"]
            result[model_name] = {
                "accuracy": tm["accuracy"],
                "precision": tm["precision"],
                "recall": tm["recall"],
                "distressed_recall": distressed["recall"],
                "distressed_precision": distressed["precision"],
            }
        return result
    except FileNotFoundError:
        logger.error(
            "model_metadata.json not found at %s — model integrity metrics unavailable",
            settings.ml_artifacts_path,
        )
        return _fallback
    except (json.JSONDecodeError, KeyError) as exc:
        logger.error(
            "Failed to parse model_metadata.json: %s — model integrity metrics unavailable",
            exc,
        )
        return _fallback


# --- Configuration & Styling ---

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm

TEAL = colors.HexColor("#059669")
TEAL_LIGHT = colors.HexColor("#f0fdf4")
GREY_DARK = colors.HexColor("#111827")
GREY_MID = colors.HexColor("#6b7280")
GREY_LIGHT = colors.HexColor("#f9fafb")
BORDER = colors.HexColor("#f3f4f6")
WHITE = colors.white


def _build_styles() -> dict:
    """Create paragraph styles for modern aggregate reports."""
    return {
        "title": ParagraphStyle(
            "RTitle",
            fontSize=22,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            leading=28,
            spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "RSection",
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=TEAL,
            spaceBefore=18,
            spaceAfter=8,
            textTransform="uppercase",
        ),
        "h2": ParagraphStyle(
            "RH2",
            fontSize=11,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "RH3",
            fontSize=10,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "RBody",
            fontSize=9.5,
            fontName="Helvetica",
            textColor=GREY_DARK,
            leading=15,
        ),
        "body_small": ParagraphStyle(
            "RBodySmall",
            fontSize=8,
            fontName="Helvetica",
            textColor=GREY_DARK,
            leading=12,
        ),
        "small": ParagraphStyle(
            "RSmall",
            fontSize=8,
            fontName="Helvetica",
            textColor=GREY_MID,
            leading=11,
        ),
        "centered": ParagraphStyle(
            "RCentered",
            fontSize=10,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            leading=15,
            alignment=1,
        ),
        "disclaimer": ParagraphStyle(
            "RDisclaimer",
            fontSize=7.5,
            fontName="Helvetica-Oblique",
            textColor=GREY_MID,
            leading=12,
            alignment=1,
        ),
    }


# --- Modular Drawing Functions ---


def _draw_ai_summary(story, data, role, styles):
    """Draw the AI-generated executive summary section."""
    summary = data.get("ai_summary", "")
    if not summary:
        return

    story.append(Paragraph("1. Executive Summary (AI Synthesized)", styles["section"]))

    from app.services.markdown_renderer import markdown_to_flowables

    story.extend(markdown_to_flowables(summary, styles))
    story.append(Spacer(1, 1 * cm))


def _draw_aggregated_shap(
    story, data, styles, accent_base=TEAL, accent_light=TEAL_LIGHT
):
    """Draw the aggregated feature importance (SHAP) analysis."""
    shap = data.get("aggregated_shap", {})
    if not shap:
        return

    story.append(Paragraph("Aggregated Feature Importance (SHAP)", styles["section"]))
    story.append(
        Paragraph(
            "The following ratios are the most significant drivers of financial health predictions across the system.",
            styles["body"],
        )
    )

    # Sort by mean_abs_shap descending and take top 5
    sorted_shap = sorted(
        shap.items(), key=lambda x: x[1]["mean_abs_shap"], reverse=True
    )[:5]
    shap_rows = [["Financial Ratio", "Avg |Influence|", "Impact Direction"]]

    for feat, stats in sorted_shap:
        label = RATIO_DISPLAY_NAMES.get(feat, feat)
        mean_abs = stats["mean_abs_shap"]
        mean_signed = stats["mean_signed_shap"]
        direction = "Increases Risk" if mean_signed > 0 else "Supports Health"
        dir_color = "#dc2626" if mean_signed > 0 else "#16a34a"

        impact_html = f'<b><font color="{dir_color}">{direction}</font></b>'

        shap_rows.append(
            [
                label,
                f"{mean_abs:.4f}",
                Paragraph(impact_html, styles["centered"]),
            ]
        )

    st = Table(
        shap_rows,
        colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.45, 0.25, 0.3]],
    )
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), accent_light),
                ("TEXTCOLOR", (0, 0), (-1, 0), accent_base),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(st)
    story.append(Spacer(1, 1 * cm))


def _draw_risk_matrix(story, data, styles, accent_base=TEAL, accent_light=TEAL_LIGHT):
    """Draw the systemic risk matrix correlating scale and risk tiers."""
    matrix = data.get("risk_matrix", {})
    if not matrix:
        return

    story.append(Paragraph("Systemic Risk Matrix", styles["section"]))
    story.append(
        Paragraph(
            "Distribution of risk tiers (High, Medium, Low) across different business scales.",
            styles["body"],
        )
    )

    scales = ["indicative", "full", "unspecified"]
    rows = [["Business Scale", "High Risk", "Medium Risk", "Low Risk"]]

    for s in scales:
        label = (
            "Small Scale"
            if s == "indicative"
            else "Medium Scale" if s == "full" else "Unspecified"
        )
        h_count = matrix.get(s, {}).get("High", 0)
        m_count = matrix.get(s, {}).get("Medium", 0)
        l_count = matrix.get(s, {}).get("Low", 0)

        # Style High Risk as bold red
        h_html = f'<b><font color="#dc2626">{h_count}</font></b>'

        rows.append(
            [
                label,
                Paragraph(h_html, styles["centered"]),
                str(m_count),
                str(l_count),
            ]
        )

    st = Table(
        rows,
        colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.4, 0.2, 0.2, 0.2]],
    )
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), accent_light),
                ("TEXTCOLOR", (0, 0), (-1, 0), accent_base),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(st)
    story.append(Spacer(1, 1 * cm))


def _draw_model_audit(story, data, styles, accent_base=TEAL, accent_light=TEAL_LIGHT):
    """Draw the ML model integrity and transparency audit."""
    integrity = data.get("model_integrity", {})
    if not integrity:
        return

    def _fmt_pct(v):
        return f"{v * 100:.1f}%" if v is not None else "N/A"

    story.append(Paragraph("Model Integrity & Transparency", styles["section"]))
    story.append(
        Paragraph(
            "Current performance metrics for the predictive engines used in this report.",
            styles["body"],
        )
    )

    rows = [["Model Name", "Accuracy", "Recall (Macro)", "Recall (Distressed)", "Precision (Distressed)"]]
    for model, stats in integrity.items():
        name = model.replace("_", " ").title()
        rows.append(
            [
                name,
                _fmt_pct(stats.get("accuracy")),
                _fmt_pct(stats.get("recall")),
                _fmt_pct(stats.get("distressed_recall")),
                _fmt_pct(stats.get("distressed_precision")),
            ]
        )

    st = Table(
        rows,
        colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.24, 0.19, 0.19, 0.19, 0.19]],
    )
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), accent_light),
                ("TEXTCOLOR", (0, 0), (-1, 0), accent_base),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(st)
    story.append(
        Paragraph(
            data.get("model_integrity_note", MODEL_INTEGRITY_DISCLAIMER),
            styles["small"],
        )
    )


# --- Data Collection ---


def collect_all_report_data(
    db: Session,
    role: str = "regulator",
    mask_entities: bool = False,
    scale: str | None = None,
    sector: str | None = None,
) -> dict:
    """Fetch comprehensive aggregate data from the database with role-based filtering and masking."""
    from app.models.company import Company
    from app.models.financial_record import FinancialRecord
    from app.models.prediction import Prediction
    from app.models.ratio_feature import RatioFeature
    from app.models.user import User

    def get_filtered_prediction_query(entities):
        q = (
            db.query(*entities)
            .select_from(Prediction)
            .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
            .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
            .join(Company, FinancialRecord.company_id == Company.id)
            .join(User, Company.owner_id == User.id)
        )
        if scale is not None:
            scales_list = []
            for s in scale.split(","):
                s_stripped = s.strip()
                if s_stripped == "Small Scale":
                    scales_list.append("small_scale")
                elif s_stripped == "Medium Scale":
                    scales_list.append("medium_scale")
                else:
                    scales_list.append(s_stripped)
            q = q.filter(User.business_scale.in_(scales_list))
        if sector is not None:
            sectors_list = [s.strip() for s in sector.split(",")]
            q = q.filter(Company.industry.in_(sectors_list))
        return q

    # Force masking for policy analysts if not explicitly specified
    if role == "policy_analyst":
        mask_entities = True

    total_assessments = (
        get_filtered_prediction_query((func.count(Prediction.id),))
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0
    )

    sme_query = db.query(func.count(Company.id)).select_from(Company).join(User, Company.owner_id == User.id)
    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        sme_query = sme_query.filter(User.business_scale.in_(scales_list))
    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        sme_query = sme_query.filter(Company.industry.in_(sectors_list))
    total_smes = sme_query.scalar() or 0

    avg_prob = (
        get_filtered_prediction_query((func.avg(Prediction.distress_probability),))
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0.0
    )

    sector_results = (
        get_filtered_prediction_query((
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        ))
        .filter(Prediction.model_used == "random_forest")
        .group_by(Company.industry)
        .all()
    )
    sectors = [
        {
            "industry": (i or "Unspecified") if t >= 3 else "Other (suppressed)",
            "total": t,
            "distressed": int(d or 0),
            "avg_prob": float(ap or 0),
        }
        for i, t, d, ap in sector_results
    ]
    sectors.sort(key=lambda x: x["total"], reverse=True)

    scale_results = (
        get_filtered_prediction_query((
            Prediction.assessment_methodology,
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        ))
        .filter(Prediction.model_used == "random_forest")
        .group_by(Prediction.assessment_methodology)
        .all()
    )

    scale_labels = {"full": "Medium Scale", "indicative": "Small Scale"}
    scales = [
        {
            "scale": scale_labels.get(s, "Unspecified Scale"),
            "total": t,
            "distressed": int(d or 0),
            "avg_prob": float(ap or 0),
        }
        for s, t, d, ap in scale_results
    ]

    # Aggregated SHAP Analysis — chunked to avoid loading all blobs into RAM
    shap_signed_sum: dict[str, float] = {}
    shap_abs_sum: dict[str, float] = {}
    shap_count = 0
    shap_query = (
        get_filtered_prediction_query((Prediction.shap_values_json,))
        .filter(Prediction.model_used == "random_forest")
        .yield_per(50)
    )
    for (sj,) in shap_query:
        if not sj:
            continue
        try:
            vals = json.loads(sj)
            for k, v in vals.items():
                shap_signed_sum[k] = shap_signed_sum.get(k, 0.0) + v
                shap_abs_sum[k] = shap_abs_sum.get(k, 0.0) + abs(v)
            shap_count += 1
        except Exception:
            continue
    aggregated_shap: dict[str, dict[str, float]] = {}
    if shap_count > 0:
        for k in shap_abs_sum:
            aggregated_shap[k] = {
                "mean_abs_shap": shap_abs_sum[k] / shap_count,
                "mean_signed_shap": shap_signed_sum.get(k, 0.0) / shap_count,
            }

    # Risk Matrix (Risk Tier x Assessment Methodology)
    matrix_results = (
        get_filtered_prediction_query((
            Prediction.assessment_methodology,
            case(
                (Prediction.distress_probability >= 0.7, "High"),
                (Prediction.distress_probability >= 0.4, "Medium"),
                else_="Low",
            ).label("tier"),
            func.count(Prediction.id).label("count"),
        ))
        .filter(Prediction.model_used == "random_forest")
        .group_by(Prediction.assessment_methodology, "tier")
        .all()
    )
    risk_matrix = {}
    for methodology_key, tier, count in matrix_results:
        key = methodology_key or "unspecified"
        if key not in risk_matrix:
            risk_matrix[key] = {"High": 0, "Medium": 0, "Low": 0}
        risk_matrix[key][tier] = count

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    dialect = db.bind.dialect.name
    month_label = (
        func.to_char(Prediction.predicted_at, "YYYY-MM")
        if dialect == "postgresql"
        else func.strftime("%Y-%m", Prediction.predicted_at)
    )

    trend_results = (
        get_filtered_prediction_query((
            month_label.label("month"),
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
        ))
        .filter(
            Prediction.predicted_at >= cutoff, Prediction.model_used == "random_forest"
        )
        .group_by("month")
        .order_by("month")
        .all()
    )
    trends = [
        {"month": m, "total": t, "rate": (d / t) if t > 0 else 0}
        for m, t, d in trend_results
    ]

    # Role-based filtering and Masking
    anomalies = []
    anomaly_query = (
        get_filtered_prediction_query((
            Prediction.id,
            Company.name,
            Company.industry,
            Prediction.distress_probability,
            Prediction.risk_label,
        ))
        .filter(
            Prediction.distress_probability >= 0.7,
            Prediction.model_used == "random_forest",
        )
        .order_by(Prediction.distress_probability.desc())
        .limit(15)
    )

    for pid, name, ind, prob, label in anomaly_query.all():
        display_name = name
        if mask_entities:
            # Simple hash for anonymity
            display_name = f"SME-{hashlib.md5(name.encode()).hexdigest()[:6].upper()}"

        anomalies.append(
            {
                "id": pid if role == "regulator" else "MASKED",
                "name": display_name,
                "industry": ind or "Unspecified",
                "prob": prob,
                "label": label,
            }
        )

    return {
        "overview": {
            "total_assessments": total_assessments,
            "total_smes": total_smes,
            "avg_distress_prob": avg_prob,
        },
        "sectors": sectors,
        "scales": scales,
        "trends": trends,
        "anomalies": anomalies,
        "aggregated_shap": aggregated_shap,
        "risk_matrix": risk_matrix,
        "model_integrity": _load_model_integrity_metrics(),
        "model_integrity_note": MODEL_INTEGRITY_DISCLAIMER,
        "generated_at": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
        "is_anonymized": mask_entities,
    }


# --- PDF Composition ---


def _header_footer(canvas, doc, user_time: str | None = None, role: str = "regulator"):
    """Institutional header with modern minimalist style."""
    canvas.saveState()
    w, h = A4

    header_y = h - 4.0 * cm

    # Centered logo rendered above the separator line
    logo_path = settings.brand_logo_absolute_path
    LOGO_W = 4.2 * cm
    LOGO_H = 1.4 * cm  # Explicit height preserves the ~3:1 landscape aspect ratio
    if logo_path.exists():
        canvas.drawImage(
            str(logo_path),
            (w - LOGO_W) / 2,
            h - 3.2 * cm,
            width=LOGO_W,
            height=LOGO_H,
            preserveAspectRatio=True,
            mask="auto",
        )

    # Theme color based on role
    ACCENT = colors.HexColor("#2563eb") if role == "policy_analyst" else TEAL
    PORTAL_NAME = "Analyst Portal" if role == "policy_analyst" else "Regulator Portal"

    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, header_y, w - MARGIN, header_y)

    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(ACCENT)
    canvas.drawString(MARGIN, header_y + 2 * mm, f"FinWatch Zambia — {PORTAL_NAME}")

    if user_time:
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY_MID)
        canvas.drawRightString(w - MARGIN, header_y + 2 * mm, f"Generated: {user_time}")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(
        w / 2,
        MARGIN - 10 * mm,
        f"Page {canvas.getPageNumber()}  ·  Institutional Aggregate Analysis",
    )
    canvas.restoreState()


async def generate_institutional_pdf(
    db: Session,
    user_time: str | None = None,
    role: str = "regulator",
    include_ai_summary: bool = True,
    mask_entities: bool = False,
    scale: str | None = None,
    sector: str | None = None,
) -> tuple[bytes, str]:
    """Generate a detailed institutional aggregate PDF report with modern styling (async)."""
    data = collect_all_report_data(
        db, role=role, mask_entities=mask_entities, scale=scale, sector=sector
    )

    if include_ai_summary:
        summary, _ = await generate_institutional_summary(data, role)
        data["ai_summary"] = summary

    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = (
        f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    )

    styles = _build_styles()

    # Update style color for analyst
    if role == "policy_analyst":
        styles["section"].textColor = colors.HexColor("#2563eb")
        ACCENT_LIGHT = colors.HexColor("#eff6ff")
        ACCENT_BASE = colors.HexColor("#2563eb")
    else:
        ACCENT_LIGHT = TEAL_LIGHT
        ACCENT_BASE = TEAL

    story = []

    # 1. Title & Institutional Metadata
    report_title = (
        "Strategic Policy Insight Report"
        if role == "policy_analyst"
        else "System-Wide Aggregate Performance Report"
    )
    story.append(Paragraph(report_title, styles["title"]))
    meta_style = ParagraphStyle("RMeta", parent=styles["body"], fontSize=10, leading=14)
    story.append(
        Paragraph("<b>Scope:</b> All Registered Zambian SME Sectors", meta_style)
    )
    story.append(
        Paragraph(
            f"<b>Data Coverage:</b> {data['overview']['total_assessments']} Individual Assessments",
            meta_style,
        )
    )

    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.5 * cm))

    # --- Modular Sections ---

    # AI Summary
    if include_ai_summary:
        _draw_ai_summary(story, data, role, styles)

    # 2. KPI Summary
    story.append(Paragraph("Key Performance Indicators", styles["section"]))
    stats_data = [
        ["Metric", "Current Value"],
        [
            Paragraph("Total Registered SME Profiles", styles["centered"]),
            str(data["overview"]["total_smes"]),
        ],
        [
            Paragraph("Average Distress Probability", styles["centered"]),
            f"{data['overview']['avg_distress_prob'] * 100:.2f}%",
        ],
        [
            Paragraph("Active Sector Coverage", styles["centered"]),
            str(len(data["sectors"])),
        ],
    ]
    st = Table(stats_data, colWidths=[PAGE_W * 0.4, PAGE_W * 0.3])
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
                ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_BASE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]
        )
    )
    story.append(st)
    story.append(Spacer(1, 1 * cm))

    # New Modules
    _draw_aggregated_shap(story, data, styles, ACCENT_BASE, ACCENT_LIGHT)
    _draw_risk_matrix(story, data, styles, ACCENT_BASE, ACCENT_LIGHT)

    # 3. Sector Performance
    story.append(Paragraph("Sector-Wise Performance Analysis", styles["section"]))
    if data["sectors"]:
        sector_rows = [["Industry Sector", "Assessments", "Distressed", "Avg Prob."]]
        for s in data["sectors"]:
            distressed_val = s.get("distressed", 0)
            distressed_html = f'<b><font color="#dc2626">{distressed_val}</font></b>'

            sector_rows.append(
                [
                    s["industry"],
                    str(s["total"]),
                    Paragraph(distressed_html, styles["body"]),
                    f"{s['avg_prob'] * 100:.1f}%",
                ]
            )
        sect_t = Table(
            sector_rows,
            colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.4, 0.2, 0.2, 0.2]],
        )
        sect_t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
                    ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_BASE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.5, ACCENT_BASE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(sect_t)
    else:
        story.append(Paragraph("No sectoral data currently available.", styles["body"]))

    story.append(Spacer(1, 1 * cm))
    story.append(CondPageBreak(7 * cm))

    # 4. Business Scale Segmentation
    story.append(Paragraph("Business Scale Segmentation Analysis", styles["section"]))
    if data["scales"]:
        scale_rows = [["Business Scale", "Assessments", "Distressed", "Avg Prob."]]
        for s in data["scales"]:
            distressed_val = s.get("distressed", 0)
            distressed_html = f'<b><font color="#dc2626">{distressed_val}</font></b>'

            scale_rows.append(
                [
                    s["scale"],
                    str(s["total"]),
                    Paragraph(distressed_html, styles["body"]),
                    f"{s['avg_prob'] * 100:.1f}%",
                ]
            )
        scale_t = Table(
            scale_rows,
            colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.4, 0.2, 0.2, 0.2]],
        )
        scale_t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
                    ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_BASE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.5, ACCENT_BASE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(scale_t)
    else:
        story.append(
            Paragraph("No business scale data currently available.", styles["body"])
        )

    story.append(Spacer(1, 1 * cm))

    # 5. Temporal Trends
    story.append(
        Paragraph("Monthly Distress Trends (Last 12 Months)", styles["section"])
    )
    if data["trends"]:
        trend_rows = [["Reporting Month", "Assessments", "Distress Rate (%)"]]
        for t in data["trends"]:
            trend_rows.append([t["month"], t["total"], f"{t['rate'] * 100:.1f}%"])
        trend_t = Table(
            trend_rows, colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.4, 0.3, 0.3]]
        )
        trend_t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
                    ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_BASE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.5, ACCENT_BASE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(trend_t)
    else:
        story.append(
            Paragraph(
                "Insufficient historical data to generate temporal trends.",
                styles["body"],
            )
        )
    story.append(Spacer(1, 1 * cm))

    # New Module: Audit
    _draw_model_audit(story, data, styles, ACCENT_BASE, ACCENT_LIGHT)

    # 6. Anomaly Flags
    story.append(Paragraph("High-Risk Anomaly Flags", styles["section"]))
    if data["anomalies"]:
        anom_rows = [
            ["Entity Reference", "Industry Sector", "Distress Prob.", "Risk Status"]
        ]
        for a in data["anomalies"]:
            label_upper = a.get("label", "Unknown").upper()
            label_html = f'<b><font color="#dc2626">{label_upper}</font></b>'

            anom_rows.append(
                [
                    a["name"],
                    a["industry"],
                    f"{a['prob'] * 100:.1f}%",
                    Paragraph(label_html, styles["body"]),
                ]
            )
        anom_t = Table(
            anom_rows,
            colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.35, 0.25, 0.2, 0.2]],
        )
        anom_t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
                    ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_BASE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, GREY_LIGHT],
                    ),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.5, ACCENT_BASE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(anom_t)
        story.append(Spacer(1, 0.5 * cm))
        story.append(
            Paragraph(
                "<i>Note: Anonymization applied based on role permissions. Reference IDs are internally verifiable.</i>",
                styles["small"],
            )
        )
    else:
        story.append(
            Paragraph(
                "No significant high-risk anomalies currently flagged.",
                styles["body"],
            )
        )

    # Final Notice
    story.append(Spacer(1, 2 * cm))
    notice = "<b>CONFIDENTIALITY NOTICE:</b> This report contains anonymised aggregate data for academic research and authorised institutional oversight only. Public distribution is strictly prohibited."
    story.append(Paragraph(notice, styles["disclaimer"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=5.0 * cm,
        bottomMargin=MARGIN + 0.5 * cm,
    )
    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, user_time, role),
        onLaterPages=lambda c, d: _header_footer(c, d, user_time, role),
    )
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes, filename


def generate_institutional_csv(
    db: Session,
    role: str = "regulator",
    scale: str | None = None,
    sector: str | None = None,
) -> tuple[bytes, str]:
    """Generate detailed system-wide aggregate CSV."""
    data = collect_all_report_data(db, role=role, scale=scale, sector=sector)
    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = (
        f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    )
    output = io.StringIO()
    writer = csv.writer(output)
    report_title = (
        "FINWATCH STRATEGIC POLICY INSIGHT REPORT"
        if role == "policy_analyst"
        else "FINWATCH REGULATOR AGGREGATE REPORT"
    )
    writer.writerow([report_title])
    writer.writerow(["Generated At", data["generated_at"]])
    writer.writerow([])
    writer.writerow(["# SECTION 1: KEY PERFORMANCE INDICATORS"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Assessments", data["overview"]["total_assessments"]])
    writer.writerow(["Total Registered SMEs", data["overview"]["total_smes"]])
    writer.writerow(
        ["Avg Distress Prob (%)", f"{data['overview']['avg_distress_prob'] * 100:.2f}"]
    )
    writer.writerow([])

    writer.writerow(["# SECTION 2: SECTOR-WISE PERFORMANCE"])
    if data["sectors"]:
        writer.writerow(
            ["Industry", "Total Assessments", "Distressed Count", "Avg Prob (%)"]
        )
        for s in data["sectors"]:
            writer.writerow(
                [
                    s["industry"],
                    s["total"],
                    s["distressed"],
                    f"{s['avg_prob'] * 100:.2f}",
                ]
            )
    else:
        writer.writerow(["No sectoral data available"])
    writer.writerow([])

    writer.writerow(["# SECTION 3: BUSINESS SCALE SEGMENTATION"])
    if data["scales"]:
        writer.writerow(
            ["Business Scale", "Total Assessments", "Distressed Count", "Avg Prob (%)"]
        )
        for s in data["scales"]:
            writer.writerow(
                [s["scale"], s["total"], s["distressed"], f"{s['avg_prob'] * 100:.2f}"]
            )
    else:
        writer.writerow(["No business scale data available"])
    writer.writerow([])

    writer.writerow(["# SECTION 4: MONTHLY DISTRESS TRENDS"])
    if data["trends"]:
        writer.writerow(["Month", "Total Monthly Assessments", "Distress Rate (%)"])
        for t in data["trends"]:
            writer.writerow([t["month"], t["total"], f"{t['rate'] * 100:.1f}"])
    else:
        writer.writerow(["Insufficient historical data to generate temporal trends"])
    writer.writerow([])

    writer.writerow(["# SECTION 5: MODEL INTEGRITY & TRANSPARENCY"])
    writer.writerow(
        ["Model", "Accuracy (%)", "Recall Macro (%)", "Recall Distressed (%)", "Precision Distressed (%)"]
    )
    integrity = data.get("model_integrity", {})
    for model_name in ("random_forest", "logistic_regression"):
        stats = integrity.get(model_name, {})

        def _fmt_csv(v):
            return f"{v * 100:.1f}" if v is not None else "N/A"

        writer.writerow(
            [
                model_name.replace("_", " ").title(),
                _fmt_csv(stats.get("accuracy")),
                _fmt_csv(stats.get("recall")),
                _fmt_csv(stats.get("distressed_recall")),
                _fmt_csv(stats.get("distressed_precision")),
            ]
        )
    writer.writerow([data.get("model_integrity_note", MODEL_INTEGRITY_DISCLAIMER)])
    writer.writerow([])

    if role == "regulator":
        writer.writerow(["# SECTION 6: HIGH-RISK ANOMALY FLAGS"])

        if data["anomalies"]:
            writer.writerow(
                ["Reference ID", "Industry Sector", "Distress Prob (%)", "Risk Status"]
            )
            for a in data["anomalies"]:
                writer.writerow(
                    [
                        f"REF-{a['id']}",
                        a["industry"],
                        f"{a['prob'] * 100:.1f}",
                        a["label"],
                    ]
                )
        else:
            writer.writerow(["No significant high-risk anomalies currently flagged"])

    return output.getvalue().encode("utf-8-sig"), filename


def generate_institutional_json(
    db: Session,
    role: str = "regulator",
    scale: str | None = None,
    sector: str | None = None,
) -> tuple[bytes, str]:
    """Generate detailed system-wide aggregate JSON."""
    data = collect_all_report_data(db, role=role, scale=scale, sector=sector)
    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
    return json.dumps(data, indent=2).encode("utf-8"), filename


async def generate_institutional_zip(
    db: Session,
    user_time: str | None = None,
    role: str = "regulator",
    scale: str | None = None,
    sector: str | None = None,
) -> tuple[bytes, str]:
    """Bundle all detailed aggregate formats into a ZIP (async).

    Generates each format sequentially and releases buffers before building
    the ZIP to keep peak memory at the size of one format at a time.
    """
    slug = "analyst" if role == "policy_analyst" else "regulator"
    zip_filename = f"finwatch_{slug}_bundle_{datetime.now(timezone.utc).strftime('%Y%m%d')}.zip"

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".zip", delete=False
        ) as tmp_zip:
            tmp_path = tmp_zip.name

        with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            # PDF — generate, write, discard bytes
            pdf_bytes, pdf_name = await generate_institutional_pdf(
                db, user_time=user_time, role=role, scale=scale, sector=sector
            )
            zf.writestr(pdf_name, pdf_bytes)
            del pdf_bytes

            # CSV — generate, write, discard bytes
            csv_bytes, csv_name = generate_institutional_csv(
                db, role=role, scale=scale, sector=sector
            )
            zf.writestr(csv_name, csv_bytes)
            del csv_bytes

            # JSON — generate, write, discard bytes
            json_bytes, json_name = generate_institutional_json(
                db, role=role, scale=scale, sector=sector
            )
            zf.writestr(json_name, json_bytes)
            del json_bytes

        with open(tmp_path, "rb") as f:
            zip_bytes = f.read()

        return zip_bytes, zip_filename
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
