"""FinWatch Zambia - NLP Narrative + Chat Service

Narrative and chat text generation.

Public interfaces:
- `generate_narrative`: grounded prediction narrative (async).
- `generate_chat_response`: chat responses for the portal chat feature (async).
- `RATIO_DISPLAY_NAMES`: Re-exported from ratio_engine.
- `RATIO_BENCHMARKS_DISPLAY`: Re-exported from ratio_engine.

Provider selection uses a simplified fallback chain (Groq -> Template).
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone

from groq import AsyncGroq

from app.core.config import settings
from app.services.ratio_engine import RATIO_BENCHMARKS_DISPLAY, RATIO_DISPLAY_NAMES

logger = logging.getLogger(__name__)


def build_small_scale_prompt(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    period: str | None = None,
) -> str:
    """Build a plain-language prompt for small-scale businesses."""
    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]

    # Mapping to plain language
    plain_names = {
        "current_ratio": "your ability to pay bills this month",
        "quick_ratio": "your immediate cash safety net",
        "cash_ratio": "cash available for urgent payments",
        "debt_to_equity": "how much of your business is funded by borrowed money",
        "debt_to_assets": "the portion of your assets tied to debt",
        "interest_coverage": "your ability to pay interest on loans",
        "net_profit_margin": "how much profit you keep from every sale",
        "return_on_assets": "how well your equipment and property generate profit",
        "return_on_equity": "the return on your own investment",
        "asset_turnover": "how quickly you turn stock into sales",
    }

    evidence = "\n".join(
        [
            f"- {plain_names.get(k, k)}: {'increases' if v > 0 else 'decreases'} risk (Impact: {abs(v):.2f})"
            for k, v in top_shap
        ]
    )

    return f"""You are a trusted business advisor for a small Zambian business owner (e.g., a shop or stall owner).
Your task is to explain their financial health assessment in simple, plain English.

=== DATA ===
Period: {period or "unspecified"}
Status: {risk_label}
Risk Score: {distress_probability:.1%}

=== KEY FINDINGS ===
{evidence}

=== REQUIREMENTS ===
1. NO TECHNICAL JARGON. Never use terms like 'ratio', 'EBIT', 'margin', or specific financial metrics by name.
2. MAX 3 FINDINGS. Focus only on the most important drivers.
3. STRUCTURE: Use a table or clear sections for findings. Follow this for every point: What is happening -> Why it matters (Zambian example) -> Action.
4. VARIETY: Use numbered lists (1, 2, 3) for importance, lettered lists (a, b) for details, or bullets for general points.
5. ZAMBIAN CONTEXT: Reference Kwacha, supplier credit, mobile money, or local trading patterns.
6. TONE: Supportive, knowledgeable, and practical.

Generate the advice now. Begin directly:"""


def build_medium_scale_prompt(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    benchmarks: dict[str, str],
    period: str | None = None,
) -> str:
    """Build a technical, detailed prompt for established businesses."""
    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
    shap_lines = "\n".join(
        [
            f"- {RATIO_DISPLAY_NAMES.get(k, k)}: {v:+.4f} (Actual: {ratios.get(k, 0):.3f}, Benchmark: {benchmarks.get(k, 'N/A')})"
            for k, v in top_shap
        ]
    )

    return f"""You are a financial analyst providing a report for an established Zambian business with formal records.
Your task is to produce a rigorous, technical assessment of their financial health.

=== DATA ===
Period: {period or "unspecified"}
Status: {risk_label}
Probability: {distress_probability:.1%}

=== FEATURE ATTRIBUTIONS (SHAP) ===
{shap_lines}

=== REQUIREMENTS ===
1. Use standard financial terminology. Provide a brief definition on first use if complex.
2. Explain the SHAP attributions. Use a table to compare actual ratios against benchmarks for the most impactful drivers.
3. Reference the benchmarks provided.
4. Produce a prioritised recommendation list ranked by urgency (use numbered lists 1, 2, 3).
5. Use varied formatting: lettered lists for sub-details, and clear headings.
6. Reference formal concepts: cash flow management, debt service coverage, or working capital optimisation.
7. TONE: Professional, analytical, and authoritative.

