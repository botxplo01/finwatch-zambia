# FinWatch Zambia — Architecture Decision Records (ADR)

Every non-obvious technical decision in this project is documented here. Each entry answers: what was decided, why, and what alternatives were explicitly rejected. This file exists to prevent future agents and developers from "helpfully" reversing decisions whose rationale is not visible in the code itself.

**Format:** ADR-NNN · Decision · Status · Context → Decision → Consequences · Alternatives Rejected

---

## ADR-001 · Python locked to 3.12.10

**Status:** Active

**Context:** The ML pipeline depends on scikit-learn, SHAP, and joblib. Python 3.14 introduced breaking changes to the C extension ABI that affect all three libraries. Prebuilt wheels for these packages are not available for 3.14 on the project's hardware.

**Decision:** Pin Python to `3.12.10` across all environments. This is enforced in `stack_rules.json` and `stack-guard.md`.

**Consequences:** Cannot use any Python 3.14+ language features. All new dependencies must be verified for 3.12 compatibility before installation.

**Alternatives Rejected:**
- Python 3.13 — same wheel availability issues for scikit-learn at time of decision.
- Python 3.11 — viable but offers no benefit over 3.12 and was already in use.

---

## ADR-002 · JWT library is python-jose, not PyJWT

**Status:** Active

**Context:** Both `python-jose` and `PyJWT` are common JWT libraries for FastAPI. They have different import paths, different APIs, and different token construction signatures.

**Decision:** Use `python-jose` (`from jose import jwt, JWTError`). This was established at project inception and is embedded throughout `backend/app/core/security.py` and all authentication endpoints.

**Consequences:** Any agent or developer generating auth code must use `python-jose` imports. PyJWT imports (`import jwt`) will silently fail or produce incompatible tokens.

**Alternatives Rejected:**
- PyJWT — different API surface; switching would require rewriting all token creation and validation logic.

---

## ADR-003 · bcrypt pinned at 3.2.2

**Status:** Active

**Context:** `passlib 1.7.4` — the password hashing abstraction layer used throughout the auth system — is incompatible with `bcrypt 4.x`. The incompatibility causes a runtime crash on password verification, not a startup error.

**Decision:** Pin `bcrypt==3.2.2` in `requirements.txt`. Do not upgrade without first upgrading passlib.

**Consequences:** Dependabot and automated upgrade tools will flag this as outdated. Ignore those flags. The pin is intentional.

**Alternatives Rejected:**
- Upgrading to bcrypt 4.x without passlib upgrade — causes silent auth failures.
- Switching to argon2 — would require migration of all existing password hashes.

---

## ADR-004 · High-Availability NLP Architecture

**Status:** Active — PERMANENT. Do not reverse.

**Context:** The NLP narrative generation requires high reliability and low latency. Initial evaluations of local inference showed significant resource constraints and performance bottlenecks on target hardware.

**Decision:** The NLP architecture is triple-tier: Groq Proxy (primary via Cloudflare Worker) → OpenRouter (secondary failover) → Template Engine (deterministic fallback).
**Consequences:** The system has no local LLM dependency. NLP quality is high-availability through redundant cloud providers. The Template Engine provides a guaranteed, high-quality deterministic fallback if all cloud APIs are unreachable.

**Alternatives Rejected:**
- Utilizing local inference models — adds maintenance overhead and resource consumption for no user-visible benefit.
- Relying on a single cloud provider — introduces a single point of failure.

---

## ADR-005 · PDF engine is ReportLab, not WeasyPrint

**Status:** Active

**Context:** WeasyPrint requires system-level dependencies (Cairo, Pango, GLib) that cannot be reliably installed on Windows without WSL or MSYS2. The project is developed on Windows 11 PowerShell. WeasyPrint was evaluated and removed early in development due to these dependency failures.

**Decision:** Use `ReportLab` exclusively for all PDF generation — both SME assessment reports and institutional aggregate reports.

**Consequences:** PDF layout is constructed programmatically via ReportLab's Platypus flowable system rather than from HTML/CSS templates. More verbose but entirely self-contained.

**Alternatives Rejected:**
- WeasyPrint — Windows system dependency failures. Non-starter for this environment.
- pdfkit / wkhtmltopdf — same system dependency problem on Windows.
- fpdf2 — less mature table and image handling than ReportLab.

---

## ADR-006 · CondPageBreak, not PageBreak

**Status:** Active

**Context:** Using `PageBreak()` unconditionally in ReportLab causes phantom blank pages when a section naturally ends near a page boundary — the content ends, a forced break fires, and an empty page is inserted before the next section.

**Decision:** Use `CondPageBreak(7 * cm)` throughout all PDF generation. This only triggers a page break if fewer than 7cm remain on the current page, preventing phantom pages.

**Consequences:** All new PDF sections added to `report_service.py` or `institutional_report_service.py` must use `CondPageBreak(7 * cm)`, never `PageBreak()`.

**Alternatives Rejected:**
- Unconditional `PageBreak()` — produces empty pages, confirmed bug in production.

---

