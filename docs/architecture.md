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
  - **Grand Unified Architecture**: Definitive domain-based routing separating the platform into symmetrical `/sme` and `/institutional` worlds.
  - **Standalone Documentation System**: Dedicated instructional portals for all roles with localized search and ToC.
  - **Business Scale Segmentation**: Core analytical tier distinguishing between Small and Medium-sized SMEs.
  - **Glassmorphism UI**: High-polish, portal-aware dynamic theming with role-aware empty states.
  - **Mobile Native Persistence**: Asynchronous session restoration surviving app restarts for 30 days.

### **Tier 2: Application Layer (Logic)**
- **Role**: Request handling, authentication, and orchestration.
- **Key Tech**: FastAPI, SQLAlchemy 2.0, Pydantic v2.
- **Processes**:
  - **Extraction Service**: Automated financial metric parsing from unstructured documents.
  - **Ratio Engine**: Converts raw financials into 10 Zambian-context prediction features.
  - **Auth Manager**: Dual-portal JWT security with native storage synchronization for mobile.
  - **AI Governance**: Decoupled usage limits (10 msgs for portal, 15 msgs for documentation).
  - **Reporting Service**: Automated PDF/CSV/JSON generation for both SMEs and Regulators.

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
