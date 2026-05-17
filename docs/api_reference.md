# API Reference: FinWatch Zambia

This document lists the core endpoints available in the FinWatch FastAPI backend. All endpoints are prefixed with `/api`.

## 1. Authentication (`/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/auth/register` | Register a new SME Owner or Analyst/Regulator. Supports `title`. |
| **POST** | `/auth/login` | Exchange credentials for a JWT. |
| **GET** | `/auth/me` | Fetch the current logged-in user profile (includes `title`). |
| **PUT** | `/auth/me` | Update user profile (Name, Email). |
| **POST** | `/auth/profile-picture` | Upload/Adjust profile picture (saves original + cropped). |
| **DELETE** | `/auth/remove-picture` | Remove user profile pictures. |
| **DELETE** | `/auth/me` | Permanently delete the user account and all data. |

## 2. Companies (`/companies`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/companies/` | List all companies owned by the user. |
| **POST** | `/companies/` | Register a new SME entity. |
| **GET** | `/companies/{id}` | Get detailed data for a specific company. |
| **PATCH** | `/companies/{id}` | Update company metadata (Industry, etc.). |
| **DELETE** | `/companies/{id}` | Permanently remove a company and its history. |

## 3. Predictions (`/predictions`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/predictions/` | Run a new distress assessment (supports manual entry or re-use). |
| **GET** | `/predictions/` | List history. Supports filters: `risk`, `status`, `model`, `start_date`, `end_date`. |
| **POST** | `/predictions/extract` | Extract financial metrics from uploaded PDF/Excel/CSV files. |
| **GET** | `/predictions/{id}` | Get full SHAP explainability and NLP narrative for a result. |

## 4. NLP Assistant (`/chat`)
*Rate limited: 10 messages per 2 hours.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/chat/status` | Check SME chat usage limits and cooldown time. |
| **POST** | `/chat/` | SME Chat: Ask questions about specific prediction results. |
| **GET** | `/regulator/chat/status` | Check Regulator chat usage limits and cooldown. |
| **POST** | `/regulator/chat/` | Regulator Chat: Ask about systemic trends and anomalies. |

## 5. Regulatory Portal (`/regulator`)
*Requires `regulator` or `policy_analyst` role.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/regulator/overview` | High-level system KPIs (Total assessments, distress rate, etc.). |
| **GET** | `/regulator/sectors` | Aggregate distress rates and ratios grouped by industry. |
| **GET** | `/regulator/trends` | Time-series data of national SME health. |
| **GET** | `/regulator/risk-distribution` | Breakdown of assessments across risk tiers. |
| **GET** | `/regulator/model-performance` | Accuracy and usage stats for RF vs LR models. |
| **GET** | `/regulator/anomalies` | Identify companies with sudden high-probability shifts. |
| **GET** | `/regulator/export/{format}` | Export system-wide data in PDF, CSV, JSON, or ZIP. |

## 6. Reports (`/reports`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/reports/` | List all generated PDF assessment reports. |
| **POST** | `/reports/` | Generate a new PDF report for a specific prediction. |
| **GET** | `/reports/{id}` | Download a specific report file. |
