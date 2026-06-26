# FinWatch Zambia — API Reference

Complete reference for all registered FastAPI endpoints. All routes use the flat `/api/` prefix — versioned prefixes (`/api/v1/`) are permanently forbidden.

**Base URL (production):** `https://finwatch-backend.onrender.com`
**Base URL (local):** `http://localhost:8000`

**Auth header format:** `Authorization: Bearer <token>`
- SME portal token: read from localStorage / Capacitor Preferences key `token`
- Institutional portal token: read from localStorage / Capacitor Preferences key `reg_token`

**Critical note on login:** The email address must be sent in the `username` field of the OAuth2PasswordRequestForm — not `email`. This is an OAuth2 convention, not a bug.

**Institutional API prefix:** All institutional analytics, reporting, and chat endpoints use `/api/institutional` (unified in Session 38). The public portal URLs are `/regulator/*` and `/analyst/*` — these are frontend routes, not API routes.

---

## 1. Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/auth/register` | None | Register a new SME user. Triggers 2-step OTP email verification. Supports `title` and `business_scale`. |
| POST | `/auth/login` | None | Exchange credentials for a JWT. Email sent as `username` field (OAuth2 form). |
| POST | `/auth/verify` | None | Complete OTP verification after registration. Transactional — rolls back completely on failure. Returns access token + full user object on success. |
| POST | `/auth/resend` | None | Resend OTP verification email. Rate limited. |
| POST | `/auth/check-email` | None | Check if an email is available during registration. Used for early validation during onboarding step transitions. |
| GET | `/auth/me` | Bearer (SME) | Fetch the authenticated user's full profile including `business_scale`, `role`, `onboarding_complete`. Authoritative source — used as cold-launch fallback in `PredictPage.tsx`. |
| PUT | `/auth/me` | Bearer (SME) | Update profile fields or mark `onboarding_complete: true`. |
| POST | `/auth/profile-picture` | Bearer (SME) | Upload or adjust profile picture. Saves both original and cropped versions for non-destructive re-cropping. |
| DELETE | `/auth/remove-picture` | Bearer (SME) | Remove user profile pictures. |
| POST | `/auth/logout` | Bearer (SME) | Revoke the current session. |
| GET | `/auth/devices` | Bearer (SME) | List all active sessions for the authenticated user. |
| DELETE | `/auth/devices/{session_id}` | Bearer (SME) | Revoke a specific session (remote logout from another device). |
| DELETE | `/auth/me` | Bearer (SME) | Permanently delete the user account and all associated data. Irreversible. |

### Key Request / Response Details

**POST /auth/register**
```json
{
  "full_name": "string",
  "email": "string",
  "password": "string",
  "title": "string | null",
  "business_scale": "small_scale | medium_scale"
}
```
Response: `{ "message": "Verification email sent" }`
Errors: 400 (email already registered), 422 (validation)

**POST /auth/login**
Request: OAuth2PasswordRequestForm — `username` (email value), `password`
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": { "id", "email", "role", "business_scale", "onboarding_complete", ... }
}
```

**POST /auth/verify**
```json
{ "email": "string", "otp": "string (5 digits)" }
```
Response: Same as `/auth/login` — access token + full user object.
Errors: 400 (invalid or expired OTP)

---

## 2. Companies — `/api/companies`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/companies/` | Bearer (SME) | List all companies owned by the authenticated user. |
| POST | `/companies/` | Bearer (SME) | Register a new SME entity. Name is regex-validated. Registration number must be exactly 12 digits. |
| GET | `/companies/{id}` | Bearer (SME) | Get detailed data for a specific company. |
| PATCH | `/companies/{id}` | Bearer (SME) | Update company metadata (industry, name, etc.). |
| DELETE | `/companies/{id}` | Bearer (SME) | Permanently remove a company and all associated records and predictions. Cascade delete. |
| POST | `/companies/{id}/records` | Bearer (SME) | Submit a new financial record for a company. Returns computed ratios. |

### Key Request / Response Details

