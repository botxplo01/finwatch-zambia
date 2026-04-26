"""
FinWatch Zambia - Report Service

Generates PDF, CSV, and ZIP bundle exports for completed predictions.

PDF layout (ReportLab Platypus):
- Branded header + executive summary
- Financial ratio table with healthy benchmarks + status indicators
- SHAP attribution table (top 5 drivers, direction, magnitude)
- Full NLP narrative
- Advisory disclaimer footer

CSV layout:
- Section 1 — Assessment metadata (company, period, model, result)
- Section 2 — Financial ratios (actual vs benchmark)
- Section 3 — SHAP feature attributions

ZIP bundle: PDF + CSV
"""

from __future__ import annotations

import csv
import io
import json
import logging
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
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

    from app.models.prediction import Prediction

logger = logging.getLogger(__name__)

RATIO_META: dict[str, dict] = {
    "current_ratio": {
        "label": "Current Ratio",
        "unit": "x",
        "dir": "min",
        "bench": 1.5,
    },
    "quick_ratio": {"label": "Quick Ratio", "unit": "x", "dir": "min", "bench": 1.0},
    "cash_ratio": {"label": "Cash Ratio", "unit": "x", "dir": "min", "bench": 0.2},
    "debt_to_equity": {
        "label": "Debt to Equity",
        "unit": "x",
        "dir": "max",
        "bench": 2.0,
    },
    "debt_to_assets": {
        "label": "Debt to Assets",
        "unit": "x",
        "dir": "max",
        "bench": 0.6,
    },
    "interest_coverage": {
        "label": "Interest Coverage",
        "unit": "x",
        "dir": "min",
        "bench": 2.0,
    },
    "net_profit_margin": {
        "label": "Net Profit Margin",
        "unit": "%",
        "dir": "min",
        "bench": 0.05,
    },
    "return_on_assets": {
        "label": "Return on Assets",
        "unit": "%",
        "dir": "min",
        "bench": 0.02,
    },
    "return_on_equity": {
        "label": "Return on Equity",
        "unit": "%",
        "dir": "min",
        "bench": 0.05,
    },
    "asset_turnover": {
        "label": "Asset Turnover",
        "unit": "x",
        "dir": "min",
        "bench": 0.5,
    },
}

PURPLE = colors.HexColor("#6d28d9")
PURPLE_LIGHT = colors.HexColor("#ede9fe")
PURPLE_MID = colors.HexColor("#8b5cf6")
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



def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "_", slug)
    return slug[:40]


def _fmt_ratio(value: float, unit: str) -> str:
    if unit == "%":
        return f"{value * 100:.1f}%"
    return f"{value:.3f}x"


def _fmt_bench(bench: float, unit: str) -> str:
    if unit == "%":
        return f"{bench * 100:.1f}%"
    return f"{bench:.2f}x"


def _ratio_ok(value: float, meta: dict) -> bool:
    if meta["dir"] == "min":
        return value >= meta["bench"]
    return value <= meta["bench"]


def _resolve_context(prediction: "Prediction", db: "Session") -> dict:
    """Resolve company name and period from the prediction's join chain."""
    from app.models.company import Company
    from app.models.financial_record import FinancialRecord
    from app.models.ratio_feature import RatioFeature

    row = (
        db.query(Company.name, FinancialRecord.period)
        .join(FinancialRecord, FinancialRecord.company_id == Company.id)
        .join(RatioFeature, RatioFeature.financial_record_id == FinancialRecord.id)
        .filter(RatioFeature.id == prediction.ratio_feature_id)
        .first()
    )
    return {
        "company_name": row[0] if row else "Unknown Company",
        "period": row[1] if row else "Unknown Period",
    }


def _get_ratios(prediction: "Prediction") -> dict[str, float]:
    rf = prediction.ratio_feature
    return {k: getattr(rf, k, 0.0) for k in RATIO_META}


def _get_shap(prediction: "Prediction") -> dict[str, float]:
    try:
        return json.loads(prediction.shap_values_json)
    except Exception:
        return {}


def _build_filename(slug: str, period: str, pred_id: int, ext: str) -> str:
    return f"finwatch_{slug}_{period}_{pred_id}.{ext}"




