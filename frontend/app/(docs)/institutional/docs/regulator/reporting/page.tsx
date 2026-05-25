"use client";

/**
 * FinWatch Zambia - Institutional Reporting Documentation
 */

import { RegulatorDocsContentLayout } from "@/components/docs/RegulatorDocsContentLayout";

export default function InstitutionalReportingDocsPage() {
  return (
    <RegulatorDocsContentLayout
      title="Institutional Reporting"
      previousSection={{
        title: "Anomaly Detection",
        route: \"/institutional/docs/regulator/anomaly-detection",
      }}
      nextSection={{
        title: "AI Governance",
        route: \"/institutional/docs/regulator/governance",
      }}
    >
      <section>
        <h2 id="summaries">Cross-Sector PDF Summaries</h2>
        <p>
          Regulators can generate high-level executive summaries that capture
          the overall health of the Zambian SME ecosystem.
        </p>
        <p>
          These <strong>PDF Reports</strong> include aggregate risk levels,
          sector heatmaps, and a summary of top systemic vulnerabilities (ratios
          that are most frequently pulling the economy towards distress).
        </p>
      </section>

      <section>
        <h2 id="exports">CSV and Excel Data Exports</h2>
        <p>
          For deep-dive analysis in external tools (like PowerBI or Stata), the
          platform supports structured data exports.
        </p>
        <ul>
          <li>
            <strong>Anonymized Records:</strong> Download thousands of
            anonymized assessment records including calculated ratios and ML
            outcomes.
          </li>
          <li>
            <strong>Anomaly Lists:</strong> Export specific anomaly flags for
            institutional audit workflows.
          </li>
          <li>
            <strong>Format:</strong> All data is exported in standard UTF-8 CSV
            format for universal compatibility.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="model-metrics">Model Performance Metrics</h2>
        <p>
          The reporting portal provides transparency into the accuracy of our AI
          models.
        </p>
        <p>
          Regulators can access real-time metrics on{" "}
          <strong>Random Forest</strong> and{" "}
          <strong>Logistic Regression</strong> performance, including F1-Scores,
          Precision, and Recall. This ensures that policy decisions are based on
          models with verified and documented reliability.
        </p>
      </section>
    </RegulatorDocsContentLayout>
  );
}
