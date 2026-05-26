"use client";

import { AnalystDocsContentLayout } from "@/components/docs/AnalystDocsContentLayout";

export default function InstitutionalReportingDocsPage() {
  return (
    <AnalystDocsContentLayout
      title="Institutional Reporting"
      previousSection={{
        title: "Sector Performance",
        route: "/institutional/docs/analyst/sector-performance",
      }}
      nextSection={{
        title: "AI Assistant Scope",
        route: "/institutional/docs/analyst/assistant-scope",
      }}
    >
      <section>
        <h2 id="policy-briefs">Generating Policy Briefs</h2>
        <p>
          Analysts can generate professional executive summaries that
          encapsulate the current state of the Zambian SME ecosystem.
        </p>
        <p>
          These <strong>PDF Briefs</strong> are designed for internal
          distribution to ministerial or banking leadership. They include
          sector-wide heatmaps, top systemic risk drivers, and average
          probability distributions.
        </p>
      </section>

      <section>
        <h2 id="reliability">Model Reliability and Transparency</h2>
        <p>
          To ensure the integrity of policy recommendations, analysts can view
          technical performance metrics of the underlying AI models.
        </p>
        <ul>
          <li>
            <strong>Metrics:</strong> Access F1-Scores, Precision, and Recall
            for the current production models.
          </li>
          <li>
            <strong>Explainability:</strong> Use the aggregate SHAP insights to
            understand which financial indicators are the most significant
            predictors of stability across the entire Zambian market.
          </li>
          <li>
            <strong>Verification:</strong> This data ensures that all analytical
            insights are derived from models with documented and verified
            accuracy.
          </li>
        </ul>
      </section>
    </AnalystDocsContentLayout>
  );
}
