import { DocsSearchEntry } from "./docs-search-index";

/**
 * Search index for the Regulator documentation.
 */
export const institutionalDocsIndex: DocsSearchEntry[] = [
  // Overview
  {
    section: "Institutional Overview",
    heading: "System Purpose and Scope",
    excerpt:
      "Understand the institutional oversight capabilities of FinWatch Zambia and its role in monitoring SME financial stability.",
    route: "/institutional/docs/regulator/overview#purpose",
    tags: ["oversight", "policy", "mandate", "sme"],
  },
  {
    section: "Institutional Overview",
    heading: "Anonymization Standards",
    excerpt:
      "Technical details on how SME data is aggregated and anonymized to ensure privacy while maintaining analytical depth.",
    route: "/institutional/docs/regulator/overview#anonymization",
    tags: ["privacy", "data", "security", "aggregate"],
  },

  // Sector Trends
  {
    section: "Sector Trends",
    heading: "Reading the Heatmap",
    excerpt:
      "How to interpret sector-specific risk distributions and identifying high-vulnerability industries.",
    route: "/institutional/docs/regulator/sector-trends#heatmap",
    tags: ["analytics", "risk", "sectors", "visualization"],
  },
  {
    section: "Sector Trends",
    heading: "Temporal Analysis",
    excerpt:
      "Analyzing how financial distress patterns evolve over time across the Zambian economy.",
    route: "/institutional/docs/regulator/sector-trends#temporal",
    tags: ["trends", "time-series", "history", "forecasting"],
  },

  // Anomaly Detection
  {
    section: "Anomaly Detection",
    heading: "Detection Logic",
    excerpt:
      "Understand the statistical thresholds and ML indicators used to flag unusual or suspicious financial patterns.",
    route: "/institutional/docs/regulator/anomaly-detection#logic",
    tags: ["fraud", "unusual", "monitoring", "thresholds"],
  },
  {
    section: "Anomaly Detection",
    heading: "Investigating Flags",
    excerpt:
      "Best practices for reviewing and acting upon system-generated anomaly alerts.",
    route: "/institutional/docs/regulator/anomaly-detection#investigation",
    tags: ["workflow", "alert", "review", "audit"],
  },

  // Institutional Reporting
  {
    section: "Reporting",
    heading: "Cross-Sector Summaries",
    excerpt:
      "How to generate comprehensive PDF and CSV reports covering multiple sectors for policy review.",
    route: "/institutional/docs/regulator/reporting#summaries",
    tags: ["export", "pdf", "csv", "summary"],
  },
  {
    section: "Reporting",
    heading: "Model Performance Reports",
    excerpt:
      "Accessing detailed metrics on Random Forest and Logistic Regression accuracy across the platform.",
    route: "/institutional/docs/regulator/reporting#model-metrics",
    tags: ["accuracy", "performance", "metrics", "transparency"],
  },

  // AI Governance
  {
    section: "AI Governance",
    heading: "Model Transparency",
    excerpt:
      "Learn how SHAP values provide explainability at an institutional level for systemic risk drivers.",
    route: "/institutional/docs/regulator/governance#transparency",
    tags: ["shap", "xai", "explainability", "ethics"],
  },
  {
    section: "AI Governance",
    heading: "Audit Trails",
    excerpt:
      "Information on system logging and the traceability of AI-generated assessments and narratives.",
    route: "/institutional/docs/regulator/governance#audit",
    tags: ["compliance", "logs", "accountability", "traceability"],
  },
];

/**
 * Search index for the Policy Analyst documentation.
 */
export const analystDocsIndex: DocsSearchEntry[] = [
  // Analytical Overview
  {
    section: "Analytical Overview",
    heading: "Scope of Analysis",
    excerpt:
      "Learn about the high-level economic monitoring tools available to Policy Analysts.",
    route: "/institutional/docs/analyst/overview#scope",
    tags: ["policy", "economics", "monitoring", "analysis"],
  },
  {
    section: "Analytical Overview",
    heading: "Data Access Boundaries",
    excerpt:
      "Understand the strict separation between aggregate analytical data and individual SME records.",
    route: "/institutional/docs/analyst/overview#boundaries",
    tags: ["privacy", "governance", "limits", "security"],
  },

  // Sector Performance
  {
    section: "Sector Performance",
    heading: "Interpreting Aggregate Metrics",
    excerpt:
      "How to read average distress probabilities and systemic risk factors across Zambian sectors.",
    route: "/institutional/docs/analyst/sector-performance#metrics",
    tags: ["data", "interpretation", "probability", "statistics"],
  },
  {
    section: "Sector Performance",
    heading: "Economic Trend Tracking",
    excerpt:
      "Using temporal charts to identify emerging economic shifts in the SME ecosystem.",
    route: "/institutional/docs/analyst/sector-performance#trends",
    tags: ["temporal", "economy", "macro", "tracking"],
  },

  // Institutional Reporting
  {
    section: "Reporting",
    heading: "Generating Policy Briefs",
    excerpt:
      "How to export cross-sector summaries for use in official ministerial or bank briefings.",
    route: "/institutional/docs/analyst/reporting#policy-briefs",
    tags: ["briefs", "export", "pdf", "official"],
  },
  {
    section: "Reporting",
    heading: "Model Confidence and Reliability",
    excerpt:
      "Understanding the accuracy metrics behind the Random Forest and Logistic Regression engines.",
    route: "/institutional/docs/analyst/reporting#reliability",
    tags: ["accuracy", "confidence", "metrics", "transparency"],
  },

  // AI Assistant Scope
  {
    section: "AI Assistant",
    heading: "Analytical Guidance",
    excerpt:
      "What the Analyst AI Assistant can help with, including trend interpretation and terminology.",
    route: "/institutional/docs/analyst/assistant-scope#guidance",
    tags: ["chat", "help", "support", "interpretation"],
  },
  {
    section: "AI Assistant",
    heading: "Usage Limits for Analysts",
    excerpt:
      "Information on the 10-message limit per session for documentation queries.",
    route: "/institutional/docs/analyst/assistant-scope#limits",
    tags: ["quota", "limit", "cooldown", "analyst"],
  },
];

export type { DocsSearchEntry };
export const institutionalDocsSearchIndex = institutionalDocsIndex;
export const analystDocsSearchIndex = analystDocsIndex;
