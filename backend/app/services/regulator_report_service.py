"""
FinWatch Zambia - Regulator Report Service

Generates aggregate export files for the regulator portal.
All exports are fully anonymised — no company names, user IDs, or PII.

Export formats: PDF, CSV, JSON, ZIP (all three bundled).

Data included per export:
- System Overview KPIs
- Sector Distress Breakdown
- Monthly Temporal Trends (12 months)
- ML Model Performance Comparison
- Financial Ratio Benchmarks (distressed vs healthy averages)
- Anonymised High-Risk Flags (distress_probability >= 0.70)
"""

from __future__ import annotations

import csv
import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

TEAL = colors.HexColor("#059669")
TEAL_LIGHT = colors.HexColor("#d1fae5")
TEAL_MID = colors.HexColor("#34d399")
PURPLE = colors.HexColor("#6d28d9")
PURPLE_LIGHT = colors.HexColor("#ede9fe")
RED = colors.HexColor("#dc2626")
RED_LIGHT = colors.HexColor("#fee2e2")
GREEN = colors.HexColor("#16a34a")
GREEN_LIGHT = colors.HexColor("#dcfce7")
AMBER = colors.HexColor("#d97706")
AMBER_LIGHT = colors.HexColor("#fef3c7")
GREY_DARK = colors.HexColor("#1f2937")
GREY_MID = colors.HexColor("#6b7280")
GREY_LIGHT = colors.HexColor("#f9fafb")
BORDER = colors.HexColor("#e5e7eb")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm

HIGH_RISK_THRESHOLD = 0.70
MEDIUM_RISK_THRESHOLD = 0.40

RATIO_LABELS = {
    "current_ratio": "Current Ratio",
    "quick_ratio": "Quick Ratio",
    "cash_ratio": "Cash Ratio",
    "debt_to_equity": "Debt to Equity",
    "debt_to_assets": "Debt to Assets",
    "interest_coverage": "Interest Coverage",
    "net_profit_margin": "Net Profit Margin",
    "return_on_assets": "Return on Assets",
    "return_on_equity": "Return on Equity",
    "asset_turnover": "Asset Turnover",
}