def _build_styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "FWTitle",
            fontSize=20,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "FWSubtitle",
            fontSize=10,
            fontName="Helvetica",
            textColor=GREY_MID,
            spaceAfter=0,
        ),
        "section": ParagraphStyle(
            "FWSection",
            fontSize=11,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=14,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "FWBody",
            fontSize=9,
            fontName="Helvetica",
            textColor=GREY_DARK,
            leading=14,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "FWSmall",
            fontSize=8,
            fontName="Helvetica",
            textColor=GREY_MID,
            leading=11,
        ),
        "risk_distressed": ParagraphStyle(
            "FWRiskD",
            fontSize=13,
            fontName="Helvetica-Bold",
            textColor=RED,
        ),
        "risk_healthy": ParagraphStyle(
            "FWRiskH",
            fontSize=13,
            fontName="Helvetica-Bold",
            textColor=GREEN,
        ),
        "disclaimer": ParagraphStyle(
            "FWDisclaimer",
            fontSize=7.5,
            fontName="Helvetica-Oblique",
            textColor=GREY_MID,
            leading=10,
        ),
    }


def _header_footer(canvas, doc, company_name: str, period: str):
    canvas.saveState()
    w, h = A4

    # Top rule
    canvas.setStrokeColor(PURPLE)
    canvas.setLineWidth(3)
    canvas.line(MARGIN, h - MARGIN + 4 * mm, w - MARGIN, h - MARGIN + 4 * mm)

    # Brand name top-left
    canvas.setFont("Helvetica-Bold", 10)
    canvas.setFillColor(PURPLE)
    canvas.drawString(MARGIN, h - MARGIN + 6 * mm, "FinWatch Zambia")

    # Company + period top-right
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY_MID)
    canvas.drawRightString(
        w - MARGIN, h - MARGIN + 6 * mm, f"{company_name}  |  {period}"
    )

    # Bottom rule
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)

    # Page number
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(w / 2, MARGIN - 7 * mm, f"Page {doc.page}")

    canvas.restoreState()


