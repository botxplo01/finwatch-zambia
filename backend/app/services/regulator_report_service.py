"""
FinWatch Zambia - Regulator Report Service

Generates comprehensive aggregate institutional reports including:
- System-wide KPIs
- Sector-wise performance
- Temporal distress trends
- Anonymised anomaly flags (high-risk)

Modern minimalist aesthetic matching the SME portal standard.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from sqlalchemy import func, case

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

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
            "RTitle", fontSize=22, fontName="Helvetica-Bold", textColor=GREY_DARK,
            leading=28, spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "RSection", fontSize=12, fontName="Helvetica-Bold", textColor=TEAL,
            spaceBefore=18, spaceAfter=8, textTransform="uppercase",
        ),
        "body": ParagraphStyle(
            "RBody", fontSize=9.5, fontName="Helvetica", textColor=GREY_DARK, leading=15,
        ),
        "small": ParagraphStyle(
            "RSmall", fontSize=8, fontName="Helvetica", textColor=GREY_MID, leading=11,
        ),
        "centered": ParagraphStyle(
            "RCentered", fontSize=10, fontName="Helvetica-Bold", textColor=GREY_DARK, 
            leading=15, alignment=1,
        ),
        "disclaimer": ParagraphStyle(
            "RDisclaimer", fontSize=7.5, fontName="Helvetica-Oblique", textColor=GREY_MID,
            leading=12, alignment=1,
        ),
    }

# --- Data Collection ---

def _collect_all_data(db: Session, role: str = "regulator") -> dict:
    """Fetch comprehensive aggregate data from the database with role-based filtering."""
    from app.models.company import Company
    from app.models.prediction import Prediction
    from app.models.financial_record import FinancialRecord
    from app.models.ratio_feature import RatioFeature

    total_assessments = db.query(func.count(Prediction.id)).scalar() or 0
    total_smes = db.query(func.count(Company.id)).scalar() or 0
    all_probs = [r[0] for r in db.query(Prediction.distress_probability).all()]
    avg_prob = sum(all_probs) / len(all_probs) if all_probs else 0.0

    sector_results = (
        db.query(
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label("distressed"),
            func.avg(Prediction.distress_probability).label("avg_prob")
        )
        .select_from(Company)
        .join(FinancialRecord).join(RatioFeature).join(Prediction)
        .group_by(Company.industry).all()
    )
    sectors = [{"industry": i or "Unspecified", "total": t, "distressed": int(d or 0), "avg_prob": float(ap or 0)} 
               for i, t, d, ap in sector_results]
    sectors.sort(key=lambda x: x["total"], reverse=True)

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    dialect = db.bind.dialect.name
    month_label = func.to_char(Prediction.predicted_at, "YYYY-MM") if dialect == "postgresql" else func.strftime("%Y-%m", Prediction.predicted_at)
    
    trend_results = (
        db.query(
            month_label.label("month"),
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label("distressed")
        )
        .filter(Prediction.predicted_at >= cutoff)
        .group_by("month").order_by("month").all()
    )
    trends = [{"month": m, "total": t, "rate": (d / t) if t > 0 else 0} for m, t, d in trend_results]

    # Role-based filtering: Policy Analysts cannot see anomaly IDs/flags
    anomalies = []
    if role == "regulator":
        anomaly_results = (
            db.query(
                Prediction.id, Company.industry, Prediction.distress_probability, Prediction.risk_label
            )
            .select_from(Prediction)
            .join(RatioFeature).join(FinancialRecord).join(Company)
            .filter(Prediction.distress_probability >= 0.7)
            .order_by(Prediction.distress_probability.desc()).limit(15).all()
        )
        anomalies = [{"id": pid, "industry": ind or "Unspecified", "prob": prob, "label": label} for pid, ind, prob, label in anomaly_results]

    return {
        "overview": {"total_assessments": total_assessments, "total_smes": total_smes, "avg_distress_prob": avg_prob},
        "sectors": sectors, "trends": trends, "anomalies": anomalies,
        "generated_at": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    }

# --- PDF Composition ---

def _header_footer(canvas, doc, user_time: str | None = None, role: str = "regulator"):
    """Institutional regulator header with modern minimal style."""
    canvas.saveState()
    w, h = A4
    
    # Theme color based on role
    ACCENT = colors.HexColor("#2563eb") if role == "policy_analyst" else TEAL
    PORTAL_NAME = "Analyst Portal" if role == "policy_analyst" else "Regulator Portal"

    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(2)
    canvas.line(MARGIN, h - MARGIN + 4 * mm, w - MARGIN, h - MARGIN + 4 * mm)
    
    canvas.setFont("Helvetica-Bold", 10)
    canvas.setFillColor(ACCENT)
    canvas.drawString(MARGIN, h - MARGIN + 6 * mm, f"FinWatch Zambia — {PORTAL_NAME}")
    
    if user_time:
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY_MID)
        canvas.drawRightString(w - MARGIN, h - MARGIN + 6 * mm, f"Generated: {user_time}")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(w/2, MARGIN - 10 * mm, f"Page {doc.page}  ·  Institutional Aggregate Analysis")
    canvas.restoreState()

def generate_regulator_pdf(db: Session, user_time: str | None = None, role: str = "regulator") -> tuple[bytes, str]:
    """Generate a detailed institutional aggregate PDF report with modern styling."""
    data = _collect_all_data(db, role=role)
    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
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
    report_title = "Strategic Policy Insight Report" if role == "policy_analyst" else "System-Wide Aggregate Performance Report"
    story.append(Paragraph(report_title, styles["title"]))
    meta_style = ParagraphStyle("RMeta", parent=styles["body"], fontSize=10, leading=14)
    story.append(Paragraph("<b>Scope:</b> All Registered Zambian SME Sectors", meta_style))
    story.append(Paragraph(f"<b>Data Coverage:</b> {data['overview']['total_assessments']} Individual Assessments", meta_style))
    
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.5 * cm))

    # 2. KPI Summary (Modern Box - Centered & Rounded)
    story.append(Paragraph("1. Institutional Key Performance Indicators", styles["section"]))
    stats_data = [
        ["Metric", "Current Value"],
        [Paragraph("Total Registered SME Profiles", styles["centered"]), str(data["overview"]["total_smes"])],
        [Paragraph("Average Distress Probability", styles["centered"]), f"{data['overview']['avg_distress_prob']*100:.2f}%"],
        [Paragraph("Active Sector Coverage", styles["centered"]), str(len(data["sectors"]))]
    ]
    st = Table(stats_data, colWidths=[PAGE_W*0.4, PAGE_W*0.3])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
        ('TEXTCOLOR', (0,0), (-1,0), ACCENT_BASE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    story.append(st); story.append(Spacer(1, 1 * cm))

    # 3. Sector Performance
    story.append(Paragraph("2. Sector-Wise Performance Analysis", styles["section"]))
    if data["sectors"]:
        sector_rows = [["Industry Sector", "Total SMEs", "Distressed", "Avg Prob."]]
        for s in data["sectors"]:
            sector_rows.append([s["industry"], str(s["total"]), Paragraph(f'<b><font color="#dc2626">{s["distressed"]}</font></b>', styles["body"]), f"{s['avg_prob']*100:.1f}%"])
        sect_t = Table(sector_rows, colWidths=[(PAGE_W - 2*MARGIN)*w for w in [0.4, 0.2, 0.2, 0.2]])
        sect_t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
            ('TEXTCOLOR', (0,0), (-1,0), ACCENT_BASE),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
            ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER),
            ('LINEBELOW', (0,0), (-1,0), 1.5, ACCENT_BASE),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(sect_t)
    else:
        story.append(Paragraph("No sectoral data currently available.", styles["body"]))
    
    story.append(PageBreak())

    # 4. Temporal Trends
    story.append(Paragraph("3. Monthly Distress Trends (Last 12 Months)", styles["section"]))
    if data["trends"]:
        trend_rows = [["Reporting Month", "Total Assessments", "Distress Rate (%)"]]
        for t in data["trends"]:
            trend_rows.append([t["month"], str(t["total"]), f"{t['rate']*100:.1f}%"])
        trend_t = Table(trend_rows, colWidths=[(PAGE_W - 2*MARGIN)*w for w in [0.4, 0.3, 0.3]])
        trend_t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
            ('TEXTCOLOR', (0,0), (-1,0), ACCENT_BASE),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
            ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER),
            ('LINEBELOW', (0,0), (-1,0), 1.5, ACCENT_BASE),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(trend_t)
    else:
        story.append(Paragraph("Insufficient historical data to generate temporal trends.", styles["body"]))
    story.append(Spacer(1, 1 * cm))

    # 5. Anomaly Flags - ONLY for full regulators
    if role == "regulator":
        story.append(Paragraph("4. Anonymised High-Risk Anomaly Flags", styles["section"]))
        if data["anomalies"]:
            anom_rows = [["Reference ID", "Industry Sector", "Distress Prob.", "Risk Status"]]
            for a in data["anomalies"]:
                anom_rows.append([f"REF-{a['id']}", a["industry"], f"{a['prob']*100:.1f}%", Paragraph(f'<b><font color="#dc2626">{a["label"].upper()}</font></b>', styles["body"])])
            anom_t = Table(anom_rows, colWidths=[(PAGE_W - 2*MARGIN)*w for w in [0.25, 0.3, 0.2, 0.25]])
            anom_t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
                ('TEXTCOLOR', (0,0), (-1,0), ACCENT_BASE),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
                ('BOX', (0,0), (-1,-1), 0.5, BORDER),
                ('LINEBELOW', (0,0), (-1,0), 1.5, ACCENT_BASE),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(anom_t)
            story.append(Spacer(1, 0.5 * cm))
            story.append(Paragraph("<i>Note: High-risk flags are triggered at distress probabilities exceeding 70%.</i>", styles["small"]))
        else:
            story.append(Paragraph("No significant high-risk anomalies currently flagged.", styles["body"]))

    # Final Notice
    story.append(Spacer(1, 2 * cm))
    notice = "<b>CONFIDENTIALITY NOTICE:</b> This report contains anonymised aggregate data for academic research and authorised institutional oversight only. Public distribution is strictly prohibited."
    story.append(Paragraph(notice, styles["disclaimer"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN+0.4*cm, bottomMargin=MARGIN+0.5*cm)
    doc.build(story, onFirstPage=lambda c, d: _header_footer(c, d, user_time, role), onLaterPages=lambda c, d: _header_footer(c, d, user_time, role))
    return buf.getvalue(), filename

def generate_regulator_csv(db: Session, role: str = "regulator") -> tuple[bytes, str]:
    """Generate detailed system-wide aggregate CSV."""
    data = _collect_all_data(db, role=role)
    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    output = io.StringIO(); writer = csv.writer(output)
    report_title = "FINWATCH STRATEGIC POLICY INSIGHT REPORT" if role == "policy_analyst" else "FINWATCH REGULATOR AGGREGATE REPORT"
    writer.writerow([report_title])
    writer.writerow(["Generated At", data["generated_at"]]); writer.writerow([])
    writer.writerow(["# SECTION 1: KEY PERFORMANCE INDICATORS"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Assessments", data["overview"]["total_assessments"]])
    writer.writerow(["Total Registered SMEs", data["overview"]["total_smes"]])
    writer.writerow(["Avg Distress Prob (%)", f"{data['overview']['avg_distress_prob']*100:.2f}"]); writer.writerow([])
    writer.writerow(["# SECTION 2: SECTOR-WISE PERFORMANCE"])
    if data["sectors"]:
        writer.writerow(["Industry", "Total Assessments", "Distressed Count", "Avg Prob (%)"])
        for s in data["sectors"]: writer.writerow([s["industry"], s["total"], s["distressed"], f"{s['avg_prob']*100:.2f}"])
    else: writer.writerow(["No sectoral data available"])
    writer.writerow(["# SECTION 3: MONTHLY DISTRESS TRENDS"])
    if data["trends"]:
        writer.writerow(["Month", "Total Monthly Assessments", "Distress Rate (%)"])
        for t in data["trends"]:
            writer.writerow([t["month"], t["total"], f"{t['rate']*100:.2f}"])
    else:
        writer.writerow(["Insufficient historical data to generate temporal trends"])
    writer.writerow([])

    if role == "regulator":
        writer.writerow(["# SECTION 4: HIGH-RISK ANOMALY FLAGS"])
        if data["anomalies"]:
            writer.writerow(["Reference ID", "Industry Sector", "Distress Prob (%)", "Risk Status"])
            for a in data["anomalies"]:
                writer.writerow([f"REF-{a['id']}", a["industry"], f"{a['prob']*100:.2f}", a["label"]])
        else:
            writer.writerow(["No significant high-risk anomalies currently flagged"])

    return output.getvalue().encode("utf-8-sig"), filename

def generate_regulator_json(db: Session, role: str = "regulator") -> tuple[bytes, str]:
    """Generate detailed system-wide aggregate JSON."""
    data = _collect_all_data(db, role=role)
    slug = "analyst" if role == "policy_analyst" else "regulator"
    filename = f"finwatch_{slug}_aggregate_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
    return json.dumps(data, indent=2).encode("utf-8"), filename

def generate_regulator_zip(db: Session, user_time: str | None = None, role: str = "regulator") -> tuple[bytes, str]:
    """Bundle all detailed aggregate formats into a ZIP."""
    pdf_bytes, pdf_name = generate_regulator_pdf(db, user_time=user_time, role=role)
    csv_bytes, csv_name = generate_regulator_csv(db, role=role)
    json_bytes, json_name = generate_regulator_json(db, role=role)
    zip_buf = io.BytesIO()
    slug = "analyst" if role == "policy_analyst" else "regulator"
    with zipfile.ZipFile(zip_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(pdf_name, pdf_bytes); zf.writestr(csv_name, csv_bytes); zf.writestr(json_name, json_bytes)
    return zip_buf.getvalue(), f"finwatch_{slug}_bundle_{datetime.now(timezone.utc).strftime('%Y%m%d')}.zip"