Generate the technical narrative now. Begin directly:"""


ASSISTANT_GUARDRAILS = """
=== FINWATCH SYSTEM KNOWLEDGE ===
1. CREATOR: Created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).
2. TRAINING DATA: Trained using the "UCI Polish Companies Bankruptcy Dataset" (Zieba, Tomczak & Tomczak, 2016). File: '3year.arff'.
   - Records: 10,503 companies (10,008 healthy, 495 distressed).
   - Features: 64 total (FinWatch uses 10). Imbalance ratio: 20.22:1.
3. SELECTED RATIOS (10): Grounded in Altman (1968), Beaver (1966), and Ohlson (1980).
   - Current, Quick, Cash, Debt-to-Equity (inverted Attr8), Debt-to-Assets, Interest Coverage, Net Profit Margin, ROA, ROE (Derived), Asset Turnover.
4. ML PIPELINE: Stratified 80/20 train-test split. Median imputation for missing values. Outlier clipping (1st-99th). SMOTE applied ONLY to training data. StandardScaler fitted ONLY on training data.
5. MODELS: Random Forest (captures complex/nonlinear patterns) and Logistic Regression (interpretable/transparent). RANDOM_STATE=42.
6. ZAMBIA CONTEXT: "World Bank Zambia Enterprise Survey 2019-2020" was used ONLY for contextual validation (confirming local pressures like credit access and load shedding).
   - IT WAS NEVER USED for training, fine-tuning, evaluation, or accuracy validation.
7. DOMAIN SHIFT: Model weights learned entirely from Polish data. System is a Design Science Research (DSR) proof-of-concept.
   - Survey validation does not close the domain gap. Future work requires retraining on local labelled SME data.
8. PRIVACY: SME data is private. Regulator portal uses anonymised aggregate data and protects identifiable company info.
9. SCOPE: Only assist with FinWatch predictions, ratios, models, reports, and how to use the system through the system guidance and tutorial.
   - For unrelated questions, say: "I can only assist with FinWatch system functionality, financial distress predictions, ratio interpretation, report explanations, and related platform guidance."
"""

SME_USAGE_GUIDANCE = """
=== SME SYSTEM USAGE STEPS ===
1. Register or complete your SME profile on the 'Companies' page.
2. Go to the 'Predictions' page, select your desired company profile, and enter the required financial data (balance sheet and income statement figures for a specific financial period).
3. Choose between the Random Forest or Logistic Regression machine learning model and run the prediction to get your results.
4. View your prediction results and optionally export them in PDF or CSV formats.

For any further queries, you can access the guided tutorial on the System Overview panel through the system overview icon on the top right.
"""

GUIDED_TUTORIAL_INFO = """
=== GUIDED TUTORIAL ===
- Access the guided tutorial from the system overview fly-out panel by clicking the system info icon in the top right of the screen.
"""


def build_chat_system_prompt(predictions_context: str) -> str:
    """Build the system prompt for the chat assistant."""
    return f"""You are FinWatch AI, an expert financial and business advisor embedded in FinWatch Zambia — \
an ML-based financial distress prediction system for Zambian SMEs.

{ASSISTANT_GUARDRAILS}

{SME_USAGE_GUIDANCE}

{GUIDED_TUTORIAL_INFO}

BEHAVIOUR RULES:
1. ADVISOR FIRST: Prioritise answering the user's actual question with professional and practical insights. Focus entirely on the subject matter (business, financial, or statistical advice).
2. EXTREME CONCISENESS: Keep all responses short, relevant, and straight to the point. Avoid conversational filler, preambles, or redundant polite phrases. For non-analytical queries, aim for under 60 words.
3. TOPICAL DEPTH: You may provide detailed, thorough explanations ONLY when:
   - Explaining a specific prediction result or SHAP driver.
   - Providing professional financial/business advice based on the data.
   - Explaining ML concepts (Random Forest, Logistic Regression, SHAP).
   - Explaining specific financial ratios used in the system.
