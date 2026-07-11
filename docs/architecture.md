# FinWatch Zambia — System Architecture

This document describes the implemented architecture of FinWatch Zambia, an ML-based financial distress early-warning system for Zambian SMEs. The system is production-deployed and fully operational.

**Live Frontend:** https://finwatch-zambia.vercel.app
**Live Backend:** https://finwatch-backend.onrender.com

---

## 1. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                │
│  Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui  │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │    SME Portal       │    │    Institutional Portal      │    │
│  │  /sme/* (Purple)    │    │  /regulator/* (Emerald)      │    │
│  │  Role: sme_owner    │    │  /analyst/* (Blue)           │    │
│  │                     │    │  Roles: regulator, analyst   │    │
│  └─────────────────────┘    └──────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Documentation System /docs/*                   │   │
│  │  /sme/docs · /institutional/docs/analyst · .../regulator │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ JSON API (Bearer JWT)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                               │
│              https://finwatch-backend.onrender.com              │
│                                                                 │
│  Auth · Companies · Predictions · Chat · Institutional · Reports│
│  QR Auth · Docs Chat · Admin                                    │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
Ratio      ML Models   SHAP       NLP        Database
Engine     RF + LR     Explainer  Engine     (PostgreSQL/
(10        (scikit-    (Tree +    (Groq →    SQLite)
ratios)    learn)      Linear)    OR → Templ)
```

---

## 2. Five-Layer Architecture

The system is structured in five vertical layers. Every user action traverses all five in sequence.

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                     │
│  Next.js App Router · shadcn/ui · Recharts · Tailwind   │
│  Dual portal (SME + Institutional) · Mobile APK         │
├─────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                          │
│  Input validation · Ratio Engine · Workflow APIs        │
│  Auth Manager · Extraction Service · Reporting Service  │
├─────────────────────────────────────────────────────────┤
│  MODEL LAYER                                            │
│  Random Forest (primary/headline) · Logistic Regression │
│  SHAP TreeExplainer (RF) · SHAP LinearExplainer (LR)    │
├─────────────────────────────────────────────────────────┤
│  NLP LAYER                                              │
│  Tier 1: Groq Proxy (primary via Cloudflare Worker)     │
│  Tier 2: OpenRouter (secondary failover)                │
│  Tier 3: Deterministic f-string Template Engine         │
├─────────────────────────────────────────────────────────┤
│  PERSISTENCE LAYER                                      │
│  SQLAlchemy 2.0 ORM · Alembic migrations                │
│  PostgreSQL / Supabase (production)                     │
│  SQLite WAL mode (local development)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Institutional Umbrella Architecture

The system presents two distinct professional experiences sharing a common "Institutional" logic and API layer:

| Dimension | SME Portal | Institutional Portal (Regulator) | Institutional Portal (Analyst) |
|:---|:---|:---|:---|
| URL prefix | `/sme/*` | `/regulator/*` | `/analyst/*` |
| Theme | Purple | Emerald | Blue |
| Roles | `sme_owner` | `regulator` | `policy_analyst` |
| Token keys | `token` / `user` | `inst_token` / `inst_user` | `inst_token` / `inst_user` |
| Primary function | Individual company health assessments | Full systemic oversight | Strategic trend analysis |
| Data scope | Own companies only | Anonymised aggregate + flags | Anonymised aggregate only |
| AI assistant | FinWatch AI | Regulator AI | Analyst AI |
| Reports | PDF per assessment | PDF / CSV / JSON aggregate | PDF / CSV / JSON briefs |

**Code Reusability:** Pages and components are housed in `frontend/components/institutional/pages/` and dynamically re-exported into role-specific Next.js route groups, ensuring absolute visual and logical consistency while maintaining clear URL boundaries.

---

## 4. Authentication Architecture

The system uses a two-step OTP authentication flow with optional QR Scan-to-Login for mobile session bridging.

```
REGISTRATION FLOW
─────────────────
User submits form
      │
      ▼
POST /auth/register ──► OTP email sent (Google Apps Script → Resend → SMTP)
      │
      ▼
POST /auth/verify ──► Atomic transaction:
                       1. Activate user account
                       2. Clean up verification record
                       3. Register UserDeviceSession
                       4. Return JWT + user profile

LOGIN FLOW
──────────
POST /auth/login ──► Validate credentials
                  ──► Issue JWT (python-jose)
                  ──► Register UserDeviceSession (3-device limit)
                  ──► Return JWT + user profile

QR SCAN-TO-LOGIN FLOW (Mobile ↔ Web)
──────────────────────────────────────
Authenticated mobile user:
      │
      ▼
POST /qr/generate ──► One-time QR token (portal-isolated)
      │
      ▼
Web browser scans QR:
      │
      ▼
POST /qr/scan ──► Consume token (one-time use)
              ──► Revoke prior primary native session (supersedence)
              ──► Issue new JWT + UserDeviceSession
              ──► Return session to web browser
```

**JWT implementation:** `python-jose` (not PyJWT — different import paths)
**Password hashing:** `bcrypt==3.2.2` (pinned — passlib 1.7.4 incompatible with bcrypt 4.x)
**Session tracking:** `UserDeviceSession` table — `jti` validated on every request to support remote revocation

---

## 5. ML Pipeline

```
UCI Polish Companies Bankruptcy Dataset
3year.arff · 10,503 records · DOI: 10.24432/C5F600
              │
              ▼
    Stratified Train/Test Split
              │
              ▼
    SMOTE (training set only — never test set)
              │
              ▼
    StandardScaler (fit on SMOTE output only)
              │
         ┌────┴────┐
         ▼         ▼
   Random Forest   Logistic Regression
   RANDOM_STATE=42  RANDOM_STATE=42
   (Primary)        (Secondary)
         │         │
         └────┬────┘
              ▼
    DISTRESS_CLASS_INDEX = 1
    (defined in app/core/constants.py)
              │
         ┌────┴────┐
         ▼         ▼
   TreeExplainer  LinearExplainer
   (RF SHAP)      (LR SHAP)
              │
              ▼
    NLP Narrative Generation
    (Groq → OR → Template fallback)
```

**Model execution & presentation:** Both models always run concurrently via `asyncio.gather` for every assessment (ADR-027). Random Forest acts as the primary/headline model on every surface, justified by its higher PR-AUC on the held-out Polish test set (Saito and Rehmsmeier, 2015; ADR-028). Logistic Regression is presented as a secondary baseline comparison. Mismatches are flagged as a categorical disagreement, not resolved by overriding (ADR-029).

**Domain shift note:** All ML metrics (accuracy, ROC-AUC, F1, precision, recall) reflect the Polish test set only. The model has never been trained or evaluated on Zambian SME data. See `docs/ADR.md` ADR-013 for full justification.

---

## 5a. Dual-Model Concurrent Architecture

To capture the distinct trade-offs of different learning algorithm families and provide robust comparative insights, the system employs a dual-model concurrent prediction architecture (ADR-027).

### 1. Key Terminology
- **Prediction:** A database record of a single model's execution result (e.g. Random Forest risk assessment and SHAP values).
- **Assessment:** The unified user-facing event representing both concurrent predictions, sharing a common `ratio_feature_id` (and corresponding `FinancialRecord`).

### 2. Execution and Tolerance
- **Concurrent Ingestion:** Predictions are executed concurrently using `asyncio.gather` inside `ml_service.py` to minimize response times.
- **Partial Failure Tolerance:** If one model fails (e.g., due to SHAP compilation issues), the assessment is still considered valid and proceeds using the succeeding model. 

### 3. Headline Presentation (ADR-028)
- **Random Forest (Primary):** Serves as the primary headline result on all client dashboards, lists, and exports. This is justified by its higher PR-AUC performance (Saito and Rehmsmeier, 2015).
- **Logistic Regression (Secondary):** Serves as a baseline comparison. It is displayed alongside Random Forest (e.g., inside collapsible panels or static secondary report sections) to provide full transparency.

### 4. Disagreement and Aggregation
- **Disagreement Detection (ADR-029):** When the two models differ on the final binary classification (`risk_label`), a categorical disagreement is flagged. No continuous probability-distance threshold is applied.
- **Institutional Aggregation (ADR-030):** All institutional-facing aggregate statistics (sector distress rates, trends, anomaly flags) are computed **exclusively** from Random Forest predictions. Raw probabilities from RF and LR are never pooled or averaged due to differences in calibration.

---

## 6. The 10 Financial Ratios

All ratio definitions live exclusively in `backend/app/services/ratio_engine.py` — the single source of truth. The NLP service imports directly from it. No duplication exists in the codebase.

| # | Ratio | Category | Theoretical Basis |
|:---|:---|:---|:---|
| 1 | Current Ratio | Liquidity | Beaver (1966); Altman (1968) |
| 2 | Quick Ratio | Liquidity | Beaver (1966) |
| 3 | Cash Ratio | Liquidity | Ohlson (1980) |
| 4 | Debt-to-Equity | Leverage | Altman (1968) |
| 5 | Debt-to-Assets | Leverage | Ohlson (1980) |
| 6 | Interest Coverage | Leverage | Altman (1968) |
| 7 | Net Profit Margin | Profitability | Beaver (1966) |
| 8 | Return on Assets | Profitability | Altman (1968); Ohlson (1980) |
| 9 | Return on Equity | Profitability | Beaver (1966) |
| 10 | Asset Turnover | Activity | Altman (1968) |

---

## 7. NLP Architecture (Triple-Tier)

```
Financial Ratios + SHAP Values
              │
              ▼
    ┌─────────────────────┐
    │  TIER 1: Groq Proxy │  openai/gpt-oss-20b
    │  (Primary)          │  temperature=0.2, max_tokens=1500
    └────────┬────────────┘
             │ Fails / Unavailable
             ▼
    ┌─────────────────────┐
    │  TIER 2: OpenRouter │  meta-llama/llama-3.1-8b-instruct:free
    │  (Secondary)        │  temperature=0.2, max_tokens=1500
    └────────┬────────────┘
             │ Fails / Unavailable
             ▼
    ┌─────────────────────────────┐
    │  TIER 3: Template Engine    │  Deterministic f-string
    │  (Guaranteed Fallback)      │  No external dependency
    └─────────────────────────────┘
```


**Scale-aware prompting:**
- Small Scale: Plain language, relatable Zambian business scenarios, no jargon
- Medium Scale: Technical financial language, detailed ratio interpretations

**Narrative caching:** Cached by prediction hash in the `Narrative` ORM model. A prediction's narrative is generated once and retrieved on all subsequent views.

**Separate API keys:** `GROQ_API_KEY` (narrative + chat) and `EXTRACTION_GROQ_API_KEY` (document extraction) are kept separate to isolate quota consumption.

---

## 8. Data Flow — The Prediction Cycle

```
1. INGESTION
   User uploads documents or enters raw financial data manually
   (or answers Indicative questionnaire for Small Scale)

2. EXTRACTION (if documents uploaded)
   extraction_service.py parses PDF/Excel/CSV
   Uses EXTRACTION_GROQ_API_KEY for LLM-assisted parsing

3. TRANSFORMATION
   ratio_engine.py computes all 10 financial ratios
   from the 12 raw financial inputs

4. INFERENCE
   ml_service.py runs both RF and LR models concurrently via asyncio.gather
   DISTRESS_CLASS_INDEX=1 (from app.core.constants)
   Mismatches in risk labels are flagged as categorical disagreement

5. EXPLANATION
   explain.py computes SHAP values
   TreeExplainer for RF · LinearExplainer for LR
   Per-feature attributions for the distress class

6. NARRATIVE
   nlp_service.py generates plain-English explanation
    Groq Proxy (primary) → OpenRouter (secondary) → Template Engine (fallback)
   Scale-aware prompting based on user.business_scale
   Result cached by prediction hash

7. PERSISTENCE
   FinancialRecord · RatioFeature · Prediction · Narrative
   all saved to PostgreSQL (production) / SQLite (local)

8. PRESENTATION
   Risk label · Distress probability · SHAP chart · NLP narrative
   Dual-model combined PDF/CSV/ZIP export (ReportLab, ADR-031)
   RF rendered first, LR second, with explicit disagreement notices
```

---

## 9. Database Schema (12 ORM Models)

| Model | Key Constraints |
|:---|:---|
| `User` | `role` field (`sme_owner` default), `business_scale`, `last_login_at` |
| `Company` | Cascade delete (all-delete-orphan), regex-validated name, 12-digit registration number |
| `FinancialRecord` | `UniqueConstraint(company_id, period)` |
| `RatioFeature` | FK to FinancialRecord |
| `Prediction` | `UniqueConstraint(ratio_feature_id, model_used)`, `shap_values_json`, `assessment_methodology` |
| `Narrative` | FK to Prediction, cached by prediction hash |
| `Report` | FK to Company |
| `AIUsageLog` | `ai_type` field (`dashboard` \| `docs`), UTC timestamps, rolling-window rate limiting |
| `VerificationCode` | OTP storage for 2-step email verification |
| `QRSession` | One-time QR tokens, portal-isolated, `expires_at` |
| `UserDeviceSession` | `jti`, `expires_at`, `platform`, primary session flag, 3-device limit |
| `ChatConversation` | AI conversation threads; 25/user/portal limit; `messages_json` Text column; LRU eviction |

**Migration strategy:** Alembic with `render_as_batch=True` (required for SQLite ALTER TABLE compatibility). Both SQLite (local) and PostgreSQL (production) use the same migration code path.

---

## 10. Deployment Architecture

| Layer | Provider | URL | Notes |
|:---|:---|:---|:---|
| Frontend | Vercel | https://finwatch-zambia.vercel.app | Auto-deploys from `main` branch |
| Backend | Render | https://finwatch-backend.onrender.com | Docker image with ML artifacts baked in |
| Database | Supabase | — | PostgreSQL; connection via `DATABASE_URL` env var |
| Keep-alive | cron-job.org | — | Pings backend every 10 mins to prevent Render cold start |

**Environment switching:** `RENDER=true` env variable activates PostgreSQL dialect logic in the database layer. Never set this locally.

**ML artifacts:** `.joblib` files are baked into the Docker image at build time. If the model is retrained, a new Docker image must be built and deployed on Render.

**Cold start handling:** Render free tier spins down after inactivity. Auth pages implement 4-state connection feedback (idle → waking → success → error) to communicate the delay to users transparently.

---

## 11. Mobile Architecture (Capacitor Android)

The web application is wrapped as a native Android APK via Capacitor. Several architectural decisions exist specifically because of this:

| Concern | Implementation | Reason |
|:---|:---|:---|
| Session persistence | `@capacitor/preferences` (30-day sessions) | `localStorage` does not survive Android cold launch |
| Sign-out navigation | `router.replace()` only | `window.location.href` causes WebView reload deadlock |
| Token clearing | `Promise.all([...])` concurrent | Sequential awaits cause bridge lock on rapid navigation |
| Bridge timeout | 600ms race guard on all native reads | Capacitor bridge can hang on cold launch |
| Root page fallback | 3.5s safety-net timer | Guarantees transition under any hydration failure |
| JWT decoding | Custom base64url padding-safe implementation | Standard `atob()` throws `DOMException` in WebView |
| Camera permissions | `navigator.permissions.query` API only | Hardware probe sequences lock the camera sensor |
| Camera fallback | `environment` facing mode | Fails gracefully if specific camera ID is unavailable |
| User profile hydration | API fallback to `/auth/me` on cold launch | `business_scale` must be accurate for methodology routing |
