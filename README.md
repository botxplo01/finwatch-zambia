# FinWatch Zambia

> **ML-Based Financial Distress Prediction System for Zambian SMEs**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-F7931E.svg)](https://scikit-learn.org/)

---

## Overview

**FinWatch Zambia** is a production-deployed, full-stack machine learning system designed to predict financial distress in Small and Medium Enterprises (SMEs) within Zambia. It features a dual-portal architecture serving both business owners and regulators, combining classical financial ratio analysis with SHAP-based explainability and a multi-tier NLP narrative engine that translates complex model outputs into actionable plain-language insights.

Developed as a Bachelor of Science in Computing (BSc BCOM) dissertation project at **Cavendish University Zambia**, 2026.

---

## Key Features

- **Dual-Portal Architecture**
  - **SME Portal**: Company profile management, financial data submission, interpreted risk assessments, SHAP-driven explanations, and downloadable reports.
  - **Regulator Portal**: Aggregate sector analytics, monthly distress trends, anomaly detection, cross-sector ratio benchmarking, and full data exports (PDF, CSV, JSON).

- **Explainable AI (XAI)**: Per-prediction SHAP attributions (TreeExplainer for Random Forest, LinearExplainer for Logistic Regression) and global feature importance rankings. RF predictions take precedence over LR on model disagreement.

- **Multi-Tier NLP Narrative Engine**: Groq API (`llama-3.1-8b-instant`) → Ollama Cloud (`kimi-k2.5:cloud`) → Ollama Local primary (`granite4:3b`) → Ollama Local fallback (`gemma3:1b`) → deterministic f-string template. Narratives are cached by prediction hash. Serves both `/api/chat` (SME) and `/api/regulator/chat` (regulator) endpoints.

- **Dialect-Aware Database Layer**: A dynamic dialect checker automatically selects `func.to_char` for PostgreSQL and `func.strftime` for SQLite. All complex multi-table queries (Predictions, Ratios, Records, Companies) use explicit `.select_from()` and unambiguous join paths, ensuring full compatibility across both environments.

- **Hardened Validation**: Strict regex-based company name and 12-digit registration number enforcement. Date-aware reporting periods (YYYY or YYYY-QX, 2010–present). Cascade delete on Company (all-delete-orphan).

- **4-State Connection Feedback**: Login and register pages implement idle → waking → success → error connection lifecycle with auto-clearing success indicators, providing clear server wake feedback for the Render cold-start delay.

- **Production Resilience**: Integrated `ErrorBoundary` for crash isolation and `LoadingSpinner` for consistent async feedback across all data-fetching views.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14.2.5 (App Router) · TypeScript | Page routing, role-aware layouts, SSR |
| **Styling** | Tailwind CSS · shadcn/ui · Lucide · Recharts | UI components, charting, responsive design |
| **Backend** | FastAPI (Python 3.12) · Uvicorn | High-performance REST API, Pydantic validation |
| **ORM** | SQLAlchemy 2.0 · Alembic | Database abstraction and migrations |
| **Database** | PostgreSQL via Supabase (prod) · SQLite WAL (local) | Dialect-aware persistence layer |
| **ML / XAI** | scikit-learn · SHAP · SMOTE | RF + LR classifiers, explainability, class balancing |
| **NLP** | Groq API · Ollama · f-string template | Multi-tier narrative and chat generation |
| **Auth** | JWT via python-jose · bcrypt 3.2.2 | Stateless authentication, role-based access |
| **Reports** | ReportLab | Server-side PDF generation |
| **Deployment** | Vercel (frontend) · Render (backend) | Hybrid cloud with auto-wake logic |

---

## Architecture

### Role-Based Access Control (RBAC)

Three roles govern system access, with isolated token storage to prevent cross-portal session contamination:

| Role | Access | Token Keys |
|---|---|---|
| `sme_owner` | SME portal — own companies and predictions only | `token` / `user` |
| `policy_analyst` | Regulator portal — read-only analytics | `reg_token` / `reg_user` |
| `regulator` | Regulator portal — full analytics and data export | `reg_token` / `reg_user` |

### 10 Financial Ratios

All ratios are defined in `ratio_engine.py` as the single source of truth. The NLP service imports from it directly — no duplication.

| # | Ratio | Category |
|---|---|---|
| 1 | Current Ratio | Liquidity |
| 2 | Quick Ratio | Liquidity |
| 3 | Cash Ratio | Liquidity |
| 4 | Debt-to-Equity | Leverage |
| 5 | Debt-to-Assets | Leverage |
| 6 | Interest Coverage | Leverage |
| 7 | Net Profit Margin | Profitability |
| 8 | Return on Assets | Profitability |
| 9 | Return on Equity | Profitability |
| 10 | Asset Turnover | Activity |

### ML Pipeline

- **Dataset**: UCI Polish Companies Bankruptcy (`3year.arff`, 10,503 records)
- **Contextual validation**: World Bank Zambia Enterprise Survey 2019–2020
- **Split**: Stratified train/test → SMOTE applied post-split on training set only → StandardScaler fit on SMOTE output
- **Models**: Logistic Regression and Random Forest (`RANDOM_STATE=42`)
- **Explainability**: `DISTRESS_CLASS_INDEX=1` consistent across `ml_service`, `evaluate.py`, and `explain.py`
- **Artifacts**: Baked into Docker image for production deployment

### System Layers

```
Presentation Layer   →   Next.js App Router · shadcn/ui · Recharts
Service Layer        →   Validation · Ratio Engine · Workflow APIs
Model Layer          →   Logistic Regression · Random Forest · SHAP Explainer
NLP Layer            →   Groq → Ollama Cloud → Ollama Local → Template
Persistence Layer    →   SQLAlchemy ORM · Alembic · PostgreSQL / SQLite
```

---

## Project Structure

```
finwatch-zambia/
├── backend/
│   ├── app/
│   │   ├── api/                # Routers: auth, predictions, chat, regulator, regulator_chat
│   │   ├── core/               # JWT security, dependencies, global config
│   │   ├── db/                 # Engine and dialect-aware session management
│   │   ├── models/             # SQLAlchemy ORM — 7 core tables
│   │   ├── schemas/            # Pydantic request/response validation
│   │   └── services/           # ML, NLP, ratio engine, report, regulator report services
│   ├── migrations/             # Alembic (render_as_batch=True, offline + online)
│   ├── ml/                     # Preprocessing, training pipeline, model artifacts
│   └── tests/                  # Pytest suite (203+ passing tests)
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/             # Login / Register with 4-state connection feedback
│   │   ├── (dashboard)/        # SME portal: predict, companies, history, reports, settings
│   │   └── (regulator)/        # Regulator portal: trends, insights, anomalies, chat
│   ├── components/
│   │   ├── dashboard/          # SME-specific UI components
│   │   ├── regulator/          # Charting and analytical components
│   │   ├── shared/             # ErrorBoundary, LoadingSpinner, NLPChatModal
│   │   └── ui/                 # shadcn/ui base primitives
│   └── lib/                    # API client, auth state, utility functions
│
├── data/                       # Dataset documentation (git-ignored)
├── notebooks/                  # EDA, SHAP analysis, evaluation plots
├── docs/                       # Architecture diagrams, API reference
└── scripts/                    # Database seeding and setup utilities
```

---

## Getting Started (Local Development)

### Prerequisites

- Python 3.12.x
- Node.js 18+
- Git

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm config set legacy-peer-deps true
npm install
npm run dev
```

### 3. Environment Variables

**`backend/.env`**
```env
SECRET_KEY=<min-32-character-secret>      # Rejects placeholder values at startup
DATABASE_URL=sqlite:///./finwatch.db      # Or PostgreSQL connection string
APP_NAME=FinWatch Zambia
APP_VERSION=1.0.0
DEBUG=true
GROQ_API_KEY=<your-groq-api-key>
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Note**: Delete `finwatch.db` and re-register when testing from a clean state to avoid stale accounts. Never run `npm audit fix --force` — it force-upgrades to Next 16 and breaks peer dependencies.

---

## Deployment

| Service | URL |
|---|---|
| Frontend (Vercel) | https://finwatch-zambia.vercel.app |
| Backend (Render) | https://finwatch-backend.onrender.com |

The backend uses `RENDER=true` environment variable to activate PostgreSQL dialect logic. The frontend implements auto-wake handling for Render's cold-start delay via the 4-state connection indicator on the auth pages.

---

## ORM Data Model

7 core SQLAlchemy models with full referential integrity:

| Model | Key Constraints |
|---|---|
| `User` | `role` (`sme_owner` server default), `last_login_at` |
| `Company` | Cascade delete (all-delete-orphan), regex-validated name + 12-digit reg number |
| `FinancialRecord` | `UniqueConstraint(company_id, period)` |
| `RatioFeature` | FK to FinancialRecord |
| `Prediction` | `UniqueConstraint(ratio_feature_id, model_used)` |
| `Narrative` | FK to Prediction, cached by prediction hash |
| `Report` | FK to Company |

---

## Known Dependency Constraints

| Dependency | Constraint | Reason |
|---|---|---|
| `bcrypt` | Pinned at `3.2.2` | passlib 1.7.4 incompatible with bcrypt 4.x |
| `eslint` | Pinned at `^8.57.0` | eslint-config-next must match Next.js 14.2.5 |
| `next` | `14.2.5` | Peer dependency anchor for shadcn/ui and ESLint config |

---

## Research Context

| Field | Detail |
|---|---|
| Institution | Cavendish University Zambia |
| Programme | Bachelor of Science in Computing (BSc BCOM) |
| Course Code | COM421 — Dissertation |
| Year | 2026 |
| Methodology | Design Science Research (DSR) |
| Dataset | UCI Polish Companies Bankruptcy (DOI: 10.24432/C5V61K) |
| Contextual Data | World Bank Zambia Enterprise Survey 2019–2020 |

---

*FinWatch Zambia — Bridging the gap between ML complexity and SME accessibility.*
