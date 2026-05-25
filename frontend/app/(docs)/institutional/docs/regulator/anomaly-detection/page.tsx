"use client";

import { RegulatorDocsContentLayout } from "@/components/docs/RegulatorDocsContentLayout";

export default function AnomalyDetectionDocsPage() {
  return (
    <RegulatorDocsContentLayout
      title="Anomaly Detection"
      previousSection={{
        title: "Sector Trends",
        route: \"/institutional/docs/regulator/sector-trends",
      }}
      nextSection={{
        title: "Institutional Reporting",
        route: \"/institutional/docs/regulator/reporting",
      }}
    >
      <section>
        <h2 id="logic">Detection Logic and Methodology</h2>
        <p>
          Beyond standard distress prediction, FinWatch employs an{" "}
          <strong>Anomaly Detection Engine</strong> to flag SME records that
          exhibit unusual statistical patterns.
        </p>
        <p>
          Unlike "Distress," which measures failure risk, "Anomaly" measures{" "}
          <strong>statistical distance</strong> from established norms. A
          business might be perfectly healthy but still be flagged as an anomaly
          if its financial ratios are extreme or inconsistent with its peers.
        </p>
      </section>

      <section>
        <h2 id="thresholds">Statistical Thresholds</h2>
        <p>
          The system uses a combination of <strong>Z-Score analysis</strong> and{" "}
          <strong>Isolation Forests</strong> to identify outliers. Key triggers
          include:
        </p>
        <ul>
          <li>
            <strong>Out-of-Bounds Ratios:</strong> Ratios that are
            mathematically impossible or highly improbable within the Zambian
            context.
          </li>
          <li>
            <strong>Internal Inconsistency:</strong> For example, reporting very
            high revenue while simultaneously reporting zero current assets.
          </li>
          <li>
            <strong>Cross-Sector Variance:</strong> Businesses that deviate
            significantly from the "typical" financial profile of their
            industry.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="investigation">Investigating and Acting on Flags</h2>
        <p>
          Anomaly flags are presented in the <strong>Anomalies</strong> section
          of the portal. Regulators should treat these as{" "}
          <strong>indicators for further review</strong>, not definitive proof
          of misconduct or failure.
        </p>
        <ol>
          <li>
            <strong>Review the Ratio Profile:</strong> Identify which specific
            ratio triggered the outlier flag.
          </li>
          <li>
            <strong>Analyze Aggregate Impact:</strong> Determine if a high
            number of anomalies are emerging in a single sector, which might
            suggest a reporting trend or systemic shift.
          </li>
          <li>
            <strong>Export for Audit:</strong> Use the CSV export feature to
            share anomaly data with investigation or audit departments.
          </li>
        </ol>
      </section>
    </RegulatorDocsContentLayout>
  );
}
