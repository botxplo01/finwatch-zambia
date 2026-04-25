# System Architecture: FinWatch Zambia

This document describes the high-level architecture of FinWatch Zambia, an ML-based early warning system for financial distress.

## 1. High-Level Diagram (Conceptual)
```
[ Frontend (Next.js) ] <--- JSON API ---> [ Backend (FastAPI) ]
       |                                     |
       |                                     +--- [ ML Models (Random Forest) ]
       |                                     +--- [ Explainability (SHAP) ]
       |                                     +--- [ NLP (Groq/Ollama) ]
       |                                     +--- [ Database (Postgres) ]
```

## 2. Three-Tier Architecture

### **Tier 1: Client Layer (Web UI)**
- **Role**: Interaction and Visualisation.
- **Key Tech**: Next.js, TypeScript, Recharts.
- **Isolation**: Dynamic routing handles the `/dashboard` (SME) and `/regulator` portals using separate authentication state namespaces.

### **Tier 2: Application Layer (Logic)**
- **Role**: Request handling, authentication, and orchestration.
- **Key Tech**: FastAPI, SQLAlchemy, Pydantic.
- **Processes**:
  - **Ratio Engine**: Converts raw financials into prediction-ready features.
  - **Auth Manager**: JWT generation and role validation.
  - **NLP Orchestrator**: Manages the multi-tier LLM fallback chain.

### **Tier 3: AI & Data Layer**
- **Machine Learning**: Pre-trained Random Forest and Logistic Regression models.
- **Explainability**: SHAP (Shapley Additive Explanations) kernels compute local feature importance for every prediction.
- **Storage**: Supabase PostgreSQL for persistent company history and user profiles.

## 3. Data Flow (The Prediction Cycle)
1.  **Input**: User enters 10-15 raw financial data points via a form.
2.  **Transformation**: Backend computes 10 ratios using `ratio_engine.py`.
3.  **Inference**: Models predict the `is_distressed` probability.
4.  **Explanation**: SHAP calculates the attribution of each ratio to that specific score.
5.  **Narrative**: NLP converts the probability and SHAP values into a plain-English report.
6.  **Persistence**: The prediction is saved to the database for historical trend analysis.

## 4. Environment Strategy
- **Development**: SQLite + Local Ollama (Granite 3b).
- **Production**: PostgreSQL + Cloud Groq API (Llama 8b).
- **Detection**: Triggered automatically via the `RENDER` environment variable.
