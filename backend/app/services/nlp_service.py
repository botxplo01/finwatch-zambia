"""FinWatch Zambia - NLP Narrative + Chat Service

Narrative and chat text generation.

Public interfaces:
- `generate_narrative`: grounded prediction narrative (async).
- `generate_chat_response`: chat responses for the portal chat feature (async).

Provider selection uses a simplified fallback chain (Groq -> Template).
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import asyncio
from datetime import datetime
from typing import Any, Callable

from groq import AsyncGroq

from app.core.config import settings
from app.services.ratio_engine import RATIO_BENCHMARKS_DISPLAY, RATIO_DISPLAY_NAMES

logger = logging.getLogger(__name__)


def build_narrative_prompt(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    benchmarks: dict[str, str],
    period: str | None = None,
) -> str:
    """Build the prompt for generating a financial health narrative."""
    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now().year:
                is_past = True

    tense_verb = "was" if is_past else "is"
    tense_phrase = "in the assessed period" if is_past else "currently"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
    shap_lines = "\n".join(
        [
            f"  - {name}: {val:+.4f} ({'increases' if val > 0 else 'decreases'} distress probability)"
            for name, val in top_shap
        ]
    )
    ratio_lines = "\n".join(
        [
            f"  - {name}: Actual = {ratios.get(name, 0.0):.3f}, "
            f"Healthy Benchmark = {benchmarks.get(name, 'N/A')}"
            for name, _ in top_shap
            if name in ratios
        ]
    )
    return f"""You are a financial health report generator named FinWatch AI for an SME early-warning system called FinWatch Zambia.

Your task is to produce a precise, factual financial health narrative using ONLY the data provided below.
The reporting period for this assessment is {period or "unspecified"}.
Note: The business {tense_verb} assessed {tense_phrase}. Use appropriate tenses in your response.

Do not introduce any claims not supported by the data. Do not give generic financial advice.
Always reference the specific numbers provided.
Write in clear, plain English suitable for a small business owner who is not a financial expert.
Length: between 180 and 220 words.

=== PREDICTION DATA ===
Risk Classification: {risk_label}
Distress Probability: {distress_probability:.1%}

=== TOP SHAP FEATURE ATTRIBUTIONS (model decision evidence) ===
{shap_lines}

=== FINANCIAL RATIOS (Actual Values vs Healthy Benchmarks) ===
{ratio_lines}

Generate the financial health narrative now. Begin directly — no headings, labels, or preamble:"""


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
10. CLEAN LISTS: Use only numbers, bullets •, or dashes -. Use a NEW LINE for every list item.
11. AUTHORSHIP: Directly answer who created you (David Lameck and Denise Seti).
12. NO HALLUCINATIONS: Never claim Zambian data was used for model training.

=== USER'S PREDICTION DATA ===
{predictions_context}
=== END OF DATA ===

If the context is empty, professionally inform the user that no assessments have been run yet and advice will be more specific once they complete a prediction."""


build_prompt = build_narrative_prompt


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
            content = await _call_groq(prompt, system_prompt, history, api_key=groq_key, model=groq_model)
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
) -> tuple[str, str]:
    """Generate a financial health narrative using the fallback chain (async)."""
    prompt = build_narrative_prompt(
        risk_label=risk_label,
        distress_probability=distress_probability,
        shap_values=shap_values,
        ratios=ratios,
        benchmarks=RATIO_BENCHMARKS_DISPLAY,
        period=period,
    )

    try:
        return await run_fallback_chain(prompt, log_prefix="Narrative")
    except Exception:
        logger.info("Narrative: falling back to template engine")
        return _call_template_narrative(
            risk_label, distress_probability, shap_values, ratios, period
        ), "template"


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


def _call_template_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    period: str | None = None,
) -> str:
    """Generate a narrative using the template engine (fallback)."""
    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now().year:
                is_past = True

    tense_verb = "was" if is_past else "is"
    tense_phrase = "during the assessed period" if is_past else "currently"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    risk_pct = f"{distress_probability:.1%}"

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
        "I can only assist with FinWatch system functionality, financial distress predictions, "
        "ratio interpretation, report explanations, and related platform guidance. "
        "For more specific advice, please ensure you have completed a prediction assessment."
    )


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """Compute a hash for narrative caching based on ratios and model."""
    canonical = json.dumps({"ratios": ratios, "model": model_used}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
