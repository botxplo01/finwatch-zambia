"use client";

/**
 * FinWatch Zambia - Shared Glossary Lookup
 * 
 * Provides static, scale-aware definitions for financial and ML terms.
 * Used by tooltips, the Glossary floating button, and AI Assistant guardrails.
 */

export interface GlossaryEntry {
  term: string;
  definition: {
    small_scale: string;
    medium_scale: string;
  };
  example: {
    small_scale: string;
    medium_scale: string;
  };
  benchmarks?: {
    small_scale: string;
    medium_scale: string;
  };
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  current_ratio: {
    term: "Current Ratio",
    definition: {
      small_scale: "Your ability to pay your bills and suppliers over the next few months.",
      medium_scale: "A liquidity ratio that measures a company's ability to pay short-term obligations due within one year.",
    },
    example: {
      small_scale: "If a shop owner has K5,000 in cash and stock, but owes K4,000 to suppliers this month.",
      medium_scale: "A transport company with ZMW 200,000 in current assets and ZMW 150,000 in current liabilities.",
    },
    benchmarks: {
      small_scale: "Healthy: > 1.2. Concerning: < 1.0.",
      medium_scale: "Healthy: 1.5 - 2.5. Concerning: < 1.1.",
    },
  },
  quick_ratio: {
    term: "Quick Ratio",
    definition: {
      small_scale: "Your immediate cash safety net, excluding stock that hasn't been sold yet.",
      medium_scale: "The acid-test ratio; measures the ability to meet short-term obligations with most liquid assets.",
    },
    example: {
      small_scale: "Cash on hand plus mobile money balance, compared to what you owe today.",
      medium_scale: "Current assets minus inventory, divided by current liabilities.",
    },
    benchmarks: {
      small_scale: "Healthy: > 1.0. Concerning: < 0.7.",
      medium_scale: "Healthy: > 1.1. Concerning: < 0.8.",
    },
  },
  cash_ratio: {
    term: "Cash Ratio",
    definition: {
      small_scale: "Actual cash available right now for urgent payments.",
      medium_scale: "The most conservative liquidity ratio, measuring cash and equivalents against current liabilities.",
    },
    example: {
      small_scale: "Money in the register and M-Pesa/Airtel Money, ready to pay for a restock tomorrow.",
      medium_scale: "Total cash and equivalents divided by current liabilities.",
    },
    benchmarks: {
      small_scale: "Healthy: > 0.5. Concerning: < 0.2.",
      medium_scale: "Healthy: > 0.4. Concerning: < 0.2.",
    },
  },
  debt_to_equity: {
    term: "Debt to Equity",
    definition: {
      small_scale: "How much of your business is funded by borrowed money versus your own savings.",
      medium_scale: "A leverage ratio comparing total liabilities to shareholders' equity.",
    },
    example: {
      small_scale: "If you used K2,000 of your own money and borrowed K4,000 from a micro-lender.",
      medium_scale: "Total liabilities divided by total equity.",
    },
    benchmarks: {
      small_scale: "Healthy: < 1.5. Concerning: > 2.0.",
      medium_scale: "Healthy: < 1.0. Concerning: > 2.0.",
    },
  },
  debt_to_assets: {
    term: "Debt to Assets",
    definition: {
      small_scale: "The portion of your equipment and stock that is tied to debt.",
      medium_scale: "Measures the percentage of a company's assets that are financed with debt.",
    },
    example: {
      small_scale: "If your stall is worth K10,000 but you still owe K6,000 on the loan used to build it.",
      medium_scale: "Total debt divided by total assets.",
    },
    benchmarks: {
      small_scale: "Healthy: < 0.4. Concerning: > 0.7.",
      medium_scale: "Healthy: < 0.5. Concerning: > 0.6.",
    },
  },
  interest_coverage: {
    term: "Interest Coverage",
    definition: {
      small_scale: "Your ability to pay the interest on your loans from your weekly profits.",
      medium_scale: "Measures how many times a company can cover its interest expenses with its operating profit (EBIT).",
    },
    example: {
      small_scale: "If your profit is K500/week and your loan interest is K100/week.",
      medium_scale: "EBIT divided by interest expense.",
    },
    benchmarks: {
      small_scale: "Healthy: > 3.0. Concerning: < 1.5.",
      medium_scale: "Healthy: > 3.0. Concerning: < 2.0.",
    },
  },
  net_profit_margin: {
    term: "Net Profit Margin",
    definition: {
      small_scale: "How much actual profit you keep from every K100 of sales after all costs.",
      medium_scale: "The percentage of revenue remaining after all operating expenses, interest, and taxes.",
    },
    example: {
      small_scale: "Selling a bag of mealie meal for K200, with K180 cost, leaving K20 (10%) profit.",
      medium_scale: "Net income divided by total revenue.",
    },
    benchmarks: {
      small_scale: "Healthy: > 10%. Concerning: < 2%.",
      medium_scale: "Healthy: > 8%. Concerning: < 3%.",
    },
  },
  return_on_assets: {
    term: "Return on Assets (ROA)",
    definition: {
      small_scale: "How well your tools, equipment, and property help you generate profit.",
      medium_scale: "Indicators how profitable a company is relative to its total assets.",
    },
    example: {
      small_scale: "Using a K5,000 refrigerator to help sell K500 of cold drinks per month.",
      medium_scale: "Net income divided by total assets.",
    },
    benchmarks: {
      small_scale: "Healthy: > 5%. Concerning: < 1%.",
      medium_scale: "Healthy: > 5%. Concerning: < 2%.",
    },
  },
  asset_turnover: {
    term: "Asset Turnover",
    definition: {
      small_scale: "How quickly you turn your stock into actual sales.",
      medium_scale: "Measures the efficiency of a company's use of its assets in generating sales revenue.",
    },
    example: {
      small_scale: "If your shop is full of goods worth K20,000 and you sell K60,000 in a year (Turnover = 3).",
      medium_scale: "Total revenue divided by total assets.",
    },
    benchmarks: {
      small_scale: "Healthy: > 2.0. Concerning: < 0.8.",
      medium_scale: "Healthy: > 1.5. Concerning: < 0.5.",
    },
  },
  distress: {
    term: "Financial Distress",
    definition: {
      small_scale: "When a business struggles to pay what it owes, putting it at risk of closing down.",
      medium_scale: "A condition where a company cannot meet, or has difficulty meeting, its financial obligations to creditors.",
    },
    example: {
      small_scale: "Regularly being unable to pay suppliers on time or needing to skip rent.",
      medium_scale: "Insolvency, liquidity crises, or default on debt covenants.",
    },
  },
  shap: {
    term: "SHAP (AI Reasons)",
    definition: {
      small_scale: "The 'reasons' the AI gives for your result. It shows which parts of your business are helping or hurting.",
      medium_scale: "SHapley Additive exPlanations. A method to explain the output of machine learning models.",
    },
    example: {
      small_scale: "A red bar for 'Cash' means low cash is the main reason for a 'Risk' result.",
      medium_scale: "Quantifying the contribution of each feature to the model's prediction probability.",
    },
  },
};