## ADR-007 · Sign-out uses router.replace(), not window.location.href

**Status:** Active

**Context:** On Android via Capacitor WebView, calling `window.location.href = '/sme/auth/login'` triggers a full WebView path reload. This creates a deadlock where the WebView attempts to load a path that requires native bridge initialisation before the bridge is ready, leaving the app on a permanent loading screen.

**Decision:** All sign-out and post-auth redirections use Next.js `router.replace()`. This performs client-side navigation without triggering a WebView reload.

**Consequences:** Sign-out must always have access to the Next.js router instance. Server components and utility functions outside React cannot perform sign-out redirections directly — they must signal a client component to do it.

**Alternatives Rejected:**
- `window.location.href` — confirmed WebView reload deadlock on Android, Sessions 21+.
- `router.push()` — adds a history entry; `replace()` is correct for auth transitions.

---

## ADR-008 · Token clearing uses Promise.all, not sequential awaits

**Status:** Active

**Context:** On Capacitor WebView, sequential `await clearToken(); await clearInstitutionalToken();` calls during sign-out create a window where the bridge may lock between the two operations if the WebView is interrupted (e.g., by a rapid navigation event). This leaves one token partially cleared and causes inconsistent auth state.

**Decision:** All token clearing operations use `Promise.all([clearToken(), clearInstitutionalToken()])` for concurrent execution.

**Consequences:** Token clearing is atomic from the user's perspective. Both portal tokens are always cleared together or not at all.

**Alternatives Rejected:**
- Sequential awaits — confirmed bridge lock risk on fast navigation, Session 21.

---

## ADR-009 · Random Forest takes precedence over Logistic Regression on disagreement

**Status:** Active

**Academic Justification:** Barboza, Kimura and Altman (2017) demonstrated that ensemble tree-based models outperform logistic regression on financial distress prediction tasks. Random Forest's non-linear decision boundaries better capture the complex interaction effects between financial ratios.

**Context:** Both models run on every prediction. When they disagree on the binary classification (Distressed vs Healthy), the system must return a single authoritative result.

**Decision:** Random Forest is the authoritative model. Its prediction is the system output when models disagree. Logistic Regression serves as a baseline comparison model.

**Consequences:** The `risk_label` and `distress_probability` displayed to users and stored in the database always reflect the Random Forest output. All institutional analytics filter on `Prediction.model_used == "random_forest"`.

**Alternatives Rejected:**
- Logistic Regression precedence — contradicted by literature on ML vs statistical model performance.
- Averaging probabilities — obscures interpretability; SHAP explanations are model-specific.
- User-selectable precedence — adds UX complexity; academic framing requires a single authoritative result.

---

## ADR-010 · DISTRESS_CLASS_INDEX = 1, defined in constants.py

**Status:** Active (centralised in Session 35)

**Context:** scikit-learn's `predict_proba()` returns a 2D array where column 0 is the probability of class 0 (Healthy) and column 1 is the probability of class 1 (Distressed). SHAP values for multi-output classifiers similarly return arrays indexed by class. Using index 0 instead of 1 returns Healthy probability and Healthy SHAP values — producing inverted predictions and inverted explanations with no runtime error.

**Decision:** `DISTRESS_CLASS_INDEX = 1` is the single authoritative value, defined in `backend/app/core/constants.py` and imported by `ml_service.py`, `explain.py`, `evaluate.py`, and `train_models.py`. It must never be redefined locally in any of these files.

**Consequences:** Any file that needs this constant must import it: `from app.core.constants import DISTRESS_CLASS_INDEX`. Agents generating ML code must never hardcode `1` or `0` — they must use the import.

**Alternatives Rejected:**
- Redefinition in each file — was the original approach; caused latent consistency risk patched in Session 35.

---

## ADR-011 · SMOTE applied post-split on training data only

**Status:** Active

**Academic Justification:** Applying SMOTE before the train/test split causes data leakage — synthetic samples derived from test-set neighbours appear in the training set, artificially inflating all evaluation metrics.

**Decision:** The stratified train/test split occurs first. SMOTE is applied exclusively to the training set after the split. The test set is never touched by SMOTE.

**Consequences:** Evaluation metrics (accuracy, ROC-AUC, F1, precision, recall) are computed on an unaugmented, uncontaminated test set. Results are academically defensible.

**Alternatives Rejected:**
- Pre-split SMOTE — data leakage; inflated and non-reproducible metrics.
- No class balancing — the UCI dataset is heavily imbalanced (~96% Healthy); unbalanced training produces a model that predicts Healthy for nearly every input.

---

## ADR-012 · StandardScaler fit on SMOTE output only

**Status:** Active

**Context:** If StandardScaler is fit on the full dataset before splitting, test-set statistics (mean, variance) influence the scaler — another form of data leakage.

**Decision:** StandardScaler is fit exclusively on the SMOTE-augmented training set. The test set is transformed using the training fit (`scaler.transform(X_test)`, never `scaler.fit_transform(X_test)`). The fitted scaler is serialised to `ml/artifacts/scaler.joblib` and used for all production inference.