4. CONCISE USAGE: If the user asks how to use the system, provide ONLY the 4 steps in 'SME SYSTEM USAGE STEPS' as a numbered list with the mandatory closing sentence.
5. NO SPECULATION: Do not describe non-existent features or speculative functionality.
6. NO MIXED RESPONSES: If a response is about financial health, it MUST NOT mention the guided tutorial.
7. NO TRUNCATION: Always provide naturally ending, complete responses.
8. ACTIONABLE RECOMMENDATIONS: Provide direct, action-oriented advice tailored to the user's context.
9. STRUCTURED FORMATTING: Use Markdown (**bold**, *italics*, ### headings).
10. CLEAN STRUCTURE: Use tables for comparing multiple financial metrics or periods. Use varied list types:
    - Numbered lists (1, 2, 3) for sequential steps or ranked importance.
    - Lettered lists (a, b, c) for sub-points.
    - Bullets (• or -) for general points.
    Use a NEW LINE for every list item.
11. AUTHORSHIP: Directly answer who created you (David Lameck and Denise Seti).
12. NO HALLUCINATIONS: Never claim Zambian data was used for model training.

=== USER'S PREDICTION DATA ===
{predictions_context}
=== END OF DATA ===

If the context is empty, professionally inform the user that no assessments have been run yet and advice will be more specific once they complete a prediction."""


# Public Aliases
build_prompt = build_medium_scale_prompt


async def _call_groq(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """Call the Groq API for text generation (async)."""
    target_api_key = api_key or settings.GROQ_API_KEY
    target_model = model or settings.GROQ_MODEL

    if not target_api_key:
        raise ValueError("Groq API key not set")

    client = AsyncGroq(api_key=target_api_key)

    if system_prompt is not None:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-10:])
        messages.append({"role": "user", "content": prompt})
    else:
        messages = [{"role": "user", "content": prompt}]

    response = await client.chat.completions.create(
        model=target_model,
        messages=messages,
        temperature=settings.NLP_TEMPERATURE,
        max_tokens=settings.NLP_MAX_TOKENS,
    )
    return response.choices[0].message.content.strip()


def _is_valid_key(key: str) -> bool:
    """Check if a key is provided and is not a placeholder."""
    k = key.strip()
    return bool(k) and k.lower() not in ("unset", "set", "your_api_key", "replace_me")


async def run_fallback_chain(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    log_prefix: str = "NLP",
    override_api_key: str | None = None,
    override_model: str | None = None,
) -> tuple[str, str]:
    """Core fallback orchestration logic (async). Returns (content, source)."""

    # Use provided override or default from settings
    groq_key = override_api_key or settings.GROQ_API_KEY
    groq_model = override_model or settings.GROQ_MODEL

    if _is_valid_key(groq_key):
        try:
            logger.info(
                "%s: Attempting via Groq (model: %s)...", log_prefix, groq_model
            )
            content = await _call_groq(
                prompt, system_prompt, history, api_key=groq_key, model=groq_model
            )
            logger.info("%s: Groq succeeded", log_prefix)
            return content, "groq"
        except Exception as exc:
            logger.warning("%s: Groq failed — %s", log_prefix, exc)

    raise RuntimeError("Primary AI provider (Groq) failed or API key missing")


async def generate_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    model_used: str = "random_forest",
    period: str | None = None,
    business_scale: str = "medium_scale",
) -> tuple[str, str]:
    """Generate a financial health narrative using the fallback chain (async)."""
    if business_scale == "small_scale":
        prompt = build_small_scale_prompt(
            risk_label, distress_probability, shap_values, ratios, period
        )
    else:
        prompt = build_medium_scale_prompt(
            risk_label,
            distress_probability,
            shap_values,
            ratios,
            RATIO_BENCHMARKS_DISPLAY,
            period,
        )

    try:
        return await run_fallback_chain(prompt, log_prefix="Narrative")
    except Exception:
        logger.info("Narrative: falling back to template engine")
        return (
            _call_template_narrative(
                risk_label,
                distress_probability,
                shap_values,
                ratios,
                period,
                business_scale,
            ),
            "template",
        )


async def generate_chat_response(
    system_prompt: str,
    history: list[dict],
    message: str,
) -> tuple[str, str]:
    """Generate a chat response using the fallback chain (async)."""
    try:
        return await run_fallback_chain(
            message, system_prompt=system_prompt, history=history, log_prefix="Chat"
        )
    except Exception:
        logger.info("Chat: falling back to template engine")
        return _call_template_chat(message), "template"


async def generate_docs_chat_response(
    system_prompt: str,
    history: list[dict],
    message: str,
) -> tuple[str, str]:
    """Generate a documentation-specific chat response (async)."""
    try:
        # Use the dedicated DOCS_GROQ_API_KEY
        return await run_fallback_chain(
            message,
            system_prompt=system_prompt,
            history=history,
            log_prefix="DocsChat",
            override_api_key=settings.DOCS_GROQ_API_KEY,
        )
    except Exception:
        logger.info("DocsChat: falling back to template engine")
        return _call_template_docs_chat(message), "template"


async def generate_institutional_summary(data: dict, role: str) -> tuple[str, str]:
    """Generate a high-level institutional summary of SME sector health (async)."""
    slug = "Policy Analyst" if role == "policy_analyst" else "Regulator"

    # Extract key metrics for prompt
    overview = data.get("overview", {})
    sectors = data.get("sectors", [])[:3]  # Top 3 sectors
    scales = data.get("scales", [])

    sector_info = "\n".join(
        [
            f"- {s['industry']}: {s['avg_prob'] * 100:.1f}% avg distress rate ({s['total']} assessments)"
            for s in sectors
        ]
    )
    scale_info = "\n".join(
        [
            f"- {s['scale']}: {s['avg_prob'] * 100:.1f}% avg distress rate"
            for s in scales
        ]
    )

    prompt = f"""You are a senior economic policy advisor providing a strategic summary for a {slug} in Zambia.
Based on the following aggregate SME data, synthesize a professional executive summary.

=== AGGREGATE DATA ===
Total Assessments: {overview.get("total_assessments")}
Systemic Distress Probability: {overview.get("avg_distress_prob", 0) * 100:.1f}%
Top Sectors by Activity:
{sector_info}
Business Scale Performance:
{scale_info}

=== REQUIREMENTS ===
1. TONE: Professional, objective, and authoritative.
2. STRUCTURE: Use two sections: "Current Systemic Health" and "Strategic Observations".
3. FORMATTING: Use Markdown (**bold**, bullets).
4. CONTEXT: Reference Zambian SME resilience, sectoral pressures, or policy implications.
5. CONCISENESS: Max 350 words.

Begin the summary now:"""

    try:
        return await run_fallback_chain(prompt, log_prefix="InstSummary")
    except Exception:
        logger.info("InstSummary: falling back to template engine")
        return _call_template_institutional_summary(data, role), "template"


def _call_template_institutional_summary(data: dict, role: str) -> str:
    """Fallback template engine for institutional summaries."""
    overview = data.get("overview", {})
    avg_prob = overview.get("avg_distress_prob", 0) * 100
    total = overview.get("total_assessments", 0)

    status = "Elevated" if avg_prob > 40 else "Moderate" if avg_prob > 20 else "Stable"

    return f"""### Current Systemic Health
The national SME sector currently exhibits a **{status}** systemic distress profile, with an average probability of **{avg_prob:.1f}%** across **{total}** verified assessments.

### Strategic Observations
*   **Sectoral Concentration:** Performance varies significantly by industry, suggesting localized economic pressures.
*   **Scale Variance:** Discrepancies between small and medium-scale enterprises indicate the need for tiered policy interventions.
*   **Oversight Readiness:** Data coverage is sufficient for high-level monitoring, but continued reporting is required to identify emerging temporal trends."""


def _call_template_docs_chat(message: str) -> str:
    """Fallback template engine for documentation-specific questions."""
    q = message.lower()
    if any(
        k in q
        for k in [
            "who created",
            "who developed",
            "who designed",
            "who built",
            "authors",
            "who made",
        ]
    ):
        return (
            "FinWatch was created by **David Lameck** and **Denise Seti**, as part of their **BSc Computer Science** "
            "dissertation research project at **Cavendish University Zambia** in 2026."
        )
    if "finwatch" in q and len(q) < 20:
        return (
            "**FinWatch Zambia** is an ML-based financial distress prediction system designed specifically for Zambian SMEs. "
            "It combines financial ratio analysis with Explainable AI (SHAP) to provide early-warning signals and actionable health narratives."
        )
    if any(k in q for k in ["getting started", "how to start", "first prediction"]):
        return (
            "To get started with FinWatch Zambia:\n"
            "1. Create an account and log in.\n"
            "2. Set up your company profile in the **Companies** section.\n"
            "3. Go to **Predictions** and enter your financial data.\n"
            "4. Run the assessment to see your risk score and narrative."
        )
    if any(k in q for k in ["ratio", "financial concept", "meaning", "explain"]):
        return (
            "FinWatch uses several financial ratios to assess business health, including Liquidity (Current/Quick ratios), "
            "Leverage (Debt-to-Equity), and Profitability (Net Margin, ROA). You can find detailed explanations of each "
            "in the **Financial Concepts** section of the documentation."
        )
    if any(
        k in q for k in ["risk score", "distressed", "healthy", "what does it mean"]
    ):
        return (
            "A **Distressed** classification means the system has identified patterns similar to businesses that faced "
            "financial failure. **Healthy** means your indicators are within safe ranges. Check the **Understanding Results** "
            "section for a deep dive into risk scores and SHAP charts."
        )
    if any(k in q for k in ["privacy", "data", "security", "who can see"]):
        return (
            "Your data is private and secured. Only you can see your specific company data and predictions. "
            "Regulators only see aggregate, anonymized sector trends. See **Account and Privacy** for more details."
        )
    if any(
        k in q
        for k in ["prediction", "my score", "my result", "my assessment", "my ratio"]
    ):
        return (
            "I do not have access to your personal assessment data or specific company results. "
            "Please use the **Dashboard AI Assistant** (available on the Overview and Predictions pages) for questions about your specific financial data and predictions."
        )

    return (
        "I can only help with questions about FinWatch Zambia and the concepts it uses. "
        "For other questions, please consult an appropriate professional."
    )


def _call_template_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    period: str | None = None,
    business_scale: str = "medium_scale",
) -> str:
    """Generate a narrative using the template engine (fallback)."""
    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now(timezone.utc).year:
                is_past = True

    tense_verb = "was" if is_past else "is"
    tense_phrase = "during the assessed period" if is_past else "currently"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    risk_pct = f"{distress_probability:.1%}"

    if business_scale == "small_scale":
        # Plain language template
        plain_names = {
            "current_ratio": "ability to pay bills",
            "quick_ratio": "cash safety net",
            "cash_ratio": "cash on hand",
            "debt_to_equity": "borrowed money",
            "debt_to_assets": "assets tied to debt",
            "interest_coverage": "loan interest payments",
            "net_profit_margin": "profit from sales",
            "return_on_assets": "profit from equipment",
            "return_on_equity": "return on investment",
            "asset_turnover": "sales speed",
        }

        if risk_label == "Distressed":
            status = f"### Financial Assessment: INDICATIVE RISK\n\nBased on your answers for **{period or 'the assessed period'}**, your business {tense_verb} identified as being at risk with a probability of **{risk_pct}**."
        else:
            status = f"### Financial Assessment: INDICATIVE HEALTHY\n\nYour business {tense_verb} assessed as healthy with a distress probability of **{risk_pct}**."

        drivers = []
        for name, val in top_shap:
            display = plain_names.get(name, name)
            direction = "increasing" if val > 0 else "reducing"
            drivers.append(f"• Your **{display}** is {direction} your business risk.")

        recommendation = (
            "\n\n### What to do now\n**Take action this week.** Review your expenses and ensure you are tracking all cash coming in and going out."
            if risk_label == "Distressed"
            else "\n\n### What to do now\n**Keep going.** Continue monitoring your cash and sales to stay healthy."
        )
    else:
        # Technical template
        if risk_label == "Distressed":
            status = f"### Financial Assessment: DISTRESSED\n\nBased on the data for **{period or 'the assessed period'}**, this business is classified as **FINANCIALLY DISTRESSED** with a distress probability of **{risk_pct}**."
        else:
            status = f"### Financial Assessment: HEALTHY\n\nThis business is currently assessed as **FINANCIALLY HEALTHY** with a distress probability of **{risk_pct}**."

        drivers = []
        for name, val in top_shap:
            display = RATIO_DISPLAY_NAMES.get(name, name)
            actual = ratios.get(name)
            benchmark = RATIO_BENCHMARKS_DISPLAY.get(name, "N/A")
            direction = "increasing" if val > 0 else "reducing"
            actual_str = f"{actual:.3f}" if actual is not None else "N/A"
            drivers.append(
                f"• **{display}**: {actual_str} (Benchmark: {benchmark}) — {direction} distress probability by {abs(val):.4f} units."
            )

        recommendation = (
            "\n\n### Recommendation\n**Immediate attention is recommended.** Consider reviewing cash flow, liabilities, and revenue to mitigate risk."
            if risk_label == "Distressed"
            else "\n\n### Recommendation\n**Continue monitoring** these indicators regularly to maintain financial health."
        )

    return f"{status}\n\n{'\n'.join(drivers)}{recommendation}"


def _call_template_chat(message: str) -> str:
    """Generate a chat response using the template engine (fallback)."""
    q = message.lower()
    if any(
        k in q
        for k in [
            "who created",
            "who developed",
            "who designed",
            "who built",
            "authors",
            "who made",
        ]
    ):
        return (
            "FinWatch was created by **David Lameck** and **Denise Seti**, as part of their **BSc Computer Science** "
            "dissertation research project at **Cavendish University Zambia** in 2026."
        )
    if any(k in q for k in ["how to use", "guide", "steps", "usage", "help"]):
        return (
            "1. Register or complete your SME profile on the **Companies** page.\n"
            "2. Go to the **Predictions** page, select your desired company profile, and enter the required financial data (balance sheet and income statement figures for a specific financial period).\n"
            "3. Choose between the **Random Forest** or **Logistic Regression** machine learning model and run the prediction to get your results.\n"
            "4. View your prediction results and optionally export them in **PDF** or **CSV** formats.\n\n"
            "For any further queries, you can access the guided tutorial on the System Overview panel through the system overview icon on the top right."
        )
    if any(k in q for k in ["dataset", "data", "train", "learned from"]):
        return (
            "### Training Dataset\n\nFinWatch was trained on the **UCI Polish Companies Bankruptcy Dataset** (Zieba et al., 2016). "
            "The **World Bank Zambia Enterprise Survey** was used only for contextual validation and "
            "was never used to train or fine-tune the machine learning models."
        )
    if "zambia" in q:
        return (
            "### Zambia Context\n\nFinWatch is a **proof-of-concept system** developed for the Zambian context. While trained on "
            "Polish data, its relevance to Zambia was validated using World Bank survey data. It is a "
            "**Design Science Research (DSR)** artefact designed to bridge the SME credit gap."
        )
    if any(k in q for k in ["current ratio", "liquidity", "cash ratio", "quick ratio"]):
        return (
            "### Liquidity Ratios\n\nLiquidity ratios measure your ability to meet short-term obligations. "
            "• **Current Ratio**: Compares current assets to current liabilities. Values below 1.0 signal potential cash flow problems.\n"
            "• **Quick Ratio**: Excludes inventory for a stricter view.\n\n"
            "For Zambian SMEs, a current ratio above **1.5** is generally considered healthy."
        )
    if any(k in q for k in ["distress", "probability", "risk", "score", "prediction"]):
        return (
            "### Prediction Metrics\n\nThe **distress probability** is the model's confidence (0-100%) that a business is heading "
            "toward financial difficulty. Values above **50%** indicate elevated risk. FinWatch uses **Random Forest** "
            "and **Logistic Regression** for these assessments."
        )
    if "shap" in q:
        return (
            "### SHAP Explanations\n\n**SHAP (SHapley Additive exPlanations)** quantifies each ratio's contribution to the prediction. "
            "• **Positive SHAP**: The ratio pushes the business toward a **Distressed** classification.\n"
            "• **Negative SHAP**: The ratio pulls the business toward a **Healthy** classification.\n\n"
            "The magnitude shows how strongly each ratio influenced the result."
        )
    if any(k in q for k in ["debt", "leverage", "equity"]):
        return (
            "### Leverage Ratios\n\nLeverage ratios measure how much of your business is debt-financed. "
            "• **Debt-to-Equity**: Values above **2.0** are warning signs.\n"
            "• **Debt-to-Assets**: Values above **0.6** are red flags in FinWatch.\n\n"
            "High leverage increases financial fragility, especially combined with low profitability."
        )
    if any(k in q for k in ["interest", "coverage", "ebit"]):
        return (
            "### Interest Coverage\n\n**Interest Coverage** (EBIT divided by Interest Expense) shows how many times earnings cover interest payments. "
            "Values below **2.0** are a red flag — a large portion of earnings goes to interest, leaving little buffer if revenues drop."
        )
    if any(k in q for k in ["profit", "margin", "roa", "roe", "return"]):
        return (
            "### Profitability Ratios\n\nProfitability ratios show how efficiently your business converts revenue into profit. "
            "• **Net Margin**: Thresholds below **5%** indicate concern.\n"
            "• **ROA**: Below **2%** is a warning sign.\n"
            "• **ROE**: Below **5%** is a concern in FinWatch.\n\n"
            "Negative values indicate a loss-making business, significantly elevating distress risk."
        )
    return (
        "I can only help with questions about FinWatch Zambia and the concepts it uses. "
        "For other questions, please consult an appropriate professional."
    )


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """Compute a hash for narrative caching based on ratios and model."""
    canonical = json.dumps({"ratios": ratios, "model": model_used}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
