# FinWatch Zambia

> **ML-Based Financial Distress Prediction System for Zambian SMEs**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-F7931E.svg)](https://scikit-learn.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.3-blue.svg)](https://capacitorjs.com/)

---

## Overview

**FinWatch Zambia** is a production-deployed, full-stack machine learning system designed to predict financial distress in Small and Medium Enterprises (SMEs) within Zambia. It features a dual-portal architecture serving both business owners and institutional oversight bodies, combining classical financial ratio analysis with SHAP-based explainability and a multi-tier NLP narrative engine.

The system is fully cross-platform, available as a professional web portal and a native Android application, featuring robust 30-day persistent sessions and a hardened environment-aware API.

Developed as a Bachelor of Science in Computing (BSc BCOM) dissertation project at **Cavendish University Zambia**, 2026.

---

## Key Features

- **Institutional Umbrella Architecture**
  - **SME Portal**: Company profile management, financial data submission, interpreted risk assessments, and prediction history with robust persistence.
  - **Regulator Portal**: Accessible via `/regulator`. Full systemic oversight, monthly distress trends, and anonymised anomaly flags (Emerald Theme).
  - **Policy Analyst Portal**: Accessible via `/analyst`. Read-only aggregate sector analytics and strategic reporting (Blue Theme).

- **Native Mobile Experience**: Fully integrated with **Capacitor** for Android. Includes unclipped adaptive icons, native splash screen API integration, and mobile-optimized navigation.

- **Robust Persistence Layer**:
  - **Persistent Sessions**: Mobile-only 30-day JWT sessions using dual-layer async storage (@capacitor/preferences + native file system).
  - **Prediction Persistence**: Retains manual financial inputs and extracted metrics across refreshes and navigations via `localStorage`.

- **Explainable AI (XAI)**: Per-prediction SHAP attributions and global feature importance rankings. RANDOM_FOREST predictions take precedence on model disagreement.

- **Environment-Aware Connectivity**: 
  - **Smart Routing**: API client automatically detects platform and mode, defaulting to localhost for laptop development and Render for Android/Vercel.
  - **4-State Connection Feedback**: Clear visual lifecycle (idle → waking → success → error) for server cold-starts.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14.2.5 (App Router) · TypeScript | Page routing, role-aware layouts, SSR |
| **Mobile** | Capacitor 8.3 · Android Studio | Native Android wrapper and API bridging |
| **Styling** | Tailwind CSS · shadcn/ui · Lucide · Recharts | UI components, charting, responsive design |        
| **Backend** | FastAPI (Python 3.12) · Uvicorn | High-performance REST API, Pydantic validation |
| **ORM** | SQLAlchemy 2.0 · Alembic | Database abstraction and migrations |
| **Database** | PostgreSQL (Supabase) · SQLite WAL (local) | Dialect-aware persistence layer |
| **ML / XAI** | scikit-learn · SHAP · SMOTE | RF + LR classifiers, explainability, class balancing |
| **NLP** | Groq API · f-string template | Primary AI and deterministic backup |
| **Auth** | JWT · @capacitor/preferences | 30-day mobile persistence, role-based RBAC |
| **Reports** | ReportLab | Server-side PDF generation |
| **Infrastructure** | GitHub Actions · Vercel · Render | Zero-cost hosting with keep-alive logic |

---

## Architecture

### Role-Based Access Control (RBAC)

Three roles govern system access, with isolated token storage to prevent cross-portal session contamination:

| Role | Access | Token Keys |
|---|---|---|
| `sme_owner` | SME portal — own companies and predictions only | `token` / `user` |
| `policy_analyst` | Analyst portal — read-only aggregate analytics | `inst_token` / `inst_user` |
| `regulator` | Regulator portal — full analytics and anomaly flags | `inst_token` / `inst_user` |

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
NLP Layer            →   Groq → Template
Persistence Layer    →   SQLAlchemy ORM · Alembic · PostgreSQL / SQLite
```

---

## Project Structure

```
finwatch-zambia/
├── backend/
│   ├── app/
│   │   ├── api/                # Routers: auth, predictions, chat, institutional, admin
│   │   ├── core/               # JWT security, dependencies, global config
│   │   ├── db/                 # Engine and dialect-aware session management
│   │   ├── models/             # SQLAlchemy ORM — 11 core tables
│   │   ├── schemas/            # Pydantic request/response validation
│   │   └── services/           # ML, NLP, ratio engine, institutional reports
│   ├── migrations/             # Alembic (render_as_batch=True, offline + online)
│   ├── ml/                     # Preprocessing, training pipeline, model artifacts
│   └── tests/                  # Pytest suite (203+ passing tests)
│
├── frontend/
│   ├── app/
│   │   ├── (docs)/             # Symmetrical Documentation: sme, analyst, regulator
│   │   ├── (inst-auth)/        # Institutional login/register gateway
│   │   ├── (inst-portal)/      # Unified portal logic re-exported to /regulator and /analyst
│   │   ├── (sme-auth)/         # SME auth flow
│   │   └── (sme-portal)/       # SME dashboard and health assessments
│   ├── components/
│   │   ├── dashboard/          # SME-specific UI components
│   │   ├── institutional/      # Shared institutional analytics and pages
│   │   ├── shared/             # Dual-portal components (UserNav, Chat, Glossary)
│   │   └── ui/                 # shadcn/ui base primitives
│   └── lib/                    # API client, auth state, business rules
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