**Consequences:** Production inference uses the same scaler fit as training. New financial ratio inputs at inference time are scaled identically to how training data was scaled.

**Alternatives Rejected:**
- Fit on full dataset — data leakage.
- Fit on test set separately — different scale from training; model sees out-of-distribution inputs.

---

## ADR-013 · UCI Polish Companies Bankruptcy dataset (3year.arff)

**Status:** Active

**Context:** No labelled Zambian SME financial distress dataset exists in the public domain. The system requires a labelled dataset for supervised ML training. The UCI Polish Companies Bankruptcy dataset is the most comprehensive publicly available labelled financial distress dataset — 10,503 records, 64 features, binary distress labels, DOI: 10.24432/C5V61K.

**Decision:** Train on the UCI Polish dataset. Use the World Bank Zambia Enterprise Survey 2019–2020 for contextual validation only — not training, not fine-tuning, not evaluation.

**Consequences:** All ML performance metrics reflect the Polish test set. The model has never been exposed to Zambian distress outcomes. This is a known, named limitation (domain shift) that must be explicitly acknowledged in all academic and technical documentation. The system is framed as a proof of concept, not a clinically validated deployment tool.

**Alternatives Rejected:**
- Training on synthetic Zambian data — fabricated labels are academically indefensible.
- Using only the World Bank survey — no distress labels; cannot train a supervised classifier.
- Collecting real Zambian data — out of scope for BSc dissertation timeline; recommended as primary future work.

---

## ADR-014 · Three-tier risk model with thresholds 0.40 / 0.70

**Status:** Active

**Context:** The ML model outputs a continuous distress probability between 0 and 1. The binary classification threshold of 0.5 is used for SME-facing risk labels (Healthy / Distressed). The institutional analytics layer required a more granular risk segmentation for policy oversight purposes.

**Decision:** Three tiers defined by module-level constants in `backend/app/api/institutional.py`:
- `HIGH_RISK_THRESHOLD = 0.70` — probability ≥ 0.70 → High Risk
- `MEDIUM_RISK_THRESHOLD = 0.40` — probability ≥ 0.40 and < 0.70 → Medium Risk
- Below 0.40 → Low Risk

These constants are the single source of truth and must be imported by `institutional_report_service.py` rather than redefined.

**Consequences:** Dashboard displays and PDF/CSV/JSON exports must always agree on risk tier assignments. Any threshold change requires updating only `institutional.py`.

**Alternatives Rejected:**
- Equal thirds (0.33 / 0.67) — arbitrary; 0.40/0.70 better reflects the asymmetric cost of false negatives in financial distress detection.
- Binary (Healthy / Distressed only) — insufficient granularity for policy-level oversight.

---

## ADR-015 · render_as_batch=True in all Alembic migrations

**Status:** Active

**Context:** SQLite does not support `ALTER TABLE` for column modifications or deletions. Alembic's `render_as_batch=True` mode rewrites the entire table to effect schema changes. Without this, migrations that work on PostgreSQL (production) fail silently or crash on SQLite (local development).

**Decision:** All Alembic migration operations use `render_as_batch=True`. This is set globally in `alembic.ini` and must be preserved in all new migration files.

**Consequences:** Local SQLite migrations and production PostgreSQL migrations follow the same code path. A migration that works locally will work in production.

**Alternatives Rejected:**
- SQLite-only raw SQL workarounds — non-portable; breaks the dialect-agnostic migration strategy.
- Dropping SQLite for local development — increases local setup complexity; SQLite is fast and zero-config.

---

## ADR-016 · Next.js pinned at 14.2.5

**Status:** Active

**Context:** shadcn/ui and `eslint-config-next` have peer dependency constraints tied to specific Next.js minor versions. Upgrading Next.js without upgrading these dependencies in lockstep causes build failures on Vercel CI/CD.

**Decision:** Pin `next` at `14.2.5` and `eslint` at `^8.57.0`. Do not upgrade without verifying shadcn/ui and eslint-config-next compatibility.

**Consequences:** Dependabot flags will appear. They are intentional — ignore them until a coordinated upgrade is planned.

**Alternatives Rejected:**
- Latest Next.js — peer dependency conflicts cause Vercel build failures, confirmed in Session 34.

---

## ADR-017 · @capacitor/preferences for native session persistence

**Status:** Active

**Context:** `localStorage` is a browser API. On Android, Capacitor WebView does not guarantee localStorage persistence across full app closes and cold relaunches. Sessions stored only in localStorage are lost on cold launch, leaving users in an authenticated-but-profileless state.

**Decision:** All session-critical data (JWT tokens, user profile objects) is stored in both localStorage (for fast synchronous reads during the session) and `@capacitor/preferences` (for durable native persistence across cold launches). On mount, if localStorage is missing data, the fallback fetches from `@capacitor/preferences` or the authenticated API endpoint.

**Consequences:** All auth read/write operations must use the dual-layer pattern. Never use localStorage alone for anything that must survive a cold launch.

