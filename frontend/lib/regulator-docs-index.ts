/**
 * FinWatch Zambia - Regulator Documentation Search Index
 *
 * Static index for institutional client-side fuzzy search.
 */

export interface DocsSearchEntry {
  section: string;
  heading: string;
  excerpt: string;
  route: string;
  tags: string[];
}

export const regulatorDocsSearchIndex: DocsSearchEntry[] = [
  // Overview
  {
    section: "Institutional Overview",
    heading: "System Purpose and Scope",
    excerpt: "Understand the regulatory oversight capabilities of FinWatch Zambia and its role in monitoring SME financial stability.",
    route: "/regulator/docs/overview#purpose",
    tags: ["oversight", "policy", "mandate", "sme"]
  },
  {
    section: "Institutional Overview",
    heading: "Anonymization Standards",
    excerpt: "Technical details on how SME data is aggregated and anonymized to ensure privacy while maintaining analytical depth.",
    route: "/regulator/docs/overview#anonymization",
    tags: ["privacy", "data", "security", "aggregate"]
  },

  // Sector Trends
  {
    section: "Sector Trends",
    heading: "Reading the Heatmap",
    excerpt: "How to interpret sector-specific risk distributions and identifying high-vulnerability industries.",
    route: "/regulator/docs/sector-trends#heatmap",
    tags: ["analytics", "risk", "sectors", "visualization"]
  },
  {
    section: "Sector Trends",
    heading: "Temporal Analysis",
    excerpt: "Analyzing how financial distress patterns evolve over time across the Zambian economy.",
    route: "/regulator/docs/sector-trends#temporal",
    tags: ["trends", "time-series", "history", "forecasting"]
  },

  // Anomaly Detection
  {
    section: "Anomaly Detection",
    heading: "Detection Logic",
    excerpt: "Understand the statistical thresholds and ML indicators used to flag unusual or suspicious financial patterns.",
    route: "/regulator/docs/anomaly-detection#logic",
    tags: ["fraud", "unusual", "monitoring", "thresholds"]
  },
  {
    section: "Anomaly Detection",
    heading: "Investigating Flags",
    excerpt: "Best practices for reviewing and acting upon system-generated anomaly alerts.",
    route: "/regulator/docs/anomaly-detection#investigation",
    tags: ["workflow", "alert", "review", "audit"]
  },

  // Institutional Reporting
  {
    section: "Reporting",
    heading: "Cross-Sector Summaries",
    excerpt: "How to generate comprehensive PDF and CSV reports covering multiple sectors for policy review.",
    route: "/regulator/docs/reporting#summaries",
    tags: ["export", "pdf", "csv", "summary"]
  },
  {
    section: "Reporting",
    heading: "Model Performance Reports",
    excerpt: "Accessing detailed metrics on Random Forest and Logistic Regression accuracy across the platform.",
    route: "/regulator/docs/reporting#model-metrics",
    tags: ["accuracy", "performance", "metrics", "transparency"]
  },

  // AI Governance
  {
    section: "AI Governance",
    heading: "Model Transparency",
    excerpt: "Learn how SHAP values provide explainability at an institutional level for systemic risk drivers.",
    route: "/regulator/docs/governance#transparency",
    tags: ["shap", "xai", "explainability", "ethics"]
  },
  {
    section: "AI Governance",
    heading: "Audit Trails",
    excerpt: "Information on system logging and the traceability of AI-generated assessments and narratives.",
    route: "/regulator/docs/governance#audit",
    tags: ["compliance", "logs", "accountability", "traceability"]
  }
];
