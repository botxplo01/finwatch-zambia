/**
 * FinWatch Zambia - Documentation Search Index
 *
 * Static index for client-side fuzzy search using Fuse.js.
 */

export interface DocsSearchEntry {
  section: string; // Section title e.g. "Financial Concepts"
  heading: string; // Specific heading e.g. "What is the Current Ratio?"
  excerpt: string; // 1-2 sentence excerpt containing the key content
  route: string; // Full route e.g. "/docs/financial-concepts#current-ratio"
  tags: string[]; // Related terms e.g. ["liquidity", "ratio", "current"]
}

export const docsSearchIndex: DocsSearchEntry[] = [
  // Getting Started
  {
    section: "Getting Started",
    heading: "What is FinWatch Zambia",
    excerpt:
      "Learn how FinWatch Zambia helps SMEs predict financial distress using AI and machine learning.",
    route: "/docs/getting-started#what-is-finwatch",
    tags: ["intro", "overview", "sme", "zambia"],
  },
  {
    section: "Getting Started",
    heading: "Creating your account",
    excerpt:
      "Step-by-step guide to registering and setting up your SME owner profile.",
    route: "/docs/getting-started#creating-account",
    tags: ["register", "login", "signup", "onboarding"],
  },
  {
    section: "Getting Started",
    heading: "Running your first prediction",
    excerpt:
      "How to input financial data and generate your first health assessment.",
    route: "/docs/getting-started#first-prediction",
    tags: ["tutorial", "predict", "assessment", "guide"],
  },

  // Understanding Your Results
  {
    section: "Understanding Your Results",
    heading: "What the risk score means",
    excerpt:
      "A breakdown of the 0-100% distress probability and what different levels indicate.",
    route: "/docs/understanding-results#risk-score",
    tags: ["probability", "score", "metrics", "interpretation"],
  },
  {
    section: "Understanding Your Results",
    heading: "How to read the SHAP chart",
    excerpt:
      "Understand which financial ratios are driving your business towards or away from distress.",
    route: "/docs/understanding-results#shap-chart",
    tags: ["explainability", "shap", "drivers", "visuals"],
  },
  {
    section: "Understanding Your Results",
    heading: "Distressed vs. Healthy",
    excerpt:
      "The meaning behind the classification status and what it says about your business health.",
    route: "/docs/understanding-results#classification",
    tags: ["status", "labels", "outcome", "health"],
  },

  // Financial Concepts
  {
    section: "Financial Concepts",
    heading: "Current Ratio",
    excerpt:
      "Measures your ability to pay short-term bills using current assets. Ideal range is 1.2 to 2.0.",
    route: "/docs/financial-concepts#current-ratio",
    tags: ["liquidity", "bills", "assets", "liabilities"],
  },
  {
    section: "Financial Concepts",
    heading: "Debt-to-Equity",
    excerpt:
      "Shows the proportion of equity and debt used to finance your company's assets.",
    route: "/docs/financial-concepts#debt-to-equity",
    tags: ["leverage", "loans", "funding", "solvency"],
  },
  {
    section: "Financial Concepts",
    heading: "Net Profit Margin",
    excerpt:
      "The percentage of revenue that exceeds your business's total expenses.",
    route: "/docs/financial-concepts#net-profit-margin",
    tags: ["profitability", "earnings", "margin", "performance"],
  },

  // Submitting Financial Data
  {
    section: "Submitting Financial Data",
    heading: "Manual Entry",
    excerpt:
      "Tips for accurately filling in the financial data form for more precise predictions.",
    route: "/docs/submitting-data#manual-entry",
    tags: ["input", "form", "data", "accuracy"],
  },
  {
    section: "Submitting Financial Data",
    heading: "Document Upload",
    excerpt:
      "How to use our AI-powered document extraction to pull data from your PDF or Excel statements.",
    route: "/docs/submitting-data#document-upload",
    tags: ["automation", "extraction", "pdf", "excel"],
  },

  // AI Assistant
  {
    section: "AI Assistant",
    heading: "What the AI Assistant can help with",
    excerpt:
      "Understand the scope of our conversational AI, from ratio interpretation to platform help.",
    route: "/docs/ai-assistant#assistant-scope",
    tags: ["chat", "help", "support", "guidance"],
  },
  {
    section: "AI Assistant",
    heading: "Usage Limits",
    excerpt:
      "Information about the 10-message rolling window limit for the documentation assistant.",
    route: "/docs/ai-assistant#usage-limits",
    tags: ["quota", "messages", "limit", "cooldown"],
  },

  // Reports
  {
    section: "Reports",
    heading: "Generating PDF Reports",
    excerpt:
      "How to download professional PDF summaries of your financial health assessments.",
    route: "/docs/reports#pdf-reports",
    tags: ["export", "download", "summary", "formal"],
  },

  // Account and Privacy
  {
    section: "Account and Privacy",
    heading: "Your Data Privacy",
    excerpt:
      "Learn how we protect your financial data and how it is anonymized for regulatory reports.",
    route: "/docs/account-privacy#privacy",
    tags: ["security", "encryption", "anonymization", "compliance"],
  },
  {
    section: "Account and Privacy",
    heading: "Deleting your account",
    excerpt:
      "What happens to your data and company profiles if you choose to delete your account.",
    route: "/docs/account-privacy#deletion",
    tags: ["account", "data", "removal", "settings"],
  },

  // Troubleshooting
  {
    section: "Troubleshooting",
    heading: "Common Prediction Issues",
    excerpt:
      "What to do if your prediction fails or results seem inconsistent.",
    route: "/docs/troubleshooting#prediction-issues",
    tags: ["error", "fix", "failed", "support"],
  },
  {
    section: "Troubleshooting",
    heading: "Login and Session Issues",
    excerpt:
      "Help with persistent sessions, password resets, and account access problems.",
    route: "/docs/troubleshooting#session-issues",
    tags: ["login", "access", "auth", "session"],
  },
];