def generate_pdf_report(
    prediction: "Prediction",
    db: "Session",
) -> tuple[str, str]:
    """Generate a full PDF assessment report using ReportLab Platypus. Returns (file_path, filename)."""
    if prediction.ratio_feature is None:
        raise RuntimeError(f"Prediction {prediction.id} has no ratio_feature.")
    if prediction.narrative is None:
        raise RuntimeError(f"Prediction {prediction.id} has no narrative.")

    ctx = _resolve_context(prediction, db)
    company_name = ctx["company_name"]
    period = ctx["period"]
    slug = _slugify(company_name)
    filename = _build_filename(slug, period, prediction.id, "pdf")
    output_path = settings.reports_path / filename
    settings.reports_path.mkdir(parents=True, exist_ok=True)

    styles = _build_styles()
    ratios = _get_ratios(prediction)
    shap = _get_shap(prediction)
    is_distressed = prediction.risk_label == "Distressed"
    prob_pct = round(prediction.distress_probability * 100, 1)
    generated_at = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")
    model_label = (
        "Random Forest"
        if prediction.model_used == "random_forest"
        else "Logistic Regression"
    )

    story = []

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Financial Distress Assessment Report", styles["title"]))
    story.append(
        Paragraph(
            f"{company_name}  ·  Period: {period}  ·  Generated: {generated_at}",
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.4 * cm))

    risk_bg = RED_LIGHT if is_distressed else GREEN_LIGHT
    risk_color = RED if is_distressed else GREEN
    risk_text = "DISTRESSED" if is_distressed else "HEALTHY"

    summary_data = [
        [
            Paragraph(f"<b>Risk Classification</b>", styles["body"]),
            Paragraph(f"<b>Distress Probability</b>", styles["body"]),
            Paragraph(f"<b>ML Model</b>", styles["body"]),
        ],
        [
            Paragraph(
                f'<font color="{risk_color.hexval()}" size="14"><b>{risk_text}</b></font>',
                styles["body"],
            ),
            Paragraph(f'<font size="14"><b>{prob_pct}%</b></font>', styles["body"]),
            Paragraph(model_label, styles["body"]),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[(PAGE_W - 2 * MARGIN) / 3] * 3)
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREY_LIGHT),
                ("BACKGROUND", (0, 1), (-1, 1), risk_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("ROUNDEDCORNERS", [4]),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Financial Ratio Analysis", styles["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=PURPLE_LIGHT))
    story.append(Spacer(1, 0.2 * cm))

    col_w = (PAGE_W - 2 * MARGIN) / 5
    ratio_header = [
        Paragraph("<b>Ratio</b>", styles["body"]),
        Paragraph("<b>Actual</b>", styles["body"]),
        Paragraph("<b>Benchmark</b>", styles["body"]),
        Paragraph("<b>Direction</b>", styles["body"]),
        Paragraph("<b>Status</b>", styles["body"]),
    ]
    ratio_rows = [ratio_header]
    ratio_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE_LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
    ]

    for i, (key, meta) in enumerate(RATIO_META.items()):
        val = ratios.get(key, 0.0)
        ok = _ratio_ok(val, meta)
        bg = colors.white if i % 2 == 0 else GREY_LIGHT
        direction = (
            f">= {_fmt_bench(meta['bench'], meta['unit'])}"
            if meta["dir"] == "min"
            else f"<= {_fmt_bench(meta['bench'], meta['unit'])}"
        )
        status_para = Paragraph(
            f'<font color="{"#16a34a" if ok else "#dc2626"}"><b>{"Pass" if ok else "Fail"}</b></font>',
            styles["body"],
        )
        row_idx = i + 1
        ratio_style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg))
        ratio_rows.append(
            [
                Paragraph(meta["label"], styles["body"]),
                Paragraph(f"<b>{_fmt_ratio(val, meta['unit'])}</b>", styles["body"]),
                Paragraph(_fmt_bench(meta["bench"], meta["unit"]), styles["small"]),
                Paragraph(direction, styles["small"]),
                status_para,
            ]
        )

    ratio_table = Table(
        ratio_rows,
        colWidths=[col_w * 1.6, col_w * 0.9, col_w * 0.9, col_w * 0.9, col_w * 0.7],
    )
    ratio_table.setStyle(TableStyle(ratio_style_cmds))
    story.append(ratio_table)
    story.append(Spacer(1, 0.5 * cm))

    story.append(
        Paragraph("SHAP Feature Attribution (Top 5 Drivers)", styles["section"])
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=PURPLE_LIGHT))
    story.append(Spacer(1, 0.2 * cm))

    if shap:
        sorted_shap = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
        shap_header = [
            Paragraph("<b>Feature</b>", styles["body"]),
            Paragraph("<b>SHAP Value</b>", styles["body"]),
            Paragraph("<b>Direction</b>", styles["body"]),
            Paragraph("<b>Interpretation</b>", styles["body"]),
        ]
        shap_rows = [shap_header]
        shap_style = [
            ("BACKGROUND", (0, 0), (-1, 0), PURPLE_LIGHT),
            ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (1, 0), (2, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
        ]
        for i, (feature, val) in enumerate(sorted_shap):
            meta = RATIO_META.get(feature, {})
            label = meta.get("label", feature)
            increases = val > 0
            direction_text = "Increases Risk" if increases else "Reduces Risk"
            direction_color = "#dc2626" if increases else "#16a34a"
            interp = f"This ratio {'pushes toward' if increases else 'pulls away from'} distress classification"
            bg = colors.white if i % 2 == 0 else GREY_LIGHT
            shap_style.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg))
            shap_rows.append(
                [
                    Paragraph(label, styles["body"]),
                    Paragraph(f"{val:+.4f}", styles["body"]),
                    Paragraph(
                        f'<font color="{direction_color}"><b>{direction_text}</b></font>',
                        styles["body"],
                    ),
                    Paragraph(interp, styles["small"]),
                ]
            )

        shap_table = Table(
            shap_rows,
            colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.28, 0.15, 0.22, 0.35]],
        )
        shap_table.setStyle(TableStyle(shap_style))
        story.append(shap_table)
    else:
        story.append(
            Paragraph("SHAP values not available for this prediction.", styles["small"])
        )

    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Financial Health Narrative", styles["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=PURPLE_LIGHT))
    story.append(Spacer(1, 0.2 * cm))

    narrative_text = prediction.narrative.content.replace("\n", "<br/>")
    source_label = prediction.narrative.source.capitalize()
    story.append(Paragraph(narrative_text, styles["body"]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(f"Narrative generated via: {source_label}", styles["small"]))
    story.append(Spacer(1, 0.6 * cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.2 * cm))
    disclaimer = (
        "<b>ADVISORY DISCLAIMER:</b> This report is generated by an automated machine learning system "
        "trained on the UCI Polish Companies Bankruptcy dataset. It is intended for informational and "
        "academic purposes only and does not constitute financial, credit, or investment advice. "
        "FinWatch Zambia accepts no liability for decisions made on the basis of this report. "
        "Always consult a qualified financial professional before making business decisions."
    )
    story.append(Paragraph(disclaimer, styles["disclaimer"]))

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN + 0.8 * cm,
        bottomMargin=MARGIN + 0.5 * cm,
        title=f"FinWatch Assessment — {company_name} {period}",
        author="FinWatch Zambia",
    )
    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, company_name, period),
        onLaterPages=lambda c, d: _header_footer(c, d, company_name, period),
    )

    logger.info("PDF report generated: %s", output_path)
    return str(output_path), filename




