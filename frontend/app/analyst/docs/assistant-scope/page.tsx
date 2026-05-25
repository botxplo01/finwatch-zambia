"use client";

import { AnalystDocsContentLayout } from "@/components/docs/AnalystDocsContentLayout";

export default function AIAssistantScopeDocsPage() {
  return (
    <AnalystDocsContentLayout
      title="AI Assistant Scope"
      previousSection={{
        title: "Institutional Reporting",
        route: "/analyst/docs/reporting",
      }}
      nextSection={{ title: "Analyst FAQ", route: "/analyst/docs/faq" }}
    >
      <section>
        <h2 id="guidance">Analytical Guidance</h2>
        <p>
          The built-in AI Assistant is specialized to help you navigate the
          platform's analytical tools and interpret complex financial
          terminology.
        </p>
        <p>
          <strong>What you can ask:</strong> "What does the sector heatmap
          indicate?", "Explain the difference between Random Forest and Logistic
          Regression metrics", or "How is the k-anonymity threshold calculated?"
        </p>
      </section>

      <section>
        <h2 id="boundaries">System Boundaries</h2>
        <p>The assistant operates under strict institutional guardrails:</p>
        <ul>
          <li>
            <strong>No Entity Data:</strong> The assistant cannot retrieve or
            discuss the financial data of any specific SME.
          </li>
          <li>
            <strong>No Economic Forecasting:</strong> While the AI interprets
            existing trends, it does not provide predictive economic forecasts
            outside the system's recorded assessments.
          </li>
          <li>
            <strong>No Policy Advice:</strong> The assistant provides data
            interpretation and platform help; it does not generate official
            economic or regulatory policy recommendations.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="limits">Usage Limits</h2>
        <p>
          To ensure optimal performance for all institutional users, the AI
          assistant has a rolling limit of{" "}
          <strong>15 messages per 2-hour window</strong> for the Documentation
          Assistant and 10 for the main Portal Assistant.
        </p>
      </section>
    </AnalystDocsContentLayout>
  );
}
