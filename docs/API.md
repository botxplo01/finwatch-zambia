# FinWatch Zambia — API Reference

Complete reference for all registered FastAPI endpoints. All routes use the flat `/api/` prefix — versioned prefixes (`/api/v1/`) are permanently forbidden.

**Base URL (production):** `https://finwatch-backend.onrender.com`
**Base URL (local):** `http://localhost:8000`

**Auth header format:** `Authorization: Bearer <token>`
- SME portal token: read from localStorage / Capacitor Preferences key `token`
- Institutional portal token: read from localStorage / Capacitor Preferences key `inst_token`

**Critical note on login:** The email address must be sent in the `username` field of the OAuth2PasswordRequestForm — not `email`. This is an OAuth2 convention, not a bug.

---

## 1. Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/auth/register` | None | Register a new SME user. Triggers 2-step OTP email verification. Supports `title` and `business_scale`. |
| POST | `/auth/login` | None | Exchange credentials for a JWT. Email sent as `username` field (OAuth2 form). |
| POST | `/auth/verify` | None | Complete OTP verification after registration. Returns access token + full user object on success. Transactional — rolls back completely on failure. |
| POST | `/auth/resend` | None | Resend OTP verification email. Rate limited. |
| POST | `/auth/check-email` | None | Check if an email is available during registration. Used for early validation during onboarding step transitions. |
| GET | `/auth/me` | Bearer (SME/Inst) | Fetch the authenticated user's full profile including `business_scale`, `role`, `onboarding_complete`. Authoritative source — used as cold-launch fallback. |
| PUT | `/auth/me` | Bearer (SME/Inst) | Update profile fields or mark `onboarding_complete: true`. |
| POST | `/auth/profile-picture` | Bearer (SME/Inst) | Upload or adjust profile picture. Saves both original and cropped versions for non-destructive re-cropping. |
| DELETE | `/auth/remove-picture` | Bearer (SME/Inst) | Remove user profile pictures. |
| POST | `/auth/logout` | Bearer (SME/Inst) | Revoke the current session. |
| GET | `/auth/sessions` | Bearer (SME/Inst) | List all active sessions for the authenticated user including platform, last active, expires at. |
| DELETE | `/auth/sessions/{jti}` | Bearer (SME/Inst) | Revoke a specific session (remote logout from another device). |
| DELETE | `/auth/me` | Bearer (SME/Inst) | Permanently delete the user account and all associated data. Irreversible. |

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
| DELETE | `/companies/{id}` | Bearer (SME) | Permanently remove a company and all its associated records and predictions. Cascade delete. |
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
  "shap_values_json": "{}",
  "narrative": "string",
  "predicted_at": "datetime"
}
```
Errors: 503 (ML models not loaded — run `python ml/train.py`), 400 (duplicate period)
Notes: RF result is always authoritative. `DISTRESS_CLASS_INDEX=1` throughout the pipeline.

---

## 4. NLP Assistants — `/api/chat`, `/api/institutional/chat`, `/api/docs/chat`

All chat endpoints enforce rolling-window rate limits tracked in `AIUsageLog` (UTC timestamps).

| Method | Endpoint | Auth | Limit | Description |
|:---|:---|:---|:---|:---|
| GET | `/chat/status` | Bearer (SME) | — | Check SME chat usage and cooldown time remaining. |
| POST | `/chat/` | Bearer (SME) | 10 msg / 2 hrs | SME portal AI assistant (FinWatch AI). |
| GET | `/institutional/chat/status` | Bearer (Inst) | — | Check institutional chat usage and cooldown time. |
| POST | `/institutional/chat/` | Bearer (Inst) | 10 msg / 2 hrs | Institutional portal AI assistant (Regulator/Analyst AI). |
| POST | `/docs/chat/` | Bearer (Any) | 15 msg / 2 hrs | Documentation system AI assistant. |

---

## 5. Institutional Analytics — `/api/institutional`

All institutional endpoints require the Institutional portal Bearer token (`inst_token`). All data is aggregate and anonymised.

**Risk tier thresholds:**
- High Risk: `distress_probability >= 0.70`
- Medium Risk: `0.40 <= distress_probability < 0.70`
- Low Risk: `distress_probability < 0.40`

| Method | Endpoint | Role Required | Description |
|:---|:---|:---|:---|
| GET | `/institutional/overview` | Any institutional | Headline KPIs for the dashboard. |
| GET | `/institutional/sectors` | Any institutional | Aggregate distress rates grouped by industry sector. |
| GET | `/institutional/scales` | Any institutional | Distress patterns segmented by SME business scale (Small vs Medium). |
| GET | `/institutional/trends` | Any institutional | Monthly distress time-series over the last 12 months. |
| GET | `/institutional/risk-distribution` | Any institutional | Count and percentage of assessments in each risk tier. |
| GET | `/institutional/model-performance` | Any institutional | Aggregate assessment counts per model (RF vs LR). |
| GET | `/institutional/anomalies` | `regulator` only | Anonymised high-risk flags (probability >= 0.70). |
| GET | `/institutional/reports/preview` | Any institutional | JSON preview of full report data including optional AI synthesis. |
| GET | `/institutional/export/pdf` | Any institutional | Download institutional aggregate report as PDF. |
| GET | `/institutional/export/csv` | Any institutional | Download aggregate report as CSV. |
| GET | `/institutional/export/json` | Any institutional | Download aggregate report as JSON. |
| GET | `/institutional/export/zip` | Any institutional | Download PDF + CSV + JSON bundled as ZIP. |

---

## 6. Reports — `/api/reports`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/reports/` | Bearer (SME) | List all generated PDF assessment reports. |
| POST | `/reports/` | Bearer (SME) | Generate a new PDF report for a specific prediction. |
| GET | `/reports/{id}` | Bearer (SME) | Download a specific report PDF. |

---

## 7. QR Authentication — `/api/auth/qr`

| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/auth/qr/generate` | Bearer (Any) | Generate a one-time QR session token for Scan-to-Login. |
| POST | `/auth/qr/scan` | None | Complete QR Scan-to-Login by consuming the token. |

---

## Error Reference

| Status | Meaning | Common Causes |
|:---|:---|:---|
| 400 | Bad Request | Duplicate period, invalid OTP, already verified |
| 401 | Unauthorized | Missing or expired token, revoked session |
| 403 | Forbidden | Resource owned by another user, insufficient role |
| 404 | Not Found | Resource does not exist |
| 422 | Unprocessable Entity | Pydantic validation failure |
| 429 | Too Many Requests | AI chat rate limit exceeded |
| 503 | Service Unavailable | ML models not loaded or Groq API down |