def generate_csv_report(
    prediction: "Prediction",
    db: "Session",
) -> tuple[bytes, str]:
    """Generate a structured CSV export for a prediction. Returns (csv_bytes, filename)."""
    ctx = _resolve_context(prediction, db)
    company_name = ctx["company_name"]
    period = ctx["period"]
    slug = _slugify(company_name)
    filename = _build_filename(slug, period, prediction.id, "csv")
    ratios = _get_ratios(prediction)
    shap = _get_shap(prediction)
    prob_pct = round(prediction.distress_probability * 100, 2)
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    model_label = (
        "Random Forest"
        if prediction.model_used == "random_forest"
        else "Logistic Regression"
    )

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["# SECTION 1: ASSESSMENT METADATA"])
    writer.writerow(["Field", "Value"])
    writer.writerow(["Company Name", company_name])
    writer.writerow(["Reporting Period", period])
    writer.writerow(["ML Model", model_label])
    writer.writerow(["Risk Classification", prediction.risk_label])
    writer.writerow(["Distress Probability (%)", prob_pct])
    writer.writerow(["Prediction ID", prediction.id])
    writer.writerow(["Generated At (UTC)", generated_at])
    writer.writerow([])

    writer.writerow(["# SECTION 2: FINANCIAL RATIO ANALYSIS"])
    writer.writerow(
        ["Ratio", "Actual Value", "Healthy Benchmark", "Direction", "Status"]
    )
    for key, meta in RATIO_META.items():
        val = ratios.get(key, 0.0)
        ok = _ratio_ok(val, meta)
        direction = (
            f">= {meta['bench']}" if meta["dir"] == "min" else f"<= {meta['bench']}"
        )
        writer.writerow(
            [
                meta["label"],
                f"{val:.4f}",
                f"{meta['bench']:.4f}",
                direction,
                "Pass" if ok else "Fail",
            ]
        )
    writer.writerow([])

    writer.writerow(["# SECTION 3: SHAP FEATURE ATTRIBUTIONS"])
    writer.writerow(["Feature", "SHAP Value", "Direction", "Absolute Magnitude"])
    if shap:
        sorted_shap = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)
        for feature, val in sorted_shap:
            meta = RATIO_META.get(feature, {})
            label = meta.get("label", feature)
            direction = (
                "Increases Distress Risk" if val > 0 else "Reduces Distress Risk"
            )
            writer.writerow([label, f"{val:+.6f}", direction, f"{abs(val):.6f}"])
    else:
        writer.writerow(["SHAP values not available", "", "", ""])
    writer.writerow([])

    writer.writerow(["# SECTION 4: FINANCIAL HEALTH NARRATIVE"])
    writer.writerow(
        [
            "Source",
            prediction.narrative.source.capitalize() if prediction.narrative else "N/A",
        ]
    )
    writer.writerow(
        ["Narrative", prediction.narrative.content if prediction.narrative else ""]
    )
    writer.writerow([])

    writer.writerow(["# DISCLAIMER"])
    writer.writerow(
        [
            "This CSV export is generated by an automated ML system for informational purposes only. "
            "It does not constitute financial advice. FinWatch Zambia accepts no liability for decisions "
            "made on the basis of this data."
        ]
    )

    csv_bytes = buf.getvalue().encode("utf-8-sig")  # UTF-8 BOM for Excel compatibility
    logger.info("CSV report generated in memory: %s", filename)
    return csv_bytes, filename




def generate_zip_bundle(
    prediction: "Prediction",
    db: "Session",
) -> tuple[bytes, str]:
    """Generate a ZIP bundle containing both the PDF and CSV reports. Returns (zip_bytes, filename)."""
    ctx = _resolve_context(prediction, db)
    company_name = ctx["company_name"]
    period = ctx["period"]
    slug = _slugify(company_name)
    zip_filename = _build_filename(slug, period, prediction.id, "zip")

    pdf_path, pdf_filename = generate_pdf_report(prediction, db)
    pdf_bytes = Path(pdf_path).read_bytes()

    csv_bytes, csv_filename = generate_csv_report(prediction, db)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(pdf_filename, pdf_bytes)
        zf.writestr(csv_filename, csv_bytes)

    logger.info(
        "ZIP bundle generated: %s (%s + %s)", zip_filename, pdf_filename, csv_filename
    )
    return buf.getvalue(), zip_filename
