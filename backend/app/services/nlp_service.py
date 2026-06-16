"""FinWatch Zambia - NLP Narrative + Chat Service

Narrative and chat text generation.

Public interfaces:
- `generate_narrative`: grounded prediction narrative (async).
- `generate_chat_response`: chat responses for the portal chat feature (async).
- `RATIO_DISPLAY_NAMES`: Re-exported from ratio_engine.
- `RATIO_BENCHMARKS_DISPLAY`: Re-exported from ratio_engine.

Provider selection uses a triple-tier fallback chain (Groq Proxy -> OpenRouter -> Template).
"""

from __future__ import annotations

import asyncio
import hashlib
import httpx
import json
import logging
import re
from datetime import datetime, timezone

from groq import AsyncGroq
from openai import AsyncOpenAI

from app.core.business_rules import requires_full_assessment
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
9. CONVERSATIONAL INTERACTIONS — Handle naturally and warmly:
   - Greetings (hello, hi, good morning, good afternoon, good evening): Respond with a warm, brief, professional greeting. Introduce yourself as FinWatch AI.
   - Polite exchanges (how are you, thank you, thanks, have a good day): Respond naturally and briefly. Do not refuse or redirect to platform features.
   - Farewells (goodbye, see you, take care): Respond warmly and wish the user well.
   - These are normal human interactions. Respond like a professional assistant would, not like a FAQ bot.
10. SCOPE — What you may assist with:
    a. ALWAYS answer: FinWatch system usage, predictions, ratios, reports, SHAP explanations, risk scores, platform navigation.
    b. ALWAYS answer: Educational questions about AI, machine learning, data science, statistics, predictive analytics, classification, regression, Random Forests, Logistic Regression, SHAP, XAI — these are the core technologies of the platform.
    c. ALWAYS answer: Financial concepts — liquidity, leverage, profitability, working capital, debt management, cash flow, financial distress, bankruptcy prediction, financial ratios, risk assessment. These are the domain of the platform.
    d. ALWAYS answer: General business analytics, KPIs, financial ratios, and how they relate to SME management.
    e. ALWAYS answer: Questions about the creators, the dataset, the methodology, and the academic research context.
    f. DO NOT blend categories unnecessarily: If the user asks a general educational question (e.g., "What is Machine Learning?"), answer it as a general concept first. Only connect it to FinWatch if the user specifically asks.
    g. POLITELY DECLINE only: Topics completely unrelated to finance, business, analytics, or technology — e.g. home repairs, sports scores, recipes, entertainment, politics, or personal matters unrelated to business.
       For these say: "That's a bit outside my area — I'm focused on financial health, business analytics, and the FinWatch platform. For that topic, a general resource would serve you better."
11. INTENT CLASSIFICATION — Before responding to any message, silently
    classify the user's intent into one of three paths:

    PATH A — Clearly understood and in scope:
      The user's intent is clear and relates to finance, business,
      analytics, AI, machine learning, financial distress, FinWatch
      features, or the platform's domain.
      → Answer directly and completely.

    PATH B — Ambiguous but plausibly related:
      The message contains terminology, references, or concepts that
      could plausibly relate to the platform's domain or the user's
      financial data, but the intent is not specific enough to answer
      confidently. This includes vague references ("the risk thing",
      "my dashboard", "that analysis"), incomplete questions, or
      messages that use one or two relevant words without context.
      → Ask exactly ONE specific, focused clarifying question.
      → Never ask more than one question in a single response.
      → If the user's follow-up is still unclear, answer using your
         best interpretation of their intent and state the assumption
         you made. Do not ask for clarification a second time.
      → Frame the clarifying question warmly, not as an interrogation.
         Example: "Are you asking about your most recent risk score,
         or would you like me to explain how the risk score is
         calculated?"

    PATH C — Clearly outside scope:
      The message has no plausible connection to finance, business,
      analytics, AI, or the FinWatch platform. Mundane, personal, or
      completely unrelated topics fall here.
      → Use the polite decline from Rule 10g.

    Decision heuristic: When in doubt between PATH B and PATH C,
    always choose PATH B. Asking a clarifying question is almost
    always better than a false refusal. Only choose PATH C when you
    are highly confident the request has no connection to the platform's
    domain.
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