**Alternatives Rejected:**
- localStorage only — confirmed data loss on Android cold launch, Sessions 21–35.
- @capacitor/preferences only — async-only API; adds bridge latency to every synchronous read during the session.

---

## ADR-018 · Camera permissions use navigator.permissions.query, not hardware probes

**Status:** Active

**Context:** Earlier implementations used a hardware probe sequence — opening a `getUserMedia` stream to test permission state before showing the QR scanner. This locked the camera hardware and caused "Could not start video source" errors when the scanner then tried to open the same hardware, because the probe stream had not fully released.

**Decision:** Use `navigator.permissions.query({ name: 'camera' })` as the authoritative permission check. This reads the browser permission state without touching hardware. Camera hardware is opened only when the scanner actually starts.

**Consequences:** Permission checks are non-destructive. The camera hardware is never opened more than once per scanning session.

**Alternatives Rejected:**
- Hardware probe sequences — confirmed camera busy lock, multiple sessions (29–33).
- Skipping permission checks — produces poor UX on first launch when permission has not been granted.

---

## ADR-019 · NLP narratives cached by prediction hash

**Status:** Active

**Context:** Each Groq API call consumes quota and introduces latency (~1–3 seconds). If a user views the same prediction multiple times (from history, from the report preview, from the dashboard), regenerating the narrative on every view is wasteful and slow.

**Decision:** NLP narratives are cached in the `Narrative` ORM model, keyed by a hash of the prediction's input values. On subsequent requests for the same prediction, the cached narrative is returned without an API call.

**Consequences:** A prediction's narrative is generated once and stored permanently. If the NLP prompt template changes, existing cached narratives will not be regenerated unless the cache is explicitly invalidated.

**Alternatives Rejected:**
- Regenerating on every view — wastes Groq quota; slow user experience.
- In-memory caching only — lost on server restart; Render free tier restarts frequently.

---

## ADR-020 · Prediction draft persistence uses localStorage only (known limitation)

**Status:** Active — known limitation, not a bug in the web flow

**Context:** The prediction wizard in `PredictPage.tsx` saves draft state (form values, selected company, step) to localStorage for UX continuity across page refreshes. This is sufficient for the web browser context.

**On Android:** localStorage alone does not survive cold launch. A Session 35 fix added a non-blocking background fetch of the user profile from `/api/auth/me` to restore `business_scale` on cold launch. The prediction draft itself (form values, step) is intentionally not persisted to Capacitor Preferences — restoring a partially completed prediction form across a cold launch adds complexity without clear user benefit. Users are expected to restart the prediction flow after a full app close.

**Decision:** Prediction draft → localStorage only. User profile (for methodology lock) → localStorage with API fallback on cold launch.

**Consequences:** Cold launch clears the prediction draft. This is accepted behaviour. The user profile and business scale are always restored correctly.

---

## ADR-021: Three-Tier NLP Architecture with Cloudflare Worker Reverse Proxy

**Date:** 2026-06
**Status:** Accepted
**Session:** 72–73

### Context
The original NLP design used Groq as the sole AI provider with a deterministic f-string template engine as fallback. During cloud deployment on Render, all Groq API calls returned HTTP 403 ("Access denied. Please check your network settings."). Root cause: Render's shared outbound IP pool is blocked at the network level by Cloudflare, which protects `api.groq.com`. This is a CDN-level IP block — not fixable by API key rotation, model changes, or code changes to the Groq client.

### Decision
Implement a three-tier NLP fallback chain:

1. **Primary — Groq via Cloudflare Worker reverse proxy.** A Cloudflare Worker (`https://groq-proxy.finwatch-groq.workers.dev`) proxies requests from Render to `api.groq.com` through a clean Cloudflare-owned IP, bypassing the shared Render IP block. The `GROQ_BASE_URL` environment variable on Render points to this Worker, not to `api.groq.com` directly. The `RENDER=true` flag activates proxy-specific HTTP client configuration in `_call_groq`.

2. **Secondary — OpenRouter.** OpenRouter (`meta-llama/llama-3.1-8b-instruct`) is added as a secondary fallback using the OpenAI-compatible SDK with a custom `base_url`. OpenRouter uses Render-compatible infrastructure and is unaffected by the CDN IP block. The same model family as Groq Tier 1 is served, making the transition transparent to users. The `source` field returned to the frontend remains `"groq"` for both Tier 1 and Tier 2 to maintain UI consistency — the cloud pill colour indicates "AI-generated", not the specific routing path.

3. **Deterministic — f-string template engine.** The existing template fallback remains as the hard floor. Always available, zero latency, zero API cost.

### Rationale
- A pure Cloudflare-proxy-only solution has a single point of failure (the Worker itself). Adding OpenRouter as Tier 2 provides redundancy without requiring a paid Render tier.
- OpenRouter's free tier serves the same llama model family, so output quality is consistent across tiers.
- The template engine's determinism makes it a safe last resort for dissertation data collection and evaluation periods.
- Returning `source="groq"` from both Tier 1 and Tier 2 avoids frontend changes and accurately communicates that a real LLM (not the template) generated the response.

