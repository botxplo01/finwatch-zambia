# FinWatch Zambia

> **ML-Based Financial Distress Prediction System for Zambian SMEs**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-F7931E.svg)](https://scikit-learn.org/)

---

## Overview

**FinWatch Zambia** is a full-stack, interpretable machine learning system designed to predict financial distress in Small and Medium Enterprises (SMEs) within Zambia and similar developing economies. It combines classical financial ratio analysis with modern machine learning, SHAP-based explainability, and an NLP narrative engine to translate model outputs into plain-language financial health reports accessible to non-specialist business owners.

This system is developed as a Bachelor of Science in Computing (BSc BCOM) dissertation project at **Cavendish University Zambia**, Faculty of Business and Information Technology, under course code **COM421**, 2026.

---

## The Problem

Many Zambian SMEs face financial deterioration without access to affordable, interpretable early-warning tools. Existing prediction systems are built for environments with standardized financial records and do not produce outputs accessible to non-technical managers. As a result, distress signals are recognized reactively — often too late for corrective action.

FinWatch Zambia addresses this by providing:

- A distress risk score derived from core financial ratios
- SHAP-based feature attributions showing exactly which financial indicators drove the prediction
- A natural language narrative that translates those attributions into actionable, plain-English financial health commentary

---

## Key Features

- **Dual ML Models** — Logistic Regression and Random Forest trained on real financial ratio data, compared under rigorous cross-validation
- **SHAP Explainability** — Per-prediction SHAP waterfall charts and global feature importance rankings (TreeExplainer for RF, LinearExplainer for LR)
- **NLP Narrative Engine** — Three-tier fallback: Groq Cloud (LLaMA 3.1 8B) → Ollama Local (Qwen 2.5 3B) → Deterministic Template, producing grounded financial health narratives
- **Financial Ratio Engine** — Automatic computation of 10 core ratios across liquidity, leverage, profitability, and activity categories from raw financial inputs
- **Secure Authentication** — JWT-based role-aware authentication with protected routes
- **Prediction History** — Full audit trail of all predictions per SME profile with timestamps
- **PDF Report Export** — Downloadable assessment reports per prediction
- **Responsive Dashboard** — Modern, accessible interface built with Next.js 14 and shadcn/ui

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│         Next.js 14 · TypeScript · Tailwind CSS       │
│              shadcn/ui · Recharts                    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / REST
┌───────────────────────▼─────────────────────────────┐
│                   API Gateway Layer                  │
│              FastAPI · Uvicorn · JWT Auth            │
│           Pydantic Validation · Auto Docs            │
└──────┬─────────────────┬──────────────┬─────────────┘
       │                 │              │
┌──────▼──────┐  ┌───────▼──────┐  ┌───▼─────────────┐
│  ML Service │  │  Ratio Engine│  │   NLP Service    │
│  LR + RF    │  │  10 Ratios   │  │  Groq (Primary)  │
│  SHAP       │  │  Validation  │  │  Ollama (Local)  │
│  Serialized │  │              │  │  Template (Safe) │
│  Artifacts  │  │              │  │                  │
└──────┬──────┘  └───────┬──────┘  └───────┬──────────┘
       │                 │                 │
┌──────▼─────────────────▼─────────────────▼──────────┐
│                  Persistence Layer                   │
│          SQLAlchemy 2.0 · SQLite · Alembic           │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | Page routing, SSR, protected layouts |
| Styling | Tailwind CSS + shadcn/ui | Component library, responsive design |
| Charts | Recharts | SHAP visualizations, ratio displays |
| Backend | FastAPI (Python 3.11) + Uvicorn | REST API, async request handling, validation |
| ORM | SQLAlchemy 2.0 | Database abstraction, model definitions |
| Database | SQLite | Embedded, zero-config relational storage |
| ML | scikit-learn | Logistic Regression, Random Forest |
| Explainability | SHAP | TreeExplainer (RF), LinearExplainer (LR) |
| NLP — Primary | Groq API (`llama-3.1-8b-instant`) | Cloud inference, best quality output |
| NLP — Fallback | Ollama (`qwen2.5:3b`) | Local offline inference |
| NLP — Final | Python f-string templates | Deterministic, always-available output |
| Auth | JWT via python-jose | Stateless token authentication |
| PDF Export | ReportLab / WeasyPrint | Downloadable assessment reports |
| Migrations | Alembic | Database schema versioning |
| Testing | pytest | Backend unit and integration tests |
| Linting | ruff | Python code quality |

---

## Project Structure

```
finwatch-zambia/
├── backend/                    # FastAPI application
│   ├── main.py                 # App entry point
│   ├── requirements.txt        # Python dependencies
│   ├── alembic.ini             # Migration config
│   ├── app/
│   │   ├── api/                # Route definitions (auth, predictions, companies, reports)
│   │   ├── core/               # Config, security, dependency injection
│   │   ├── models/             # SQLAlchemy ORM models (7 tables)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (ratio engine, ML, SHAP, NLP, auth)
│   │   └── db/                 # Database engine and session management
│   ├── migrations/             # Alembic migration versions
│   └── ml/                     # Offline ML training pipeline
│       ├── train.py            # Pipeline entry point
│       ├── preprocess.py       # Data cleaning and ratio engineering
│       ├── train_models.py     # LR + RF training and cross-validation
│       ├── evaluate.py         # Metrics, ROC, PR curves
│       ├── explain.py          # SHAP global and local explanations
│       └── artifacts/          # Serialized models (Git-ignored)
│
├── frontend/                   # Next.js 14 application
│   ├── app/
│   │   ├── (auth)/             # Login and register pages
│   │   └── (dashboard)/        # Protected: dashboard, predict, results, history
│   ├── components/
│   │   ├── charts/             # SHAP and ratio visualization components
│   │   ├── prediction/         # Prediction form, risk badge, NLP narrative panel
│   │   ├── layout/             # Sidebar, header, protected route wrapper
│   │   └── shared/             # Loading spinner, error boundary
│   ├── lib/                    # API client, auth utilities, helpers
│   ├── hooks/                  # useAuth, usePrediction custom hooks
│   └── types/                  # Shared TypeScript interfaces
│
├── data/                       # Datasets (Git-ignored — see data/README.md)
├── notebooks/                  # Jupyter EDA and evaluation notebooks
├── tests/                      # pytest backend test suite
├── docs/                       # Architecture docs and UML diagrams
├── scripts/                    # Developer utility scripts
└── .env.example                # Environment variable template
```

---

## Datasets

This project uses two publicly available, freely accessible datasets for academic research.

### Primary Training Dataset

**Polish Companies Bankruptcy Dataset**
- Source: UCI Machine Learning Repository
- DOI: [10.24432/C5V61K](https://doi.org/10.24432/C5V61K)
- Description: Financial ratio data from Polish firms across five annual periods, with binary distress labels. Contains 64 financial features derived from balance sheets and income statements.
- License: Creative Commons Attribution 4.0 (CC BY 4.0)
- Download: See `data/README.md` for exact instructions

### Contextual Validation Dataset

**World Bank Zambia Enterprise Survey 2019–2020**
- Source: World Bank Microdata Library
- URL: [microdata.worldbank.org](https://microdata.worldbank.org/index.php/catalog/3957)
- Description: Survey data on SME operating conditions, financial constraints, and vulnerability indicators in Zambia. Used to contextualize model findings within the Zambian SME environment.
- License: Open access for academic and non-commercial research

> **Note:** Neither dataset is committed to this repository. Download instructions and citation details are provided in `data/README.md`. Model artifacts generated from training are excluded via `.gitignore`.

---

## Getting Started

### Prerequisites

Ensure the following are installed on your system:

- Python 3.11+
- Node.js 18+
- npm or yarn
- Git
- Ollama (optional, for local NLP fallback) — [ollama.com](https://ollama.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/finwatch-zambia.git
cd finwatch-zambia
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Groq API (Primary NLP — free tier at console.groq.com)
GROQ_API_KEY=gsk_your_key_here

# JWT Authentication
SECRET_KEY=your_strong_random_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database
DATABASE_URL=sqlite:///./finwatch.db

# NLP Configuration
NLP_PRIMARY=groq
NLP_FALLBACK=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
GROQ_MODEL=llama-3.1-8b-instant
```

> **Security:** Never commit `.env` to version control. It is listed in `.gitignore`.

### 3. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt

# Initialise the database
alembic upgrade head

# Start the development server
uvicorn main:app --reload --port 8000
```

The FastAPI server will be running at `http://localhost:8000`.
Interactive API documentation is available at `http://localhost:8000/docs`.

### 4. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local

# Start the development server
npm run dev
```

The Next.js frontend will be running at `http://localhost:3000`.

### 5. Ollama Setup (Optional — Local NLP Fallback)

```bash
# Pull the recommended model (1.9GB)
ollama pull qwen2.5:3b

# Verify it runs
ollama run qwen2.5:3b "Hello"
```

Ollama must be running as a background service for the local fallback to activate. If Ollama is not running and Groq is unavailable, the system automatically falls back to template-based narrative generation.

---

## ML Training Pipeline

The ML pipeline is designed to be run once offline to produce serialized model artifacts used by the live application.

```bash
# Ensure the dataset is downloaded first — see data/README.md
cd backend

# Run the full pipeline: preprocess → train → evaluate → export SHAP
python ml/train.py
```

This will:
1. Load and clean the UCI Polish Bankruptcy dataset
2. Engineer the 10 core financial ratios
3. Apply SMOTE to handle class imbalance
4. Train Logistic Regression and Random Forest with 5-fold stratified cross-validation
5. Evaluate both models (Accuracy, Precision, Recall, F1, ROC-AUC, PR-AUC)
6. Generate SHAP global feature importance for both models
7. Serialize trained models, scalers, and SHAP explainers to `backend/ml/artifacts/`

> **Hardware note:** Training runs entirely on CPU. On an Intel Core i7 8th Gen with 16GB RAM, the full pipeline completes in approximately 3–8 minutes.

---

## NLP Narrative Engine

The NLP service generates grounded natural language financial health narratives from structured prediction outputs. It is deliberately designed to never abstract away crucial details — every narrative references the actual ratio values and SHAP attributions that drove the prediction.

### Inference Fallback Chain

```
1. Groq Cloud (llama-3.1-8b-instant)
   └── Best quality · ~300 tok/sec · Free tier: 14,400 req/day
       │
       └── [if unavailable or rate-limited]
           │
2. Ollama Local (qwen2.5:3b)
   └── Offline capable · ~8–15 tok/sec on CPU · No rate limits
       │
       └── [if Ollama not running]
           │
3. Template Engine (Python f-strings)
   └── Deterministic · Instant · Always available
```

Narratives are cached by prediction hash to avoid redundant API calls.

---

## API Reference

Once the backend is running, full interactive documentation is auto-generated by FastAPI at:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

Key endpoint groups:

| Prefix | Description |
|---|---|
| `/api/auth` | Register, login, token refresh |
| `/api/companies` | SME profile management |
| `/api/predictions` | Submit financial data, retrieve predictions |
| `/api/reports` | Generate and download PDF reports |
| `/api/admin` | User management (admin role) |

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Unit tests cover all 10 ratio computations against manually verified values. Integration tests cover authentication endpoints and prediction pipeline. See `tests/backend/` for test cases.

---

## Academic Context

| Field | Detail |
|---|---|
| Institution | Cavendish University Zambia |
| Faculty | Business and Information Technology |
| Programme | Bachelor of Science in Computing (BSc BCOM) |
| Course Code | COM421 |
| Year | 2026 |
| Research Design | Design Science Research (DSR) |
| Citation Style | Harvard |

### Research Objectives

1. Identify and engineer financial ratios most predictive of SME distress in the Zambian context
2. Train, compare, and validate Logistic Regression and Random Forest classifiers with SHAP-based explainability
3. Design and implement a layered web application operationalizing the prediction pipeline
4. Evaluate model performance (Accuracy, Precision, Recall, F1, ROC-AUC) and system usability (SUS)
5. Implement a lightweight NLP explanation module generating grounded financial health narratives

### Key References

- Altman, E.I. (1968) 'Financial ratios, discriminant analysis and the prediction of corporate bankruptcy', *The Journal of Finance*, 23(4), pp. 589–609.
- Beaver, W.H. (1966) 'Financial ratios as predictors of failure', *Journal of Accounting Research*, 4, pp. 71–111.
- Breiman, L. (2001) 'Random forests', *Machine Learning*, 45(1), pp. 5–32.
- Hevner, A.R. et al. (2004) 'Design science in information systems research', *MIS Quarterly*, 28(1), pp. 75–105.
- Lundberg, S.M. and Lee, S.-I. (2017) 'A unified approach to interpreting model predictions', *Proceedings of NeurIPS*.
- World Bank (2020) *Zambia Enterprise Survey 2019–2020*. Washington, DC: World Bank Group.

---

## Contributing

This is an academic dissertation project. External contributions are not accepted during the active research period. The repository is made public for transparency and reproducibility of results.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

The datasets used are subject to their own licenses:
- UCI Polish Bankruptcy Dataset: CC BY 4.0
- World Bank Enterprise Survey: Open access for academic and non-commercial use

---

## Acknowledgements

This project builds on foundational scholarship in financial distress prediction (Beaver, 1966; Altman, 1968; Ohlson, 1980), modern interpretable ML methods (Lundberg and Lee, 2017), and Design Science Research methodology (Hevner et al., 2004; Peffers et al., 2007). It is motivated by the documented financial vulnerability of SMEs in Zambia (World Bank, 2020; FSD Zambia, 2020) and the practical need for deployable, interpretable early-warning tools in developing economy contexts.

---

*FinWatch Zambia — Turning financial ratios into early warnings.*
