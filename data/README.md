# Data Documentation: FinWatch Zambia

This directory contains information regarding the datasets used for training, validating, and testing the FinWatch machine learning models.

## 1. Dataset Overview
The primary dataset consists of anonymised financial records from SMEs across various sectors (Manufacturing, Agriculture, Retail, etc.). It includes Balance Sheet and Income Statement line items.

- **Sample Size**: ~5,000 corporate records.
- **Target Variable**: `is_distressed` (Binary: 0 for Healthy, 1 for Distressed/Insolvent).
- **Time Horizon**: 2018–2024.

## 2. Derived Feature Engineering (10 Core Ratios)
Raw financial data is transformed into 10 key ratios used by the Random Forest and Logistic Regression models:

| Ratio | Category | Purpose |
| :--- | :--- | :--- |
| **Current Ratio** | Liquidity | Measures ability to pay short-term debt. |
| **Quick Ratio** | Liquidity | Stricter liquidity test (excludes inventory). |
| **Cash Ratio** | Liquidity | Most conservative liquidity metric. |
| **Debt to Equity** | Leverage | Measures financial risk and solvency. |
| **Debt to Assets** | Leverage | Percentage of assets financed by debt. |
| **Interest Coverage** | Leverage | Ability to pay interest on outstanding debt. |
| **Net Profit Margin** | Profitability | Efficiency at generating profit from sales. |
| **Return on Assets** | Profitability | Efficiency at using assets to generate earnings. |
| **Return on Equity** | Profitability | Profitability from the perspective of shareholders. |
| **Asset Turnover** | Efficiency | How efficiently a company uses its assets. |

## 3. Data Privacy & Ethics
- **Anonymization**: All Personally Identifiable Information (PII) such as company names, owner names, and addresses have been removed before model training.
- **Aggregation**: Data in the Regulator portal is presented only in aggregate form to prevent the "reverse engineering" of individual company identities.

## 4. Usage in Notebooks
The raw data files (`.csv`) are processed in the `notebooks/` directory for:
1.  **Exploratory Data Analysis (EDA)**.
2.  **Imbalance Handling**: Using SMOTE (Synthetic Minority Over-sampling Technique).
3.  **Cross-Validation**: Ensuring the 92%+ accuracy is consistent across different data splits.
