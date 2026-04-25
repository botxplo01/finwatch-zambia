# API Reference: FinWatch Zambia

This document lists the core endpoints available in the FinWatch FastAPI backend. All endpoints are prefixed with `/api`.

## 1. Authentication (`/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/auth/register` | Register a new SME Owner or Analyst. |
| **POST** | `/auth/login` | Exchange credentials for a JWT. Uses Form Data. |
| **GET** | `/auth/me` | Fetch the current logged-in user profile. |

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
| **POST** | `/predictions/` | Run a new distress assessment (requires raw financials). |
| **GET** | `/predictions/` | List history of predictions (filterable by company). |
| **GET** | `/predictions/{id}` | Get full SHAP explainability and NLP narrative for a result. |

## 4. NLP Assistant (`/chat`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/chat/` | SME Chat: Ask questions about specific prediction results. |
| **POST** | `/regulator/chat/` | Regulator Chat: Ask about sector trends and anomalies. |

## 5. Regulatory Portal (`/regulator`)
*Requires `regulator` or `policy_analyst` role.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/regulator/sectors` | Aggregate distress rates grouped by industry. |
| **GET** | `/regulator/trends` | Time-series data of national SME health. |
| **GET** | `/regulator/anomalies` | Identify companies with sudden high-probability shifts. |

## 6. Reports (`/reports`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/reports/export` | Generate PDF/CSV/ZIP reports for specific time ranges. |