def _collect_all_data(db: "Session") -> dict:
    """Fetch all aggregate data from the database for export."""
    from datetime import timedelta
    from statistics import median as stat_median

    from sqlalchemy import func

    from app.models.company import Company
    from app.models.financial_record import FinancialRecord
    from app.models.prediction import Prediction
    from app.models.ratio_feature import RatioFeature
    from app.models.user import User

    generated_at = datetime.now(timezone.utc)

    total_assessments = db.query(func.count(Prediction.id)).scalar() or 0
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    total_sme_owners = (
        db.query(func.count(User.id)).filter(User.role == "sme_owner").scalar() or 0
    )
    sectors_covered = (
        db.query(func.count(func.distinct(Company.industry)))
        .filter(Company.industry.isnot(None))
        .scalar()
        or 0
    )

    all_probs = [r[0] for r in db.query(Prediction.distress_probability).all()]
    avg_prob = sum(all_probs) / len(all_probs) if all_probs else 0.0
    high_risk = sum(1 for p in all_probs if p >= HIGH_RISK_THRESHOLD)
    medium_risk = sum(
        1 for p in all_probs if MEDIUM_RISK_THRESHOLD <= p < HIGH_RISK_THRESHOLD
    )
    low_risk = len(all_probs) - high_risk - medium_risk
    overall_distress_rate = high_risk / len(all_probs) if all_probs else 0.0

    overview = {
        "total_assessments": total_assessments,
        "total_companies": total_companies,
        "total_sme_owners": total_sme_owners,
        "sectors_covered": sectors_covered,
        "avg_distress_prob": round(avg_prob, 4),
        "overall_distress_rate": round(overall_distress_rate, 4),
        "high_risk_count": high_risk,
        "medium_risk_count": medium_risk,
        "low_risk_count": low_risk,
    }

    sector_rows = (
        db.query(
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
            func.avg(RatioFeature.current_ratio).label("avg_cr"),
            func.avg(RatioFeature.debt_to_assets).label("avg_da"),
        )
        .select_from(Company)
        .join(FinancialRecord, FinancialRecord.company_id == Company.id)
        .join(RatioFeature, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
        .group_by(Company.industry)
        .all()
    )
    sectors = []
    for industry, total, avg_p, avg_cr, avg_da in sector_rows:
        label = industry or "Unspecified"
        if total < 3:
            label = "Other (suppressed)"
        sectors.append(
            {
                "industry": label,
                "total_assessments": int(total),
                "distress_count": int((avg_p or 0) * total),
                "healthy_count": int(total) - int((avg_p or 0) * total),
                "distress_rate": round(float(avg_p or 0), 4),
                "avg_distress_prob": round(float(avg_p or 0), 4),
                "avg_current_ratio": round(float(avg_cr or 0), 4),
                "avg_debt_to_assets": round(float(avg_da or 0), 4),
            }
        )
    sectors.sort(key=lambda s: s["distress_rate"], reverse=True)

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    
    # DB-Agnostic month formatting
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        month_label = func.to_char(Prediction.predicted_at, "YYYY-MM").label("month")
    else:
        month_label = func.strftime("%Y-%m", Prediction.predicted_at).label("month")

    trend_rows = (
        db.query(
            month_label,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .filter(Prediction.predicted_at >= cutoff)
        .group_by("month")
        .order_by("month")
        .all()
    )
    trends = [
        {
            "period": month,
            "total_assessments": int(total),
            "distress_count": int(float(avg_p or 0) * total),
            "healthy_count": int(total) - int(float(avg_p or 0) * total),
            "distress_rate": round(float(avg_p or 0), 4),
            "avg_distress_prob": round(float(avg_p or 0), 4),
        }
        for month, total, avg_p in trend_rows
    ]

    model_rows = (
        db.query(
            Prediction.model_used,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .group_by(Prediction.model_used)
        .all()
    )
    model_perf = []
    for model_used, total, avg_p in model_rows:
        dist = int(float(avg_p or 0) * total)
        model_perf.append(
            {
                "model_name": model_used,
                "total_predictions": int(total),
                "distress_count": dist,
                "healthy_count": int(total) - dist,
                "avg_distress_prob": round(float(avg_p or 0), 4),
                "distress_rate": round(float(avg_p or 0), 4),
            }
        )

    ratio_benchmarks = []
    for ratio_name in RATIO_LABELS:
        col = getattr(RatioFeature, ratio_name)
        stats = (
            db.query(func.avg(col), func.min(col), func.max(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .first()
        )
        all_vals_query = db.query(col).select_from(RatioFeature).join(Prediction, Prediction.ratio_feature_id == RatioFeature.id).filter(col.isnot(None)).all()
        all_vals = [r[0] for r in all_vals_query]
        med = stat_median(all_vals) if all_vals else 0.0
        dist_avg = (
            db.query(func.avg(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        healthy_avg = (
            db.query(func.avg(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability < MEDIUM_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        ratio_benchmarks.append(
            {
                "ratio_name": ratio_name,
                "label": RATIO_LABELS[ratio_name],
                "avg_value": round(float(stats[0] or 0), 4),
                "median_value": round(float(med), 4),
                "min_value": round(float(stats[1] or 0), 4),
                "max_value": round(float(stats[2] or 0), 4),
                "distressed_avg": round(float(dist_avg), 4),
                "healthy_avg": round(float(healthy_avg), 4),
            }
        )

    anomaly_rows = (
        db.query(
            Prediction.id,
            Company.industry,
            Prediction.model_used,
            Prediction.distress_probability,
            Prediction.risk_label,
            FinancialRecord.period,
            Prediction.predicted_at,
        )
        .select_from(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
        .order_by(Prediction.distress_probability.desc())
        .limit(100)
        .all()
    )
    anomalies = [
        {
            "assessment_id": pred_id,
            "industry": industry or "Unspecified",
            "model_used": model_used,
            "distress_probability": round(float(dist_prob), 4),
            "risk_label": risk_label,
            "period": period,
            "flagged_at": flagged_at.isoformat() if flagged_at else None,
        }
        for pred_id, industry, model_used, dist_prob, risk_label, period, flagged_at in anomaly_rows
    ]

    return {
        "generated_at": generated_at.isoformat(),
        "note": "Anonymised aggregate data — FinWatch Zambia Regulator Portal. No company names or PII included.",
        "overview": overview,
        "sector_distress": sectors,
        "monthly_trends": trends,
        "model_performance": model_perf,
        "ratio_benchmarks": ratio_benchmarks,
        "anomaly_flags": anomalies,
    }




def _export_filename(ext: str) -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"finwatch_regulator_export_{date_str}.{ext}"


def _build_styles() -> dict:
    return {
        "title": ParagraphStyle(
            "RTitle",
            fontSize=20,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "RSubtitle",
            fontSize=10,
            fontName="Helvetica",
            textColor=GREY_MID,
            spaceAfter=0,
        ),
        "section": ParagraphStyle(
            "RSection",
            fontSize=11,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=14,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "RBody",
            fontSize=9,
            fontName="Helvetica",
            textColor=GREY_DARK,
            leading=14,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "RSmall", fontSize=8, fontName="Helvetica", textColor=GREY_MID, leading=11
        ),
        "disclaimer": ParagraphStyle(
            "RDisclaimer",
            fontSize=7.5,
            fontName="Helvetica-Oblique",
            textColor=GREY_MID,
            leading=10,
        ),
    }


def _header_footer(canvas, doc, generated_at: str):
    canvas.saveState()
    w, h = A4

    canvas.setStrokeColor(TEAL)
    canvas.setLineWidth(3)
    canvas.line(MARGIN, h - MARGIN + 4 * mm, w - MARGIN, h - MARGIN + 4 * mm)

    canvas.setFont("Helvetica-Bold", 10)
    canvas.setFillColor(TEAL)
    canvas.drawString(MARGIN, h - MARGIN + 6 * mm, "FinWatch Zambia — Regulator Portal")

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY_MID)
    canvas.drawRightString(
        w - MARGIN, h - MARGIN + 6 * mm, f"Generated: {generated_at}"
    )

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)

    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(
        w / 2,
        MARGIN - 7 * mm,
        f"Page {doc.page}  ·  Confidential — Regulatory Use Only",
    )

    canvas.restoreState()


def _kv_table(rows: list[tuple], col_widths: list) -> Table:
    """Build a simple 2-column key-value table."""
    table = Table(rows, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, 0), (0, -1), GREY_MID),
                ("TEXTCOLOR", (1, 0), (1, -1), GREY_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GREY_LIGHT]),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
            ]
        )
    )
    return table


def _data_table(headers: list[str], rows: list[list], col_widths: list) -> Table:
    """Build a multi-column data table with a teal header row."""
    header_para = [
        Paragraph(
            f"<b>{h}</b>",
            ParagraphStyle("H", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL),
        )
        for h in headers
    ]
    all_rows = [header_para] + [
        [
            Paragraph(
                str(c),
                ParagraphStyle(
                    "C",
                    fontSize=8,
                    fontName="Helvetica",
                    textColor=GREY_DARK,
                    leading=11,
                ),
            )
            for c in row
        ]
        for row in rows
    ]
    table = Table(all_rows, colWidths=col_widths)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), TEAL_LIGHT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
    ]
    for i in range(1, len(all_rows)):
        bg = WHITE if i % 2 == 1 else GREY_LIGHT
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
    table.setStyle(TableStyle(style_cmds))
    return table




def generate_regulator_pdf(db: "Session") -> tuple[bytes, str]:
    """Generate full aggregate regulatory PDF report. Returns (bytes, filename)."""
    data = _collect_all_data(db)
    filename = _export_filename("pdf")
    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    styles = _build_styles()
    w_content = PAGE_W - 2 * MARGIN

    story = []
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Regulatory Financial Distress Report", styles["title"]))
    story.append(
        Paragraph(
            f"FinWatch Zambia  ·  System-Wide Aggregate Analysis  ·  {generated_at}",
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("1. System Overview", styles["section"]))
    ov = data["overview"]
    kv_rows = [
        ("Total Assessments", str(ov["total_assessments"])),
        ("Total Registered SMEs", str(ov["total_companies"])),
        ("Total SME Owners", str(ov["total_sme_owners"])),
        ("Sectors Covered", str(ov["sectors_covered"])),
        (
            "High Risk Assessments",
            f"{ov['high_risk_count']} ({round(ov['high_risk_count'] / max(ov['total_assessments'], 1) * 100, 1)}%)",
        ),
        (
            "Medium Risk",
            f"{ov['medium_risk_count']} ({round(ov['medium_risk_count'] / max(ov['total_assessments'], 1) * 100, 1)}%)",
        ),
        (
            "Low Risk (Healthy)",
            f"{ov['low_risk_count']} ({round(ov['low_risk_count'] / max(ov['total_assessments'], 1) * 100, 1)}%)",
        ),
        ("Overall Distress Rate", f"{ov['overall_distress_rate'] * 100:.2f}%"),
        ("Avg Distress Probability", f"{ov['avg_distress_prob'] * 100:.2f}%"),
    ]
    story.append(_kv_table(kv_rows, [w_content * 0.45, w_content * 0.55]))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("2. Distress by Industry Sector", styles["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=TEAL_LIGHT))
    story.append(Spacer(1, 0.2 * cm))
    if data["sector_distress"]:
        sector_headers = [
            "Sector",
            "Assessments",
            "Distressed",
            "Healthy",
            "Distress Rate",
            "Avg Prob",
        ]
        sector_rows = [
            [
                s["industry"],
                s["total_assessments"],
                s["distress_count"],
                s["healthy_count"],
                f"{s['distress_rate'] * 100:.1f}%",
                f"{s['avg_distress_prob'] * 100:.1f}%",
            ]
            for s in data["sector_distress"]
        ]
        story.append(
            _data_table(
                sector_headers,
                sector_rows,
                [
                    w_content * 0.32,
                    w_content * 0.12,
                    w_content * 0.12,
                    w_content * 0.12,
                    w_content * 0.16,
                    w_content * 0.16,
                ],
            )
        )
    else:
        story.append(Paragraph("No sector data available.", styles["small"]))
    story.append(Spacer(1, 0.4 * cm))

    story.append(
        Paragraph("3. Monthly Distress Trends (Last 12 Months)", styles["section"])
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=TEAL_LIGHT))
    story.append(Spacer(1, 0.2 * cm))
    if data["monthly_trends"]:
        trend_headers = [
            "Month",
            "Total Assessments",
            "Distressed",
            "Healthy",
            "Distress Rate",
        ]
        trend_rows = [
            [
                t["period"],
                t["total_assessments"],
                t["distress_count"],
                t["healthy_count"],
                f"{t['distress_rate'] * 100:.1f}%",
            ]
            for t in data["monthly_trends"]
        ]
        story.append(
            _data_table(
                trend_headers,
                trend_rows,
                [
                    w_content * 0.2,
                    w_content * 0.2,
                    w_content * 0.2,
                    w_content * 0.2,
                    w_content * 0.2,
                ],
            )
        )
    else:
        story.append(
            Paragraph(
                "No trend data available for the last 12 months.", styles["small"]
            )
        )
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("4. ML Model Performance Comparison", styles["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=TEAL_LIGHT))
    story.append(Spacer(1, 0.2 * cm))
    if data["model_performance"]:
        model_headers = [
            "Model",
            "Total Predictions",
            "Distressed",
            "Healthy",
            "Distress Rate",
            "Avg Prob",
        ]
        model_rows = [
            [
                "Random Forest"
                if m["model_name"] == "random_forest"
                else "Logistic Regression",
                m["total_predictions"],
                m["distress_count"],
                m["healthy_count"],
                f"{m['distress_rate'] * 100:.1f}%",
                f"{m['avg_distress_prob'] * 100:.1f}%",
            ]
            for m in data["model_performance"]
        ]
        story.append(
            _data_table(
                model_headers,
                model_rows,
                [
                    w_content * 0.30,
                    w_content * 0.14,
                    w_content * 0.14,
                    w_content * 0.14,
                    w_content * 0.14,
                    w_content * 0.14,
                ],
            )
        )
    story.append(Spacer(1, 0.4 * cm))

    story.append(
        Paragraph(
            "5. Financial Ratio Benchmarks (Distressed vs Healthy)", styles["section"]
        )
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=TEAL_LIGHT))
    story.append(Spacer(1, 0.2 * cm))
    ratio_headers = ["Ratio", "System Avg", "Median", "Distressed Avg", "Healthy Avg"]
    ratio_rows_data = [
        [
            r["label"],
            f"{r['avg_value']:.4f}",
            f"{r['median_value']:.4f}",
            f"{r['distressed_avg']:.4f}",
            f"{r['healthy_avg']:.4f}",
        ]
        for r in data["ratio_benchmarks"]
    ]
    story.append(
        _data_table(
            ratio_headers,
            ratio_rows_data,
            [
                w_content * 0.30,
                w_content * 0.175,
                w_content * 0.175,
                w_content * 0.175,
                w_content * 0.175,
            ],
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    story.append(
        Paragraph("6. Anonymised High-Risk Flags (Distress ≥ 70%)", styles["section"])
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=TEAL_LIGHT))
    story.append(Spacer(1, 0.2 * cm))
    if data["anomaly_flags"]:
        anom_headers = [
            "Ref. ID",
            "Sector",
            "Period",
            "Model",
            "Distress Prob.",
            "Risk Label",
        ]
        anom_rows = [
            [
                f"#{a['assessment_id']}",
                a["industry"],
                a["period"],
                "RF" if a["model_used"] == "random_forest" else "LR",
                f"{a['distress_probability'] * 100:.1f}%",
                a["risk_label"],
            ]
            for a in data["anomaly_flags"]
        ]
        story.append(
            _data_table(
                anom_headers,
                anom_rows,
                [
                    w_content * 0.10,
                    w_content * 0.28,
                    w_content * 0.14,
                    w_content * 0.10,
                    w_content * 0.18,
                    w_content * 0.20,
                ],
            )
        )
    else:
        story.append(
            Paragraph(
                "No assessments currently exceed the 70% distress threshold.",
                styles["small"],
            )
        )
    story.append(Spacer(1, 0.5 * cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>CONFIDENTIALITY NOTICE:</b> This report is produced by the FinWatch Zambia automated ML system "
            "and is intended exclusively for regulatory and supervisory use. All data is fully anonymised — "
            "no company names, user identifiers, or personally identifiable information is included. "
            "Models are trained on the UCI Polish Companies Bankruptcy dataset (DOI: 10.24432/C5V61K) and "
            "contextualised against World Bank Zambia Enterprise Survey data (2019–2020). "
            "This report does not constitute a credit assessment, investment recommendation, or regulatory ruling.",
            styles["disclaimer"],
        )
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN + 0.8 * cm,
        bottomMargin=MARGIN + 0.5 * cm,
        title="FinWatch Zambia — Regulatory Report",
        author="FinWatch Zambia Regulator Portal",
    )
    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, generated_at),
        onLaterPages=lambda c, d: _header_footer(c, d, generated_at),
    )

    logger.info("Regulator PDF generated (%d bytes)", buf.tell())
    return buf.getvalue(), filename




def generate_regulator_csv(db: "Session") -> tuple[bytes, str]:
    """Generate flat CSV export of all aggregate regulator data. Returns (bytes, filename)."""
    data = _collect_all_data(db)
    filename = _export_filename("csv")
    buf = io.StringIO()
    w = csv.writer(buf)

    w.writerow(["# SECTION 1: SYSTEM OVERVIEW"])
    w.writerow(["Metric", "Value"])
    for k, v in data["overview"].items():
        w.writerow([k.replace("_", " ").title(), v])
    w.writerow([])

    w.writerow(["# SECTION 2: SECTOR DISTRESS BREAKDOWN"])
    if data["sector_distress"]:
        w.writerow(
            [
                "Industry",
                "Total Assessments",
                "Distressed",
                "Healthy",
                "Distress Rate (%)",
                "Avg Distress Prob (%)",
                "Avg Current Ratio",
                "Avg Debt to Assets",
            ]
        )
        for s in data["sector_distress"]:
            w.writerow(
                [
                    s["industry"],
                    s["total_assessments"],
                    s["distress_count"],
                    s["healthy_count"],
                    f"{s['distress_rate'] * 100:.2f}",
                    f"{s['avg_distress_prob'] * 100:.2f}",
                    f"{s['avg_current_ratio']:.4f}",
                    f"{s['avg_debt_to_assets']:.4f}",
                ]
            )
    w.writerow([])

    w.writerow(["# SECTION 3: MONTHLY TRENDS (LAST 12 MONTHS)"])
    if data["monthly_trends"]:
        w.writerow(
            [
                "Month",
                "Total Assessments",
                "Distressed",
                "Healthy",
                "Distress Rate (%)",
                "Avg Distress Prob (%)",
            ]
        )
        for t in data["monthly_trends"]:
            w.writerow(
                [
                    t["period"],
                    t["total_assessments"],
                    t["distress_count"],
                    t["healthy_count"],
                    f"{t['distress_rate'] * 100:.2f}",
                    f"{t['avg_distress_prob'] * 100:.2f}",
                ]
            )
    w.writerow([])

    w.writerow(["# SECTION 4: MODEL PERFORMANCE"])
    w.writerow(
        [
            "Model",
            "Total Predictions",
            "Distressed",
            "Healthy",
            "Distress Rate (%)",
            "Avg Distress Prob (%)",
        ]
    )
    for m in data["model_performance"]:
        label = (
            "Random Forest"
            if m["model_name"] == "random_forest"
            else "Logistic Regression"
        )
        w.writerow(
            [
                label,
                m["total_predictions"],
                m["distress_count"],
                m["healthy_count"],
                f"{m['distress_rate'] * 100:.2f}",
                f"{m['avg_distress_prob'] * 100:.2f}",
            ]
        )
    w.writerow([])

    w.writerow(["# SECTION 5: FINANCIAL RATIO BENCHMARKS"])
    w.writerow(
        [
            "Ratio",
            "System Average",
            "Median",
            "Min",
            "Max",
            "Distressed Avg",
            "Healthy Avg",
        ]
    )
    for r in data["ratio_benchmarks"]:
        w.writerow(
            [
                r["label"],
                r["avg_value"],
                r["median_value"],
                r["min_value"],
                r["max_value"],
                r["distressed_avg"],
                r["healthy_avg"],
            ]
        )
    w.writerow([])

    w.writerow(["# SECTION 6: ANONYMISED HIGH-RISK FLAGS (Distress >= 70%)"])
    if data["anomaly_flags"]:
        w.writerow(
            [
                "Assessment Ref ID",
                "Industry",
                "Period",
                "Model",
                "Distress Probability (%)",
                "Risk Label",
                "Flagged At",
            ]
        )
        for a in data["anomaly_flags"]:
            w.writerow(
                [
                    f"#{a['assessment_id']}",
                    a["industry"],
                    a["period"],
                    "Random Forest"
                    if a["model_used"] == "random_forest"
                    else "Logistic Regression",
                    f"{a['distress_probability'] * 100:.1f}",
                    a["risk_label"],
                    a["flagged_at"],
                ]
            )
    w.writerow([])

    w.writerow(["# NOTE"])
    w.writerow(
        [
            "All data is fully anonymised. No company names or PII are included. For regulatory use only."
        ]
    )

    csv_bytes = buf.getvalue().encode("utf-8-sig")
    logger.info("Regulator CSV generated (%d bytes)", len(csv_bytes))
    return csv_bytes, filename




def generate_regulator_json(db: "Session") -> tuple[bytes, str]:
    """Generate structured JSON export matching the full prediction schema. Returns (bytes, filename)."""
    data = _collect_all_data(db)
    filename = _export_filename("json")
    json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")
    logger.info("Regulator JSON generated (%d bytes)", len(json_bytes))
    return json_bytes, filename




def generate_regulator_zip(db: "Session") -> tuple[bytes, str]:
    """Generate ZIP bundle containing PDF + CSV + JSON. Returns (bytes, filename)."""
    filename = _export_filename("zip")

    pdf_bytes, pdf_name = generate_regulator_pdf(db)
    csv_bytes, csv_name = generate_regulator_csv(db)
    json_bytes, json_name = generate_regulator_json(db)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(pdf_name, pdf_bytes)
        zf.writestr(csv_name, csv_bytes)
        zf.writestr(json_name, json_bytes)

    logger.info("Regulator ZIP bundle generated: %s", filename)
    return buf.getvalue(), filename
