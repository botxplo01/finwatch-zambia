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
