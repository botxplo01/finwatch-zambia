"use client";

import { InstitutionalDocsContentLayout } from "@/components/docs/InstitutionalDocsContentLayout";

export default function RegulatorOverviewPage() {
  return (
    <InstitutionalDocsContentLayout
      title="Institutional Overview"
      nextSection={{
        title: "Sector Trends",
        route: "/institutional/docs/regulator/sector-trends",
      }}
    >
      <section>
        <h2 id="purpose">System Purpose and Regulatory Mandate</h2>
        <p>
          FinWatch Zambia serves as a central intelligence layer for regulatory
          bodies (e.g., Bank of Zambia, Ministry of Commerce) to monitor the
          financial stability of the Small and Medium Enterprise (SME) sector.
        </p>
        <p>
          The system&apos;s primary mandate is to provide{" "}
          <strong>early warning signals</strong> for systemic financial
          distress. By aggregating thousands of individual SME assessments,
          regulators can identify emerging vulnerabilities before they escalate
          into broader economic issues.
        </p>
      </section>

      <section>
        <h2 id="anonymization">Anonymization and Privacy Standards</h2>
        <p>
          Data privacy is a foundational principle of the FinWatch architecture.
          The system employs a <strong>one-way institutional firewall</strong>{" "}
          for all SME data:
        </p>
        <ul>
          <li>
            <strong>Zero PII Access:</strong> Regulators cannot see company
            names, individual owner details, or specific raw transaction
            records.
          </li>
          <li>
            <strong>Aggregate Logic:</strong> All data displayed in the
            institutional portal is mathematically aggregated. For example,
            &quot;12.5% of SMEs in the Manufacturing sector are in high distress.&quot;
          </li>
          <li>
            <strong>K-Anonymity:</strong> Sectors with fewer than 5 active
            companies are automatically suppressed from institutional view to
            prevent &quot;reverse-engineering&quot; of individual company status.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="architecture">Platform Architecture</h2>
        <p>
          The system uses a <strong>Dual-Portal Design</strong>. SME owners
          interact with a private dashboard for individual health checks, while
          the Regulator portal connects to the same backend to pull anonymized,
          cross-sector metrics.
        </p>
        <p>
          Assessments are processed using high-performance Random Forest and
          Logistic Regression models trained on historical financial failure
          patterns, ensuring that the oversight data is grounded in verified
          statistical evidence.
        </p>
      </section>
    </InstitutionalDocsContentLayout>
  );
}
