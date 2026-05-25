import { SearchEntry } from "./docs-search-index";

/**
 * Search index for the Policy Analyst documentation.
 */
export const analystDocsIndex: SearchEntry[] = [
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
