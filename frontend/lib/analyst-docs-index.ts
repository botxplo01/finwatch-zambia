/**
 * FinWatch Zambia - Policy Analyst Documentation Search Index
 *
 * Static index for analytical client-side fuzzy search.
 */

export interface DocsSearchEntry {
  section: string;
  heading: string;
  excerpt: string;
  route: string;
  tags: string[];
}

export const analystDocsSearchIndex: DocsSearchEntry[] = [
  // Analytical Overview
  {
    section: "Analytical Overview",
    heading: "Scope of Analysis",
    excerpt: "Learn about the high-level economic monitoring tools available to Policy Analysts.",
    route: "/analyst/docs/overview#scope",
    tags: ["policy", "economics", "monitoring", "analysis"]
  },
  {
    section: "Analytical Overview",
    heading: "Data Access Boundaries",
    excerpt: "Understand the strict separation between aggregate analytical data and individual SME records.",
    route: "/analyst/docs/overview#boundaries",
    tags: ["privacy", "governance", "limits", "security"]
  },

  // Sector Performance
  {
    section: "Sector Performance",
    heading: "Interpreting Aggregate Metrics",
    excerpt: "How to read average distress probabilities and systemic risk factors across Zambian sectors.",
    route: "/analyst/docs/sector-performance#metrics",
    tags: ["data", "interpretation", "probability", "statistics"]
  },
  {
    section: "Sector Performance",
    heading: "Economic Trend Tracking",
    excerpt: "Using temporal charts to identify emerging economic shifts in the SME ecosystem.",
    route: "/analyst/docs/sector-performance#trends",
    tags: ["temporal", "economy", "macro", "tracking"]
  },

  // Institutional Reporting
  {
    section: "Reporting",
    heading: "Generating Policy Briefs",
    excerpt: "How to export cross-sector summaries for use in official ministerial or bank briefings.",
    route: "/analyst/docs/reporting#policy-briefs",
    tags: ["briefs", "export", "pdf", "official"]
  },
  {
    section: "Reporting",
    heading: "Model Confidence and Reliability",
    excerpt: "Understanding the accuracy metrics behind the Random Forest and Logistic Regression engines.",
    route: "/analyst/docs/reporting#reliability",
    tags: ["accuracy", "confidence", "metrics", "transparency"]
  },

  // AI Assistant Scope
  {
    section: "AI Assistant",
    heading: "Analytical Guidance",
    excerpt: "What the Analyst AI Assistant can help with, including trend interpretation and terminology.",
    route: "/analyst/docs/assistant-scope#guidance",
    tags: ["chat", "help", "support", "interpretation"]
  },
  {
    section: "AI Assistant",
    heading: "Usage Limits for Analysts",
    excerpt: "Information on the 10-message limit per session for documentation queries.",
    route: "/analyst/docs/assistant-scope#limits",
    tags: ["quota", "limit", "cooldown", "analyst"]
  }
];