### Consequences
- Requires `GROQ_BASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `RENDER=true` environment variables on Render.
- Cloudflare Worker free tier limit (100,000 requests/day) must be monitored in production.
- If Groq changes its CDN configuration or the Worker is misconfigured, the system silently falls to Tier 2 — startup diagnostic logging and `GET /api/admin/groq-status` provide observability.

---

## ADR-022: Conversation History Storage — JSON Column vs Separate Messages Table

**Date:** 2026-06
**Status:** Accepted
**Session:** 67

### Context
The AI Assistant conversation history feature required persistent storage of chat threads per user per portal. Two structural options were considered: (A) a `ChatConversation` table with a JSON column (`messages_json`) storing the full message array, or (B) a separate `ChatMessage` table with one row per message and a FK to a conversations table.

### Decision
Option A — single `ChatConversation` ORM model with a `messages_json` Text column.

Additional constraints:
- 25 conversations maximum per user per portal type (LRU eviction)
- 20 user messages + 20 AI responses maximum per conversation
- Cached `user_message_count` and `ai_response_count` integer columns on the conversation record — no COUNT query ever runs at chat time
- Preview text extracted server-side during list queries — client receives a `preview` string, never the full JSON

### Rationale
The 20/20 message limit makes the overhead of a separate messages table unjustified. A join query per chat request would add latency and schema complexity for a bounded dataset (maximum 40 messages × 20 conversations × N users). The JSON column approach is simpler, faster to implement, and its storage footprint is predictable and bounded. The cached count columns eliminate the need for COUNT queries and make capacity checking O(1).

### Consequences
- Messages stored as a JSON array cannot be individually queried by the database engine. This is acceptable given the 20/20 ceiling.
- The cached `user_message_count` and `ai_response_count` columns must be kept consistent with the actual `messages_json` array. Any bug in the append logic that drifts these counts from the actual message count would allow silent limit bypass — the Python-level guards are the only enforcement.
- LRU eviction is handled server-side in `conversation_service.py` at conversation creation time.

---

## ADR-023: Per-User Authentication Rate Limiting — User Model Fields vs Separate Table

**Date:** 2026-06
**Status:** Accepted
**Session:** 58–59

### Context
A brute-force login protection mechanism was needed to prevent credential stuffing against the `/api/auth/verify` endpoint. Two approaches were considered: (A) store attempt counts and lockout timestamps on the `User` model directly (`auth_attempt_count`, `auth_window_start`, `auth_locked_until`), or (B) create a separate `AuthAttemptLog` table.

### Decision
Option A — three new columns added to the `User` model via Alembic migration.

Constants (centralised in `backend/app/core/constants.py`):
- `AUTH_ATTEMPT_LIMIT = 5` (maximum successful logins per rolling window)
- `AUTH_WINDOW_SECONDS = 3600` (1-hour rolling window)
- `AUTH_LOCKOUT_SECONDS = 7200` (2-hour lockout on breach)

Logic lives in `backend/app/services/auth_limit_service.py`. Called from `/api/auth/verify` after user identification, before JWT issuance, within an atomic transaction.

### Rationale
The rate limiting is per-user (not per-IP), so user-scoped fields are the natural home. A separate table would add a join to every authentication request. The three-column approach is atomic within the existing user transaction — no separate table lock or race condition risk. The lockout is database-backed and survives Render cold starts (unlike in-memory approaches).

### Consequences
- Rate limiting is per-user account, not per-IP. A distributed attack using multiple IPs against one account will still trigger the lockout. IP-level throttling is handled separately by `rate_limit.py` (in-memory, resets on cold start — documented limitation).
- Lockout state is visible in the User record, making support and debugging straightforward.

---

## ADR-024: Session Heartbeat Polling for Real-Time Revocation Detection

**Date:** 2026-06
**Status:** Accepted
**Session:** 61

### Context
After implementing JTI validation in `get_current_user`, revoked sessions were correctly rejected at the API level. However, the user's browser tab would remain in a visually logged-in state indefinitely after revocation until the user manually made a request. A mechanism was needed to detect revocation and redirect the user within a reasonable time window without requiring websockets.

### Decision
Add a `useSessionHeartbeat` hook to both portal layouts (SME and institutional). The hook polls `GET /api/auth/me` every 30 seconds. A 401 response — handled by the existing `lib/api.ts` 401 interceptor — clears the active portal token and redirects the user to the login page.

Side effects of the heartbeat poll:
- The latest user record (including `business_scale`) is written back to localStorage on every successful response
- A `profile-updated` custom event is dispatched, which `PredictPage` listens to for real-time hybrid methodology recalculation

### Rationale
Websockets would provide sub-second revocation propagation but add significant backend complexity (connection management, scaling concerns) that is disproportionate for a dissertation prototype. A 30-second polling interval gives a user experience that is acceptable for a supervision/oversight context — regulators and policy analysts reviewing sector data are unlikely to need sub-30-second revocation propagation. The heartbeat also provides the `business_scale` sync as a free side effect.

### Consequences
- Each active browser session generates one backend request every 30 seconds. On Render's free tier this is negligible but is a documented overhead.
- The 30-second detection window means a revoked user can continue interacting for up to 30 seconds. This is an accepted trade-off vs. websocket complexity.
- The heartbeat is stopped automatically when the component unmounts (user navigates away or closes the tab).

---

## ADR-025: Hybrid Assessment Methodology — Dual Enforcement Points

**Date:** 2026-06
**Status:** Accepted
**Session:** 35–40

### Context
The system supports two assessment flows — Indicative Assessment (simplified, for small-scale businesses) and Full Financial Assessment (technical, for medium-scale or regulated businesses). The dissertation's hybrid methodology rule specifies that businesses in regulated sectors (Healthcare, Mining, Financial Services) must always use Full Financial Assessment regardless of their declared `business_scale`. This rule must be consistently applied.

### Decision
Enforce the hybrid methodology rule at two independent points:
1. **Backend:** `backend/app/core/business_rules.py` — `requires_full_assessment(business_scale, industry)` function. Called by the NLP narrative generator and prediction service. Immutable `assessment_methodology` field stored on the `Prediction` model at prediction time (migration `a436cd6ffe0f`).
2. **Frontend:** `frontend/lib/business-rules.ts` — same logic in TypeScript. Called by `PredictPage.tsx` before routing the user to the appropriate form. The session heartbeat also re-evaluates this when `business_scale` is updated.

### Rationale
Enforcing at only the frontend creates a bypass vector (direct API calls). Enforcing at only the backend means the user sees the wrong form before submission, creating a confusing UX. Dual enforcement at both layers provides both UX correctness and server-side integrity. Storing `assessment_methodology` immutably on the `Prediction` record creates an auditable trail of which methodology was applied to each prediction.

### Consequences
- Any change to the regulated sector list must be made in both `business_rules.py` and `business-rules.ts` simultaneously. These two files must remain in sync.
- The `assessment_methodology` field on `Prediction` is not modifiable after creation — this is by design.

---

## ADR-026: Native Android Session Supersedence Over Web Sessions at Device Limit

**Date:** 2026-06
**Status:** Accepted
**Session:** 55

### Context
The system enforces a 3-device session limit per user. After implementing JTI validation, a new problem emerged: if a user had three active web browser sessions and tried to log in from the native Android app, the login was blocked with "Maximum authenticated device limit." The intended UX is that native app logins should always be accommodated by evicting a web session.

### Decision
In `session_service.py`, restructure `register_session()` so that:
1. Native detection runs first — if the incoming session is from a native mobile device (`device_type == "Mobile"`), check whether any web sessions exist.
2. If web sessions exist and the limit is reached, evict the most recently created web session (not the oldest — the most recent web session is least likely to be a long-running active session).
3. After eviction, if the evicted session was the primary, `_reassign_primary_after_revocation()` runs to promote the next session.
4. The 3-device limit check then runs — now with a free slot.

Additionally, the primary session protection rule is narrowed: only native Mobile primary sessions are protected from remote revocation. Web primary sessions can always be revoked remotely.

### Rationale
Native app logins represent a deliberate device registration by the user. Web sessions may be from incognito tabs or forgotten browser sessions. Evicting web sessions to accommodate native logins respects user intent. The "most recent web session evicted" heuristic minimises disruption — recently created sessions are less likely to be in active use by the user. Narrowing primary protection to Mobile native sessions prevents a web session from accidentally becoming permanently irrevocable.

### Consequences
- A user with three web sessions who logs in natively will lose their most recently created web session silently. This is the intended behavior.
- The `_reassign_primary_after_revocation()` helper must be called after every session deletion. Do not remove this call.
- Device limit enforcement order in `session_service.py` is: native detection → web eviction → limit check. Do not re-order.

## ADR-027: Dual-Model Concurrent Prediction Architecture

**Date:** 2026-06
**Status:** Accepted
**Session:** 111

### Context
The original architecture accepted a `model_name` query parameter (`random_forest` or
`logistic_regression`) and ran exactly one model per prediction request. This meant every assessment
reflected only one model's perspective, concealed the documented precision-recall tradeoff between
the two models (RF: higher precision, ~34.3% distressed recall; LR: ~68.7% distressed recall — see
Chapter 4 findings), and offered no mechanism to surface cases where the two models would have
disagreed.

### Decision
Both Random Forest and Logistic Regression are now always executed concurrently for every assessment
via `asyncio.gather`, with each model's outcome persisted as an independent `Prediction` row sharing
a common `ratio_feature_id`. Two terms are now used precisely and exclusively throughout the system
and the dissertation:
- **Prediction** — one model's individual technical output (one database row).
- **Assessment** — the combined, user-facing unit, keyed by `ratio_feature_id`, comprising up to two
  Predictions.
Failure of one model does not block the other — an assessment is complete if at least one model
succeeds (partial-failure tolerant).

### Rationale
Lessmann et al. (2015) establish comparative evaluation against multiple algorithms as a benchmarking
requirement for credit-scoring classifiers; running both models concurrently for every live
assessment operationalises that comparative principle at the level of individual user-facing
predictions rather than confining it to offline benchmarking alone. Barboza, Kimura and Altman (2017)
similarly support evaluating bankruptcy prediction against more than one machine learning approach
rather than committing to a single classifier.

### Alternatives Considered
1. *Retain single-model selection, drop the unused model.* Rejected — this would hide the genuine,
   academically significant precision-recall tradeoff and remove the paired comparison data needed to
   answer RQ2.
2. *True ensemble (average or vote RF and LR into one score).* Rejected — RF and LR are differently
   calibrated classifiers; averaging their raw probabilities would produce a mathematically incoherent
   blended score and would destroy the disagreement signal, which is itself diagnostically useful (see
   ADR-029).

### Consequences
- *Positive:* Directly supports RQ2 with paired per-assessment comparison data; enables the
  institutional disagreement-rate monitoring metric (ADR-030); transparent to end users about model
  uncertainty.
- *Negative / Tradeoffs:* Every assessment now costs roughly double the inference and narrative-
  generation work; requires strict terminology discipline (Prediction vs. Assessment) throughout the
  codebase, API surface, and dissertation text to avoid confusion.

**Related Sessions:** 111–118
**Related ADRs:** ADR-028, ADR-029, ADR-030

---

## ADR-028: Random Forest as Primary/Headline Model

**Date:** 2026-06
**Status:** Accepted
**Session:** 111–122

### Context
With both models always computed, every surface (dashboard, history, predict results, PDF/CSV
reports) needed a consistent default presentation order rather than treating both models as equally
prominent everywhere, which would increase cognitive load without a clear benefit to the user.

### Decision
Random Forest is presented as the primary/headline result on every surface; Logistic Regression is
always computed and never hidden, but displayed as a clearly labelled secondary comparison
(collapsible in interactive UI; rendered second, statically, in PDF exports). Institutional sector,
trend, and anomaly aggregation use Random Forest exclusively.

### Rationale
Saito and Rehmsmeier (2015) demonstrate that the precision-recall curve is more informative than the
ROC curve for imbalanced classification problems such as rare-event financial distress prediction.
Random Forest's higher PR-AUC on the held-out Polish test set is the empirical basis for treating it
as the headline classifier, rather than an arbitrary engineering default.

**Alternatives Considered**
1. *User-selectable "primary" model.* Rejected — adds UI complexity without clear benefit, and risks
   users anchoring on whichever model happens to confirm their prior expectation.
2. *Logistic Regression as primary, given its higher minority-class recall.* Rejected — PR-AUC
   accounts for the full precision-recall tradeoff rather than recall in isolation, and favours Random
   Forest as the better-calibrated overall classifier on the test set. LR's recall advantage remains a
   valuable, separately reported finding rather than grounds for reordering the default presentation.

### Consequences
- *Positive:* Consistent, literature-grounded default reduces user confusion; institutional aggregate
  statistics remain internally coherent (single, consistently calibrated reference classifier).
- *Negative / Tradeoffs:* "Primary" framing risks being misread as "more correct" rather than "better
  PR-AUC on a foreign test set under domain shift." Every surface — UI copy, report copy, and Chapter 4
  discussion — must consistently restate this nuance to avoid overclaiming Random Forest's real-world
  reliability for Zambian SMEs specifically.

**Related Sessions:** 111–118
**Related ADRs:** ADR-027, ADR-030

---

## ADR-029: Categorical Disagreement Detection (No Magnitude Threshold)

**Date:** 2026-06
**Status:** Accepted
**Session:** 111, 118

### Context
With two models running per assessment, a mechanism was needed to flag when they meaningfully
disagree — both so end users know to scrutinise the result more closely, and so the institutional
portal can monitor a disagreement rate as a proxy signal, since no Zambian ground-truth outcome
labels exist against which live accuracy could otherwise be measured.

### Decision
Disagreement is flagged purely on a categorical mismatch of `risk_label` (Healthy vs. Distressed)
between the two models. There is no continuous probability-distance threshold (e.g. flagging only
when the two probabilities differ by more than some delta).

### Rationale / Alternatives Considered
A magnitude-based threshold was considered — for example, suppressing the disagreement flag when both
probabilities sit near the same side of the 0.5 decision boundary (e.g. 0.48 and 0.52), on the
reasoning that the two models "agree in spirit" even when formally landing in different categorical
buckets. This was rejected for two reasons:
1. It would introduce an arbitrary, untuned parameter not grounded in either model's calibration
   properties, which differ meaningfully between a tree-based ensemble and a model calibrated by
   construction via the logistic link function. Comparing raw probability differences across
   differently-calibrated classifiers risks the same methodological problem identified in
   Niculescu-Mizil and Caruana (2005) regarding probability calibration differences across learning
   algorithm families — and is the same reasoning that rules out pooling RF and LR probabilities
   directly (ADR-030).
2. The categorical `risk_label` is the actual user-facing decision artefact. What matters
   operationally is whether the two models would lead a business owner or analyst to a different
   practical conclusion, not how numerically close the underlying probabilities happened to be.

### Consequences
- *Positive:* Simple, deterministic, fully explainable rule; introduces no unvalidated tunable
  parameter; usable directly as an institutional monitoring metric.
- *Negative / Tradeoffs:* Near-boundary cases (e.g. 0.49 vs. 0.51) register as full disagreement
  despite being numerically close. This is a known, accepted limitation that should be named
  explicitly in Chapter 4/5 discussion, not treated as a defect.

**Related Sessions:** 111, 118
**Related ADRs:** ADR-027, ADR-030

---

## ADR-030: Institutional Aggregation Restricted to Random Forest Only

**Date:** 2026-06
**Status:** Accepted
**Session:** 23, 118

### Context
Institutional analytics (sector distress rates, monthly trend lines, anomaly flags, ratio averages by
outcome) aggregate across many SMEs and require a single coherent probability per assessment. Pooling
two differently-calibrated classifiers' outputs into the same aggregate — for example, averaging an
RF probability and an LR probability together, or counting both as separate "assessments" in a total
— would be statistically incoherent and would silently double-count.

### Decision
All institutional-facing aggregate statistics are computed exclusively from Random Forest predictions.
The dedicated Model Performance view is the sole deliberate exception, where RF and LR are shown
side-by-side specifically for comparison rather than aggregation.

### Rationale
Builds directly on the PR-AUC justification in ADR-028 (Saito and Rehmsmeier, 2015) for treating
Random Forest as the single coherent reference classifier, and on the calibration-incompatibility
reasoning in ADR-029 (Niculescu-Mizil and Caruana, 2005) for why the two models' raw outputs cannot
be pooled.

### Consequences
- *Positive:* Every institutional metric outside the dedicated model-performance view is internally
  consistent and traceable to one classifier and one calibration regime, simplifying the academic
  narrative around aggregate claims.
- *Negative / Tradeoffs:* Institutional users lose visibility into Logistic Regression's perspective
  except in the one dedicated comparison view. This is judged acceptable because LR's primary value is
  diagnostic (recall on rare distressed cases at the individual-assessment level) rather than
  aggregate-monitoring-relevant.

**Related Sessions:** 23, 118
**Related ADRs:** ADR-027, ADR-028, ADR-029

---

## ADR-031: Combined Dual-Model Report Export Architecture

**Date:** 2026-06
**Status:** Accepted
**Session:** 120–123

### Context
Following the dual-model migration, the PDF/CSV/ZIP export pipeline remained
single-model only — built against a single `prediction_id`. This created a structural mismatch: a
user's history and dashboard views operated on assessments, but clicking Export still silently
referenced one arbitrary `Prediction` row, omitting the second model's result entirely. This was
deliberately deferred during Sessions 111–118 so it could be scoped and implemented in isolation.

### Decision
New assessment-level export functions and endpoints (`/api/reports/assessment/{ratio_feature_id}*`)
were introduced, generating combined PDF/CSV/ZIP artefacts that:
- Render the shared financial ratio table once (ratios are identical regardless of which model is
  being viewed),
- Render Random Forest first (primary) and Logistic Regression second (secondary), consistent with
  ADR-028,
- Include an explicit disagreement notice when the two models categorically disagree (ADR-029's
  rule), and
- Render a graceful "model did not complete" notice for partial-failure assessments rather than
  failing the export outright.

The pre-existing single-model export functions and endpoints were deliberately left untouched and
purely additive during the migration window (Session 120), then removed entirely (Session 123) only
after every frontend caller (`ExportModal.tsx`, the Reports page preview flow, the Predict page
preview flow) was confirmed migrated via a repository-wide audit. The existing `Report` table's
`prediction_id` foreign key was reused without a schema migration, by anchoring each assessment-level
report to the Random Forest prediction row when available, falling back to Logistic Regression
otherwise.

### Alternatives Considered
1. *A new `ratio_feature_id`-keyed `Report` schema, requiring a migration.* Rejected as an unnecessary
   schema-risk increase relative to the achievable zero-migration anchoring strategy, particularly
   given the project's hardware and time constraints.
2. *Immediate deletion of the single-model endpoints upon introducing the assessment-level ones.*
   Rejected in favour of a staged, audited deprecation, consistent with the project's established
   precedent (Session 111) of preserving legacy endpoints until full frontend wiring is confirmed.

### Consequences
- *Positive:* Exports now faithfully mirror the live dual-model UI; zero database migration risk;
  staged removal eliminated dead code only once independently verified safe via a full-repository
  reference search.
- *Negative / Tradeoffs:* CSV exports deliberately omit narrative text to preserve strict tabular
  structure (the PDF remains the canonical narrative artefact) — the CSV alone is therefore not a
  complete standalone substitute for the PDF. This is a documented design choice, not an oversight.

**Related Sessions:** 120, 121, 122, 123
**Related ADRs:** ADR-027, ADR-028, ADR-029
