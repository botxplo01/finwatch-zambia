"use client";

import { InstitutionalDocsContentLayout } from "@/components/docs/InstitutionalDocsContentLayout";

export default function AnomalyDetectionDocsPage() {
  return (
    <InstitutionalDocsContentLayout
      title="Anomaly Detection"
      description="Identifying SME distress through statistical outliers."
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold">What is Anomaly Detection?</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The FinWatch Zambia anomaly detection engine monitors incoming SME
          assessments for high-risk profiles that exceed a designated
          probability threshold. Unlike standard reporting, these flags are
          intended to highlight immediate intervention candidates for regulatory
          review.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-bold">Threshold Logic</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Assessments are automatically flagged as anomalies when the
          following conditions are met:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Distress Probability ≥ 70%:</strong> Any prediction where
            the Random Forest model assigns a 70% or higher probability of
            failure.
          </li>
          <li>
            <strong>Extreme Ratio Outliers:</strong> Financial ratios that fall
            significantly outside the 95th percentile of the industry norm.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-bold">Privacy &amp; Anonymisation</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          While these flags indicate high risk, the data remains subject to
          strict anonymisation protocols:
        </p>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
            <strong>Note:</strong> Institutional users cannot see the SME name,
            owner name, or exact address. Flags are tracked via internal
            Reference IDs (#) and sectoral classification only.
          </p>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-bold">Investigation Workflow</h2>
        <ol className="list-decimal pl-6 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong>Initial Review:</strong> Regulators review the flagged
            list, sorted by distress probability.
          </li>
          <li>
            <strong>Sector Comparison:</strong> Compare the flagged SME&apos;s ratios
            against the sector benchmark to determine if the distress is
            idiosyncratic or systemic.
          </li>
          <li>
            <strong>Export for Audit:</strong> Use the CSV export feature to
            share anomaly data with investigation or audit departments.
          </li>
        </ol>
      </section>
    </InstitutionalDocsContentLayout>
  );
}
