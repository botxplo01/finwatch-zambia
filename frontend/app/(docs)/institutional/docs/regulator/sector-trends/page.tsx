"use client";

import { RegulatorDocsContentLayout } from "@/components/docs/RegulatorDocsContentLayout";

export default function SectorTrendsDocsPage() {
  return (
    <RegulatorDocsContentLayout
      title="Sector Trends"
      previousSection={{
        title: "Institutional Overview",
        route: "/institutional/docs/regulator/overview",
      }}
      nextSection={{
        title: "Anomaly Detection",
        route: "/institutional/docs/regulator/anomaly-detection",
      }}
    >
      <section>
        <h2 id="aggregate">Aggregate Sector Analytics</h2>
        <p>
          The <strong>Insights</strong> dashboard provides a high-level
          bird&apos;s-eye view of the Zambian economy, categorized by industry
          sectors (e.g., Agriculture, Mining, Retail).
        </p>
        <p>
          Each sector displays an <strong>Average Distress Probability</strong>.
          This is the arithmetic mean of all active predictions within that
          sector for the current period. A high average suggests systemic
          headwinds for that particular industry.
        </p>
      </section>

      <section>
        <h2 id="heatmap">Reading the Sector Heatmap</h2>
        <p>
          The heatmap visualization uses color intensity to represent risk
          concentration:
        </p>
        <ul>
          <li>
            <strong>Emerald/Green:</strong> Low risk. Most businesses in this
            sector are classified as Healthy.
          </li>
          <li>
            <strong>Amber/Orange:</strong> Moderate risk. Emerging patterns of
            financial instability.
          </li>
          <li>
            <strong>Red/Rose:</strong> High risk. A significant percentage of
            businesses are flagging for distress.
          </li>
        </ul>
        <p>
          You can hover over any sector in the heatmap to see the precise number
          of assessments and the standard deviation of risk scores within that
          group.
        </p>
      </section>

      <section>
        <h2 id="temporal">Temporal Analysis (Time-Series)</h2>
        <p>
          Regulators can track how distress patterns evolve month-over-month or
          year-over-year. The temporal charts help identify:
        </p>
        <ol>
          <li>
            <strong>Cyclical Vulnerabilities:</strong> Identifying sectors that
            struggle during specific periods (e.g., Agriculture during the lean
            season).
          </li>
          <li>
            <strong>Policy Impact:</strong> Observing shifts in sector health
            following major regulatory or macroeconomic changes.
          </li>
          <li>
            <strong>Macro-Indicators:</strong> Correlating SME health with
            broader Zambian economic indicators like inflation or exchange
            rates.
          </li>
        </ol>
      </section>
    </RegulatorDocsContentLayout>
  );
}
