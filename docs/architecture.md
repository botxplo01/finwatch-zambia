# System Architecture: FinWatch Zambia

This document describes the high-level architecture of FinWatch Zambia, an ML-based early warning system for financial distress.

## 1. High-Level Diagram
```
[ Frontend (Next.js) ] <--- JSON API ---> [ Backend (FastAPI) ]
       |                                     |
       |                                     +--- [ Extraction Service (PDF/Excel) ]
       |                                     +--- [ ML Models (Random Forest / LogReg) ]
       |                                     +--- [ Explainability (SHAP) ]
       |                                     +--- [ NLP Engine (3-Tier Fallback) ]
       |                                     +--- [ Database (Postgres / Supabase) ]
```

## 2. Three-Tier Architecture

### **Tier 1: Client Layer (Web UI)**
- **Role**: Interaction, Visualisation, and Onboarding.
- **Key Tech**: Next.js 14, TypeScript, Tailwind CSS, Recharts.
- **Key Features**: 
  - **Multi-step Onboarding**: Phased registration for institutional users.
  - **Glassmorphism UI**: High-polish, portal-aware dynamic theming (Purple/Emerald/Blue).
  - **Data Persistence**: `localStorage` session state for in-progress predictions.
  - **Mobile Optimized**: GPU-accelerated backgrounds and responsive "Smart-Flip" pickers.

### **Tier 2: Application Layer (Logic)**
- **Role**: Request handling, authentication, and orchestration.
- **Key Tech**: FastAPI, SQLAlchemy 2.0, Pydantic v2.
- **Processes**:
  - **Extraction Service**: Automated financial metric parsing from unstructured documents.
  - **Ratio Engine**: Converts raw financials into 10 Zambian-context prediction features.
  - **Auth Manager**: JWT-based session security with role-based access control (RBAC).
  - **AI Governance**: Enforces a 10-message/2-hour "Burst-and-Block" limit with success-based logging.

### **Tier 3: AI & Data Layer**
- **Machine Learning**: Random Forest (Primary) and Logistic Regression (Baseline) models.
- **Explainability**: SHAP kernels compute local feature importance per assessment.
- **NLP Engine**: A 3-tier fallback chain:
  1. **Groq Cloud (Llama 3)**: Primary high-speed inference.
  2. **Local Ollama**: Offline/Fallback inference.
  3. **Template Engine**: Deterministic fallback for logic-only summaries.
- **Storage**: Supabase PostgreSQL for persistence; local filesystem for static avatars and reports.

## 3. Data Flow (The Prediction Cycle)
1.  **Ingestion**: User uploads documents or enters raw data.
2.  **Extraction**: `extraction_service.py` parses values into the form.
3.  **Transformation**: Backend computes 10 ratios using `ratio_engine.py`.
4.  **Inference**: Models predict the `is_distressed` probability.
5.  **Explanation**: SHAP calculates the attribution of each ratio to the score.
6.  **Narrative**: NLP converts probability and SHAP values into a plain-English report.
7.  **Persistence**: The prediction, ratios, and narrative are saved for historical analysis.

## 4. Environment Strategy
- **Development**: SQLite + Local Ollama (Granite 3b).
- **Production**: PostgreSQL (Supabase) + Cloud Groq API (Llama 3).
- **Hardening**: Standardized local/cloud timezone handling (UTC) and hardware-accelerated rendering.