**POST /companies/**
```json
{
  "name": "string (regex validated)",
  "registration_number": "string (exactly 12 digits)",
  "industry": "string | null"
}
```
Errors: 400 (duplicate name or registration number), 422 (validation)

**POST /companies/{id}/records**
```json
{
  "period": "YYYY or YYYY-QX (2010 to present)",
  "current_assets": "float",
  "current_liabilities": "float",
  "total_assets": "float (must be > 0)",
  "total_liabilities": "float",
  "total_equity": "float",
  "inventory": "float",
  "cash_and_equivalents": "float",
  "retained_earnings": "float (can be negative)",
  "revenue": "float",
  "net_income": "float (can be negative)",
  "ebit": "float (can be negative)",
  "interest_expense": "float"
}
```
Errors: 400 (duplicate period for this company), 422 (validation)

---

## 3. Predictions — `/api/predictions`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/predictions/` | Bearer (SME) | Run a new distress assessment. Query params: `company_id`, `record_id`, `model_name`. |
| GET | `/predictions/` | Bearer (SME) | List prediction history with server-side pagination. Filters: `company_id`, `risk_level`, `outcome_status`, `model`, `date_from` (ISO), `date_to` (ISO), `limit`, `offset`. |
| GET | `/predictions/{id}` | Bearer (SME) | Get full prediction including SHAP values, NLP narrative, and raw financial inputs. |
| POST | `/predictions/extract-data` | Bearer (SME) | Extract financial metrics from uploaded PDF, CSV, XLSX, or XLS files. |

### Key Request / Response Details

**POST /predictions/**
Query parameters: `company_id=int`, `record_id=int`, `model_name=random_forest|logistic_regression`
```json
{
  "id": "int",
  "risk_label": "Healthy | Distressed",
  "distress_probability": "float",
  "model_used": "random_forest | logistic_regression",
  "assessment_methodology": "full | indicative",
  "shap_values_json": "{}",
  "narrative": "string",
  "predicted_at": "datetime"
}
```
Errors: 503 (ML models not loaded), 400 (duplicate period)
Notes: RF result is always authoritative. `DISTRESS_CLASS_INDEX=1` (from `app.core.constants`). `assessment_methodology` is immutably set at prediction time by the Hybrid Methodology Lock.

**POST /predictions/extract-data**
Request: `multipart/form-data` — one or more files in the `files` field. Accepted: PDF, CSV, XLSX, XLS.
Response: Flat JSON of extracted financial fields. Fields not found in the document are omitted.
Notes: Uses `EXTRACTION_GROQ_API_KEY` (separate quota from `GROQ_API_KEY`).

---

## 4. NLP Assistants — `/api/chat`, `/api/institutional/chat`, `/api/docs/chat`

All chat endpoints enforce rolling-window rate limits tracked in `AIUsageLog` (UTC timestamps). Rolling window — not fixed interval reset.

| Method | Endpoint | Auth | Limit | Description |
|:---|:---|:---|:---|:---|
| GET | `/chat/status` | Bearer (SME) | — | Check SME chat usage and cooldown time remaining. |
| POST | `/chat/` | Bearer (SME) | 10 msg / 2 hrs | SME portal AI assistant (FinWatch AI). Can reference a specific prediction by ID. |
| GET | `/institutional/chat/status` | Bearer (Institutional) | — | Check institutional chat usage and cooldown time. |
| POST | `/institutional/chat/` | Bearer (Institutional) | 10 msg / 2 hrs | Institutional portal AI assistant. Responds to sector trend and anomaly questions. Role-aware: "Regulator AI" or "Policy Analyst AI". |
| POST | `/docs/chat/` | Bearer (SME or Institutional) | 15 msg / 2 hrs | Documentation system AI assistant. Separate limit from portal assistants. |

### Key Request / Response Details

**POST /chat/** and **POST /institutional/chat/**
```json
{ "message": "string", "prediction_id": "int | null" }
```
Response: `{ "response": "string", "messages_remaining": int }`
Errors: 429 (rate limit exceeded — includes cooldown_seconds in response)

---

## 5. Institutional Analytics — `/api/institutional`

All institutional endpoints require the Institutional portal Bearer token (`reg_token`). All data is aggregate and anonymised — individual SME identities are never exposed to any role.

**Risk tier thresholds (consistent across all endpoints, reports, and exports):**
- High Risk: `distress_probability >= 0.70`
- Medium Risk: `0.40 <= distress_probability < 0.70`
- Low Risk: `distress_probability < 0.40`

Defined as module-level constants in `backend/app/api/institutional.py` and imported by `institutional_report_service.py`. Never hardcode these thresholds elsewhere.

| Method | Endpoint | Role Required | Description |
|:---|:---|:---|:---|
| GET | `/institutional/overview` | Any institutional | Headline KPIs — total assessments, distress rates, risk tier counts, sector coverage, scale counts. |
| GET | `/institutional/sectors` | Any institutional | Aggregate distress rates and ratio averages grouped by industry sector. Sorted by distress rate descending. |
| GET | `/institutional/scales` | Any institutional | Distress patterns segmented by SME business scale (Small vs Medium) and assessment methodology. |
| GET | `/institutional/trends` | Any institutional | Monthly distress time-series over the last 12 months. Dialect-aware date formatting. |
| GET | `/institutional/risk-distribution` | Any institutional | Count and percentage of assessments in each risk tier (High / Medium / Low). |
| GET | `/institutional/model-performance` | Any institutional | Aggregate assessment counts and avg probabilities per model (RF vs LR). |
| GET | `/institutional/anomalies` | `regulator` only | Anonymised high-risk flags (probability >= 0.70). Not accessible to `policy_analyst`. |
| GET | `/institutional/reports/preview` | Any institutional | JSON preview of full report data including optional AI synthesis. Query param: `include_ai_summary` (bool). |
| GET | `/institutional/export/pdf` | Any institutional | Download institutional aggregate report as PDF. Params: `include_ai_summary`, `mask_entities`. Header: `X-User-Time`. |
| GET | `/institutional/export/csv` | Any institutional | Download aggregate report as CSV (UTF-8 BOM encoded). |
| GET | `/institutional/export/json` | Any institutional | Download aggregate report as JSON. |
| GET | `/institutional/export/zip` | Any institutional | Download PDF + CSV + JSON bundled as ZIP. Header: `X-User-Time`. |

### Role-Based Data Access

| Data | `regulator` | `policy_analyst` |
|:---|:---|:---|
| Aggregate analytics | ✅ Full | ✅ Full |
| Anomaly flags | ✅ With assessment IDs | ❌ No access |
| Entity names in reports | ✅ Real names (opt-in) | ✅ Auto-masked to `SME-XXXXXX` hash |
| Export formats | ✅ All | ✅ All |

### Portal vs API URL Distinction

| Layer | Regulator | Policy Analyst |
|:---|:---|:---|
| Frontend public URL | `/regulator/*` | `/analyst/*` |
| Backend API prefix | `/api/institutional/*` | `/api/institutional/*` |
| Auth token | `reg_token` | `reg_token` |
| Theme | Emerald (`#10b981`) | Blue (`#2563eb`) |

Both roles share the same API. Role-specific behaviour (entity masking, anomaly access) is enforced server-side based on the JWT `role` claim.

---

## 6. Reports — `/api/reports`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/reports/` | Bearer (SME) | List all generated PDF assessment reports for the authenticated user. |
| DELETE | `/reports/{report_id}` | Bearer (SME) | Clear a report history entry and delete the associated PDF file. |
| POST | `/reports/assessment/{ratio_feature_id}` | Bearer (SME) | Generate and save a combined dual-model PDF assessment report. |
| GET | `/reports/assessment/{ratio_feature_id}` | Bearer (SME) | Download the saved PDF for an assessment. |
| GET | `/reports/assessment/{ratio_feature_id}/csv` | Bearer (SME) | Generate and stream a dual-model CSV export. |
| GET | `/reports/assessment/{ratio_feature_id}/zip` | Bearer (SME) | Generate and stream a ZIP bundle (PDF + CSV). |

### Notes
- PDF engine: ReportLab only. `CondPageBreak(7 * cm)` throughout — never unconditional `PageBreak()`.
- Reports include: SHAP chart, financial ratio table, NLP narrative, FinWatch logo header, Markdown rendering, assessment methodology label (INDICATIVE / FULL).
- Dual-model PDF renders Random Forest first (primary), Logistic Regression second (collapsible secondary). A disagreement banner is shown when both models complete with differing classifications.
- Reports are owned by the authenticated user — a user cannot access another user's report IDs.


---

## 7. QR Authentication — `/api/qr`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/qr/generate` | Bearer (SME or Institutional) | Generate a one-time QR session token for Scan-to-Login. Returns `qr_token` and `expires_at`. |
| POST | `/qr/scan` | None (token carries auth) | Complete QR Scan-to-Login by consuming the one-time token. Returns full session response. |

### Notes
- Portal isolation enforced — SME QR tokens bridge to SME sessions only. Institutional to Institutional only.
- Tokens are one-time use — consumed and invalidated immediately on successful scan.
- New native login via QR revokes any existing primary native session on the same platform.
- `settings` must be explicitly imported in `qr_auth.py` — variable shadowing caused Session 28 `NameError`.

---

## 8. Administration — `/api/admin`

Restricted to users with `is_admin=True`. Not documented here — admin operations are out of scope for standard development and agent operations.

---

## Error Reference

| Status | Meaning | Common Causes |
|:---|:---|:---|
| 400 | Bad Request | Duplicate period, duplicate company, invalid OTP, already verified, regulated sector restriction |
| 401 | Unauthorized | Missing or expired token, revoked session (`jti` not in `UserDeviceSession`) |
| 403 | Forbidden | Resource owned by another user, insufficient role (e.g. `policy_analyst` hitting `/institutional/anomalies`) |
| 404 | Not Found | Resource does not exist |
| 422 | Unprocessable Entity | Pydantic validation failure — check request body schema |
| 429 | Too Many Requests | AI chat rate limit exceeded — response includes `cooldown_seconds` |
| 503 | Service Unavailable | ML models not loaded — run `python ml/train.py` and restart |