def build_chat_system_prompt(
    predictions_context: str,
    business_scale: str = "medium_scale",
    user_role: str = "sme_owner",
) -> str:
    """Build the system prompt for the chat assistant."""
    scale_label = (
        "Small Scale (Growing Business)"
        if business_scale == "small_scale"
        else "Medium Scale (Established Business)"
    )

    if business_scale == "small_scale":
        scale_rules = "- Use PLAIN LANGUAGE. Avoid technical jargon. Explain concepts with everyday examples relevant to a small Zambian business owner. Reference Kwacha, suppliers, and mobile money where helpful. Keep explanations practical and action-oriented."
    else:
        scale_rules = "- Use TECHNICAL LANGUAGE appropriate for an established business with formal records. Include financial terminology, reference benchmarks, and provide detailed analytical reasoning. Assume familiarity with standard business concepts."

    return f"""You are FinWatch AI, an expert financial and business advisor embedded in FinWatch Zambia — \
an ML-based financial distress prediction system for Zambian SMEs.

{ASSISTANT_GUARDRAILS}

{SME_USAGE_GUIDANCE}

{GUIDED_TUTORIAL_INFO}

BEHAVIOUR RULES:
1. ADVISOR FIRST: Prioritise answering the user's actual question with professional and practical insights. Focus entirely on the subject matter (business, financial, or statistical advice).
2. RESPONSE DEPTH: Calibrate depth to the question type.
   - Simple factual or definitional questions: concise, under 80 words.
   - Educational questions (AI, ML, financial concepts): as much depth as the question warrants — do not truncate a useful explanation.
   - Analytical questions (prediction results, SHAP, ratio interpretation, trends): full detail and context required.
   - How-to usage questions: the 4 steps only, no more.
   Never pad responses. Never truncate useful information.
3. TOPICAL DEPTH: Provide thorough, detailed explanations when:
   - The user asks about a specific prediction result, SHAP driver, or risk score.
   - The user requests financial or business advice based on their data.
   - The user asks about AI, ML, or data science concepts.
   - The user asks about financial ratios, financial health, or business analytics.
   Depth should match the complexity of the question — never truncate a useful explanation.
   Never interpret this rule as a restriction — it is guidance on when to be thorough.
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
13. CONVERSATION CONTINUITY: You are in an active conversation with history.
    - Always read and consider the full conversation history before responding.
    - Pronouns and vague references ("it", "that", "those", "which ones",
      "the above", "the first one", "the previous explanation") always refer
      to topics visible in the conversation history — resolve them from context.
      Never ask the user to repeat information that is already in the history.
    - If the user asks "make that simpler", "put that in a table",
      "give examples", or "summarize that", they are referring to your
      immediately preceding response. Provide that continuation directly.
    - If the user asks a comparative question like "which of the two is better",
      identify "the two" from the conversation history and compare them.
    - NEVER treat each message as isolated. NEVER claim you do not have context
      that is visible in the conversation history.

=== USER CONTEXT ===
Portal Role: {user_role}
Business Scale: {scale_label}

SCALE-ADAPTIVE RESPONSE RULES:
{scale_rules}

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

    # Extra sanitization for production env vars (remove whitespace and literal quotes)
    sanitized_key = target_api_key.strip().strip('"').strip("'")

    # Ensure base_url doesn't result in doubling (SDK appends /openai/v1/chat/completions)
    # If the user provided a URL ending in /openai/v1, we strip it so the SDK adds it back correctly.
    base_url = settings.GROQ_BASE_URL.rstrip("/")
    if base_url.endswith("/openai/v1"):
        base_url = base_url[:-10].rstrip("/")

    # ── Client Configuration ──────────────────────────────────────────
    # In RENDER mode (production), we use a hardened proxy-bypass config.
    # Locally, we use a standard client to ensure maximum compatibility.
    if settings.RENDER:
        client_kwargs = {
            "api_key": sanitized_key,
            "base_url": base_url,
            "http_client": httpx.AsyncClient(
                trust_env=False,  # Bypass Render's shared outbound proxies
                headers={"User-Agent": "FinWatch-Zambia/1.0"},
                timeout=20.0,
            ),
        }
    else:
        # Local development: allow direct connection and standard environment settings.
        # Only use base_url if it's explicitly non-default.
        client_kwargs = {
            "api_key": sanitized_key,
            "timeout": 20.0,
        }
        if "api.groq.com" not in base_url:
            client_kwargs["base_url"] = base_url

    async with AsyncGroq(**client_kwargs) as client:
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


async def _call_openrouter(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """
    Call OpenRouter API for text generation (async).
    OpenRouter uses the OpenAI-compatible API and routes to the same
    llama-3.1-8b-instruct model via Render-friendly infrastructure.
    Used when Groq is blocked by cloud provider IP policy (HTTP 403).
    """
    target_api_key = api_key or settings.OPENROUTER_API_KEY
    target_model = model or settings.OPENROUTER_MODEL

    if not target_api_key:
        raise ValueError("OpenRouter API key not set")

    client = AsyncOpenAI(
        api_key=target_api_key.strip().strip('"').strip("'"),
        base_url=settings.OPENROUTER_BASE_URL,
        timeout=20.0,
        default_headers={
            "HTTP-Referer": "https://finwatch-zambia.vercel.app",
            "X-Title": "FinWatch Zambia",
        },
    )

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


def _is_valid_key(key: str | None) -> bool:
    """Check if a key is provided and is not a placeholder or 'None' string."""
    if key is None:
        return False
    k = str(key).strip()
    # Catch common placeholders and Render-specific 'None' strings
    placeholders = (
        "unset",
        "set",
        "your_api_key",
        "replace_me",
        "none",
        "null",
        "undefined",
        "",
    )
    return bool(k) and k.lower() not in placeholders


async def run_fallback_chain(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    log_prefix: str = "NLP",
    override_api_key: str | None = None,
    override_model: str | None = None,
) -> tuple[str, str]:
    """
    Core fallback orchestration logic (async). Returns (content, source).

    Provider order:
      1. Groq — primary (direct API, blocked on some cloud IPs)
      2. OpenRouter — secondary (same model, Render-compatible)
      3. Raises RuntimeError → caller falls back to template engine
    """
    # ── 1. Groq (primary) ─────────────────────────────────────────────
    groq_key = (
        override_api_key
        if _is_valid_key(override_api_key)
        else settings.GROQ_API_KEY
    )
    groq_model = override_model or settings.GROQ_MODEL

    if _is_valid_key(groq_key):
        # Diagnostic: Show masked key to verify propagation
        masked_key = f"{groq_key[:6]}...{groq_key[-2:]}" if len(groq_key) > 8 else "***"
        logger.warning("%s: Using Groq key %s", log_prefix, masked_key)

        for attempt in range(2):
            try:
                logger.info(
                    "%s: Attempting via Groq (model: %s, attempt %d/2)...",
                    log_prefix,
                    groq_model,
                    attempt + 1,
                )
                content = await _call_groq(
                    prompt,
                    system_prompt,
                    history,
                    api_key=groq_key,
                    model=groq_model,
                )
                logger.info(
                    "%s: Groq succeeded (attempt %d/2)", log_prefix, attempt + 1
                )
                return content, "groq"
            except Exception as exc:
                exc_type = type(exc).__name__
                status_code = getattr(exc, "status_code", None)
                logger.warning(
                    "%s: Groq attempt %d/2 failed — type=%s status=%s message=%s",
                    log_prefix,
                    attempt + 1,
                    exc_type,
                    status_code,
                    str(exc),
                )
                if attempt == 0:
                    await asyncio.sleep(1.0)
    else:
        logger.warning("%s: No valid Groq API key — skipping Groq.", log_prefix)

    # ── 2. OpenRouter (fallback — Render-compatible infrastructure) ────
    openrouter_key = settings.OPENROUTER_API_KEY
    openrouter_model = settings.OPENROUTER_MODEL

    if _is_valid_key(openrouter_key):
        try:
            logger.info(
                "%s: Groq unavailable. Attempting via OpenRouter (model: %s)...",
                log_prefix,
                openrouter_model,
            )
            content = await _call_openrouter(
                prompt,
                system_prompt,
                history,
                api_key=openrouter_key,
                model=openrouter_model,
            )
            logger.info("%s: OpenRouter succeeded.", log_prefix)
            return content, "openrouter"  # Dedicated source for frontend observability
        except Exception as exc:
            logger.warning("%s: OpenRouter failed — %s", log_prefix, exc, exc_info=True)
    else:
        logger.warning(
            "%s: No valid OpenRouter API key — skipping OpenRouter.", log_prefix
        )

    # ── 3. Both providers failed ───────────────────────────────────────
    raise RuntimeError(
        "All AI providers failed or have no valid API keys. "
        "Groq: 403 IP block on Render. "
        "OpenRouter: check OPENROUTER_API_KEY on Render dashboard."
    )


async def generate_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    model_used: str = "random_forest",
    period: str | None = None,
    business_scale: str = "medium_scale",
    industry: str | None = None,
) -> tuple[str, str]:
    """Generate a financial health narrative using the fallback chain (async)."""
    # Hybrid Methodology Rule: Force technical prompt for regulated sectors
    is_full = requires_full_assessment(business_scale, industry)

    if not is_full:
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
    except Exception as exc:
        logger.error("Narrative generation failed, falling back: %s", exc, exc_info=True)
        return (
            _call_template_narrative(
                risk_label,
                distress_probability,
                shap_values,
                ratios,
                period,
                business_scale,
                industry,
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
    except Exception as exc:
        logger.error("Portal chat generation failed, falling back: %s", exc, exc_info=True)
        return _call_template_chat(message, history=history), "template"


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
    except Exception as exc:
        logger.error("Docs chat generation failed, falling back: %s", exc, exc_info=True)
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
    except Exception as exc:
        logger.error("Institutional summary generation failed, falling back: %s", exc, exc_info=True)
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
    """Fallback template engine for documentation-specific questions.

    Applies a five-tier intent classification:
      1. Conversational interactions (greetings, farewells, polite exchanges)
      2. General educational questions (AI, ML, data science, financial concepts)
      3. Platform-specific questions (FinWatch features, ratios, predictions)
      4. Authorship / dataset / methodology questions
      5. Out-of-scope decline (genuinely unrelated topics)
    """
    q = message.lower().strip()

    # Tier 1: Conversational interactions
    _greetings = [
        "hello",
        "hi",
        "hey",
        "hiya",
        "howdy",
        "good morning",
        "good afternoon",
        "good evening",
        "good day",
    ]
    if any(q == g or q.startswith(g) for g in _greetings):
        return (
            "Hello! I'm the **FinWatch Documentation Assistant**. I can help you navigate the guides, "
            "explain platform features, and answer questions about financial concepts and AI. "
            "What would you like to know?"
        )

    _thanks = ["thank", "thanks", "thank you", "cheers", "appreciate"]
    if any(k in q for k in _thanks):
        return "You're welcome! Feel free to ask if you need any more help with the documentation."

    _farewells = [
        "goodbye",
        "bye",
        "see you",
        "see ya",
        "take care",
        "have a good",
        "have a great",
        "farewell",
    ]
    if any(k in q for k in _farewells):
        return "Goodbye! Come back anytime if you need help with the FinWatch documentation."

    _how_are_you = ["how are you", "how are u", "how do you do"]
    if any(k in q for k in _how_are_you):
        return "I'm ready to help! What would you like to know about FinWatch or its features?"

    # Tier 2: General educational questions (AI / ML / data science / finance)
    _ai_general = [
        "what is ai",
        "what is artificial intelligence",
        "define ai",
        "explain ai",
    ]
    if any(k in q for k in _ai_general):
        return (
            "**Artificial Intelligence (AI)** refers to the ability of computer systems to perform tasks "
            "that would normally require human intelligence — recognising patterns, learning from data, "
            "and making decisions. FinWatch uses AI in its core prediction engine to assess financial "
            "distress risk for Zambian SMEs."
        )

    _ml_general = [
        "what is machine learning",
        "what is ml",
        "define machine learning",
        "explain machine learning",
        "how does machine learning work",
    ]
    if any(k in q for k in _ml_general):
        return (
            "**Machine Learning (ML)** is a branch of AI where systems learn patterns from data rather "
            "than following explicit rules. FinWatch uses two ML models:\n"
            "- **Random Forest**: Captures complex patterns via an ensemble of decision trees.\n"
            "- **Logistic Regression**: An interpretable model that estimates distress probability from financial ratios."
        )

    _predictive = ["predictive analytics", "what is predictive", "prediction analytics"]
    if any(k in q for k in _predictive):
        return (
            "**Predictive analytics** uses historical data and machine learning to forecast future outcomes. "
            "FinWatch applies this to financial ratios to estimate the probability that an SME may face "
            "financial distress."
        )

    _classification = [
        "what is classification",
        "binary classification",
        "what is a classifier",
    ]
    if any(k in q for k in _classification):
        return (
            "**Classification** assigns inputs to predefined categories. FinWatch performs **binary "
            "classification** — labelling a business as **Healthy** or **Distressed** based on its "
            "financial ratios, with a probability score (0–100%) indicating confidence."
        )

    _fin_ratio_general = ["what is a financial ratio", "what are financial ratios"]
    if any(k in q for k in _fin_ratio_general):
        return (
            "**Financial ratios** are values derived from financial statements used to evaluate a company's "
            "health. FinWatch uses 10 ratios across three groups:\n"
            "- **Liquidity** (Current, Quick, Cash Ratio)\n"
            "- **Leverage** (Debt-to-Equity, Debt-to-Assets, Interest Coverage)\n"
            "- **Profitability** (Net Margin, ROA, ROE, Asset Turnover)"
        )

    _risk_assessment_general = ["what is risk assessment", "risk assessment"]
    if any(k in q for k in _risk_assessment_general):
        return (
            "**Risk assessment** is the systematic evaluation of threats to a business's financial stability. "
            "FinWatch automates this by computing 10 financial ratios and running them through a trained "
            "ML model to produce a distress probability score."
        )

    # Tier 4: Authorship / platform identity
    _authorship = [
        "who created",
        "who developed",
        "who designed",
        "who built",
        "authors",
        "who made",
    ]
    if any(k in q for k in _authorship):
        return (
            "FinWatch was created by **David Lameck** and **Denise Seti**, as part of their **BSc Computer Science** "
            "dissertation research project at **Cavendish University Zambia** in 2026."
        )

    if "finwatch" in q and len(q) < 20:
        return (
            "**FinWatch Zambia** is an ML-based financial distress prediction system designed specifically for Zambian SMEs. "
            "It combines financial ratio analysis with Explainable AI (SHAP) to provide early-warning signals and actionable health narratives."
        )

    if any(
        k in q
        for k in ["getting started", "how to start", "first prediction", "how to use"]
    ):
        return (
            "To get started with FinWatch Zambia:\n"
            "1. Create an account and log in.\n"
            "2. Set up your company profile in the **Companies** section.\n"
            "3. Go to **Predictions** and enter your financial data.\n"
            "4. Run the assessment to see your risk score and narrative."
        )

    if any(k in q for k in ["ratio", "financial concept", "meaning", "explain ratio"]):
        return (
            "FinWatch uses several financial ratios to assess business health, including Liquidity (Current/Quick ratios), "
            "Leverage (Debt-to-Equity), and Profitability (Net Margin, ROA). Find detailed explanations of each "
            "in the **Financial Concepts** section of the documentation."
        )

    if any(
        k in q for k in ["risk score", "distressed", "healthy", "what does it mean"]
    ):
        return (
            "A **Distressed** classification means the system has identified patterns similar to businesses that faced "
            "financial failure. **Healthy** means your indicators are within safe ranges. Check **Understanding Results** "
            "in the docs for a deep dive into risk scores and SHAP charts."
        )

    if any(k in q for k in ["privacy", "data", "security", "who can see"]):
        return (
            "Your data is private and secured. Only you can see your company data and predictions. "
            "Regulators only see aggregate, anonymized sector trends. See **Account and Privacy** for details."
        )

    if any(
        k in q
        for k in ["prediction", "my score", "my result", "my assessment", "my ratio"]
    ):
        return (
            "I don't have access to your personal assessment data or specific company results. "
            "Please use the **Dashboard AI Assistant** (available on the Overview and Predictions pages) "
            "for questions about your specific financial data."
        )

    # Tier 5: Out-of-scope decline (friendly and narrow)
    return (
        "That's a bit outside my documentation focus. I'm here to help you navigate FinWatch features, "
        "understand financial concepts, and learn about AI and analytics. "
        "For that topic, a general-purpose resource would serve you better."
    )


def _call_template_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    period: str | None = None,
    business_scale: str = "medium_scale",
    industry: str | None = None,
) -> str:
    """Generate a narrative using the template engine (fallback)."""
    # Hybrid Methodology Rule: Determine title and detail level
    is_full = requires_full_assessment(business_scale, industry)

    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now(timezone.utc).year:
                is_past = True

    tense_verb = "was" if is_past else "is"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    risk_pct = f"{distress_probability:.1%}"

    if not is_full:
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


def _call_template_chat(
    message: str,
    history: list[dict] | None = None,
) -> str:
    """Generate a chat response using the template engine (fallback).

    Applies a five-tier intent classification:
      1. Conversational interactions (greetings, farewells, polite exchanges)
      2. Educational questions (AI, ML, data science, financial concepts)
      3. Platform-specific questions (FinWatch features, ratios, predictions)
      4. Authorship / dataset / methodology questions
      5. Out-of-scope decline (genuinely unrelated topics)
    """
    q = message.lower().strip()

    # Tier 1: Conversational interactions
    _greetings = [
        "hello",
        "hi",
        "hey",
        "hiya",
        "howdy",
        "good morning",
        "good afternoon",
        "good evening",
        "good day",
    ]
    if any(q == g or q.startswith(g) for g in _greetings):
        return (
            "Hello! I'm **FinWatch AI**, your financial health advisor. "
            "I can help you understand your prediction results, explain financial ratios, "
            "walk you through the platform, or answer questions about financial concepts and AI. "
            "What can I help you with today?"
        )

    _thanks = ["thank", "thanks", "thank you", "cheers", "appreciate"]
    if any(k in q for k in _thanks):
        return (
            "You're welcome! Feel free to ask anything else about your financial assessments "
            "or how FinWatch works — I'm here to help."
        )

    _farewells = [
        "goodbye",
        "bye",
        "see you",
        "see ya",
        "take care",
        "have a good",
        "have a great",
        "farewell",
    ]
    if any(k in q for k in _farewells):
        return (
            "Goodbye! Take care, and don't hesitate to return if you have questions "
            "about your financial health or the platform. All the best!"
        )

    _how_are_you = ["how are you", "how are u", "how do you do", "you okay", "you good"]
    if any(k in q for k in _how_are_you):
        return (
            "I'm doing well, thank you for asking! Ready to help you with your financial "
            "assessments, ratio explanations, or anything else related to FinWatch. "
            "What's on your mind?"
        )

    # ── Context-dependent follow-up detection ────────────────────────────────
    # Detect messages that reference a prior turn rather than asking something new.
    _followup_phrases = [
        "make that simpler", "simplify that", "explain that again",
        "put that in a table", "in a table", "as a table",
        "give examples", "show examples", "give me examples",
        "summarize that", "summarise that", "summarize it",
        "which ones are", "which of those", "which one is",
        "more detail", "more details", "expand on that", "tell me more",
        "what you just said", "the above", "the previous explanation",
        "can you clarify", "clarify that", "what does that mean",
    ]
    _bare_context_refs = ["it", "that", "those", "them", "they", "these"]

    _is_followup = (
        any(phrase in q for phrase in _followup_phrases)
        or (len(q.split()) <= 3 and any(q == ref or q.startswith(ref + " ") for ref in _bare_context_refs))
    )

    if _is_followup:
        # Extract the last assistant message to infer the active topic
        last_assistant_content = ""
        if history:
            for msg in reversed(history):
                if msg.get("role") == "assistant":
                    last_assistant_content = msg.get("content", "").lower()
                    break

        if last_assistant_content:
            # Topic inference from last response keywords
            if any(k in last_assistant_content for k in ["liquidity", "current ratio", "quick ratio", "cash ratio"]):
                inferred = "liquidity ratios"
            elif any(k in last_assistant_content for k in ["leverage", "debt-to-equity", "debt to equity", "debt-to-assets"]):
                inferred = "leverage ratios"
            elif any(k in last_assistant_content for k in ["profitability", "net profit margin", "return on assets", "return on equity"]):
                inferred = "profitability ratios"
            elif any(k in last_assistant_content for k in ["financial ratio", "ratio"]):
                inferred = "financial ratios"
            elif any(k in last_assistant_content for k in ["machine learning", "random forest", "logistic regression"]):
                inferred = "machine learning"
            elif any(k in last_assistant_content for k in ["shap", "explainab"]):
                inferred = "SHAP explanations"
            elif any(k in last_assistant_content for k in ["distress", "risk score", "probability"]):
                inferred = "financial distress risk"
            else:
                inferred = None

            if inferred:
                return (
                    f"I can continue on **{inferred}** — could you be a bit more specific? "
                    f"For example: *'Explain {inferred} in simpler terms'* or *'Give examples of {inferred}'*. "
                    f"That helps me give you the most useful answer."
                )

        # Generic follow-up fallback — no history context available
        return (
            "I'd love to continue — could you briefly mention the topic you're referring to? "
            "For example: *'Explain liquidity ratios in simpler terms'* or "
            "*'Summarize the machine learning explanation'*. "
            "That helps me give you the most accurate follow-up."
        )

    # Tier 2: General educational questions (AI / ML / data science / finance)
    _ai_general = [
        "what is ai",
        "what is artificial intelligence",
        "define ai",
        "explain ai",
    ]
    if any(k in q for k in _ai_general):
        return (
            "### Artificial Intelligence\n\n"
            "**Artificial Intelligence (AI)** refers to the ability of computer systems to perform tasks that "
            "would normally require human intelligence — such as understanding language, recognising patterns, "
            "making decisions, and learning from data.\n\n"
            "AI is a broad field that includes sub-disciplines like **Machine Learning**, **Natural Language "
            "Processing**, and **Computer Vision**. FinWatch Zambia uses AI in its core prediction engine "
            "to assess financial distress risk for SMEs."
        )

    _ml_general = [
        "what is machine learning",
        "what is ml",
        "define machine learning",
        "explain machine learning",
        "how does machine learning work",
    ]
    if any(k in q for k in _ml_general):
        return (
            "### Machine Learning\n\n"
            "**Machine Learning (ML)** is a branch of Artificial Intelligence where systems learn patterns "
            "from data rather than being programmed with explicit rules.\n\n"
            "A machine learning model is trained on historical examples and then uses what it learned "
            "to make predictions on new, unseen data.\n\n"
            "**FinWatch uses two ML models:**\n"
            "- **Random Forest**: An ensemble of decision trees that captures complex, non-linear patterns.\n"
            "- **Logistic Regression**: A transparent, interpretable model that estimates the probability "
            "of financial distress based on financial ratios."
        )

    _ml_model = [
        "what is a model",
        "what is an ml model",
        "what is a machine learning model",
        "ml model",
    ]
    if any(k in q for k in _ml_model):
        return (
            "### Machine Learning Model\n\n"
            "A **machine learning model** is a mathematical function trained on data to make predictions. "
            "During training, the model learns patterns — for example, which financial ratios tend to "
            "appear in distressed businesses.\n\n"
            "Once trained, the model can take new financial figures and output a probability "
            "estimate of financial distress. FinWatch uses **Random Forest** and **Logistic Regression** "
            "as its prediction models."
        )

    _predictive = ["predictive analytics", "what is predictive", "prediction analytics"]
    if any(k in q for k in _predictive):
        return (
            "### Predictive Analytics\n\n"
            "**Predictive analytics** uses historical data, statistical algorithms, and machine learning "
            "to forecast future outcomes.\n\n"
            "FinWatch applies predictive analytics to financial ratios — using patterns from thousands "
            "of past business records to estimate the probability that an SME may face financial "
            "distress in the near future."
        )

    _classification = [
        "what is classification",
        "what is a classifier",
        "binary classification",
    ]
    if any(k in q for k in _classification):
        return (
            "### Classification in Machine Learning\n\n"
            "**Classification** is a type of machine learning task where the goal is to assign an input "
            "to one of a set of predefined categories.\n\n"
            "FinWatch performs **binary classification** — it classifies a business as either "
            "**Healthy** or **Distressed** based on its financial ratios. The model outputs a "
            "probability score (0–100%) reflecting its confidence in the distressed outcome."
        )

    _regression = ["what is regression", "logistic regression", "linear regression"]
    if any(k in q for k in _regression):
        return (
            "### Regression in Machine Learning\n\n"
            "**Regression** predicts a continuous numerical value, while **Logistic Regression** — "
            "despite its name — is used for classification. It estimates the *probability* that an "
            "observation belongs to a particular class.\n\n"
            "FinWatch uses **Logistic Regression** as one of its two prediction models. It is "
            "valued for its transparency: the model's coefficients directly show how each financial "
            "ratio influences the distress probability."
        )

    _data_analysis = ["what is data analysis", "data analytics", "what is analytics"]
    if any(k in q for k in _data_analysis):
        return (
            "### Data Analysis\n\n"
            "**Data analysis** is the process of inspecting, cleaning, transforming, and modelling data "
            "to discover useful information and support decision-making.\n\n"
            "FinWatch performs data analysis on financial ratios — computing key metrics from raw "
            "financial figures and comparing them against benchmarks to identify risk patterns."
        )

    _risk_assessment = ["what is risk assessment", "risk assessment", "financial risk"]
    if any(k in q for k in _risk_assessment):
        return (
            "### Risk Assessment\n\n"
            "**Risk assessment** is the systematic evaluation of potential threats to a business's "
            "financial stability.\n\n"
            "FinWatch performs automated risk assessment by computing 10 financial ratios from "
            "your balance sheet and income statement, then running them through a trained machine "
            "learning model to produce a **distress probability score** and a **risk classification** "
            "(Healthy, Elevated, or Distressed)."
        )

    # Handle bare "ratio" / "ratios" queries — infer financial context
    _bare_ratio_triggers = ("ratio", "ratios")
    _ratio_question_starters = (
        "what are ratio",
        "what is ratio",
        "what is a ratio",
        "explain ratio",
        "define ratio",
    )
    if q in _bare_ratio_triggers or any(q.startswith(s) for s in _ratio_question_starters):
        return (
            "If you mean **financial ratios**, these are numerical values derived from a "
            "company's financial statements used to measure its performance, health, and stability.\n\n"
            "FinWatch uses **10 key ratios** across three categories:\n"
            "- **Liquidity** (Current Ratio, Quick Ratio, Cash Ratio): "
            "Can the business meet short-term obligations?\n"
            "- **Leverage** (Debt-to-Equity, Debt-to-Assets, Interest Coverage): "
            "How much debt does the business carry?\n"
            "- **Profitability & Activity** (Net Profit Margin, ROA, ROE, Asset Turnover): "
            "Is the business generating returns?\n\n"
            "Each ratio is compared against a benchmark to determine whether it is contributing "
            "to or reducing financial distress risk. Would you like me to explain any specific "
            "ratio or category in more detail?"
        )

    _fin_ratio_general = [
        "what is a financial ratio",
        "what are financial ratios",
        "financial ratio",
    ]
    if any(k in q for k in _fin_ratio_general):
        return (
            "### Financial Ratios\n\n"
            "**Financial ratios** are numerical values derived from a company's financial statements "
            "that are used to evaluate its performance, health, and stability.\n\n"
            "FinWatch uses **10 key ratios** grouped into three categories:\n"
            "- **Liquidity** (Current Ratio, Quick Ratio, Cash Ratio): Can the business meet short-term obligations?\n"
            "- **Leverage** (Debt-to-Equity, Debt-to-Assets, Interest Coverage): How much debt does the business carry?\n"
            "- **Profitability** (Net Profit Margin, ROA, ROE, Asset Turnover): Is the business generating returns?"
        )

    # Tier 3: Authorship / dataset / methodology
    _authorship = [
        "who created",
        "who developed",
        "who designed",
        "who built",
        "authors",
        "who made",
    ]
    if any(k in q for k in _authorship):
        return (
            "FinWatch was created by **David Lameck** and **Denise Seti**, as part of their **BSc Computer Science** "
            "dissertation research project at **Cavendish University Zambia** in 2026."
        )

    _usage = ["how to use", "guide", "steps", "usage", "get started", "how do i"]
    if any(k in q for k in _usage):
        return (
            "1. Register or complete your SME profile on the **Companies** page.\n"
            "2. Go to the **Predictions** page, select your desired company profile, and enter the required financial data.\n"
            "3. Choose between the **Random Forest** or **Logistic Regression** model and run the prediction.\n"
            "4. View your results and optionally export them in **PDF** or **CSV** formats.\n\n"
            "You can also access the guided tutorial via the system overview icon in the top right."
        )

    _dataset = ["dataset", "training data", "trained on", "learned from"]
    if any(k in q for k in _dataset):
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

    # Tier 3: Platform-specific financial topics
    if any(k in q for k in ["current ratio", "quick ratio", "cash ratio", "liquidity"]):
        return (
            "### Liquidity Ratios\n\nLiquidity ratios measure your ability to meet short-term obligations.\n"
            "- **Current Ratio**: Current assets ÷ current liabilities. Benchmark: ≥ 1.5\n"
            "- **Quick Ratio**: (Current assets − inventory) ÷ current liabilities. Benchmark: ≥ 1.0\n"
            "- **Cash Ratio**: Cash ÷ current liabilities. Benchmark: ≥ 0.2\n\n"
            "Values below these thresholds suggest difficulty meeting near-term obligations."
        )

    if any(k in q for k in ["distress", "probability", "risk score", "prediction"]):
        return (
            "### Prediction Metrics\n\nThe **distress probability** is the model's confidence (0–100%) that a business is heading "
            "toward financial difficulty. Values above **50%** indicate elevated risk. FinWatch uses **Random Forest** "
            "and **Logistic Regression** for these assessments."
        )

    if "shap" in q or "explainab" in q:
        return (
            "### SHAP Explanations\n\n**SHAP (SHapley Additive exPlanations)** quantifies each ratio's contribution to the prediction.\n"
            "- **Positive SHAP value**: The ratio pushes toward a **Distressed** classification.\n"
            "- **Negative SHAP value**: The ratio pulls toward a **Healthy** classification.\n\n"
            "The magnitude shows how strongly each ratio influenced the result."
        )

    if any(k in q for k in ["debt", "leverage", "debt-to-equity", "debt to equity"]):
        return (
            "### Leverage Ratios\n\nLeverage ratios measure how much of your business is debt-financed.\n"
            "- **Debt-to-Equity**: Benchmark ≤ 2.0. Values above this signal high financial risk.\n"
            "- **Debt-to-Assets**: Benchmark ≤ 0.6. Above this, a majority of assets are debt-funded.\n\n"
            "High leverage increases financial fragility, especially combined with low profitability."
        )

    if any(k in q for k in ["interest coverage", "interest", "ebit"]):
        return (
            "### Interest Coverage\n\n**Interest Coverage** (EBIT ÷ Interest Expense) shows how many times earnings cover interest payments. "
            "Benchmark: ≥ 2.0. Values below this mean a large portion of earnings goes to servicing debt."
        )

    if any(
        k in q
        for k in [
            "profit margin",
            "net margin",
            "roa",
            "roe",
            "return on assets",
            "return on equity",
            "profitab",
        ]
    ):
        return (
            "### Profitability Ratios\n\nProfitability ratios show how efficiently your business converts revenue into profit.\n"
            "- **Net Profit Margin**: Benchmark ≥ 5%\n"
            "- **Return on Assets (ROA)**: Benchmark ≥ 2%\n"
            "- **Return on Equity (ROE)**: Benchmark ≥ 5%\n\n"
            "Negative values indicate a loss-making business, significantly elevating distress risk."
        )

    # Tier 5: Out-of-scope decline (friendly and narrow)
    return (
        "The AI generation service is temporarily unavailable. "
        "Please try again in a moment — your question has not been lost."
    )


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """Compute a hash for narrative caching based on ratios and model."""
    canonical = json.dumps({"ratios": ratios, "model": model_used}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
