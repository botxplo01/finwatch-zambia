"use client";

import { AnalystDocsContentLayout } from "@/components/docs/AnalystDocsContentLayout";

export default function SectorPerformanceDocsPage() {
  return (
    <AnalystDocsContentLayout
      title="Sector Performance"
      previousSection={{
        title: "Analytical Overview",
        route: \"/institutional/docs/analyst/overview",
      }}
      nextSection={{
        title: "Institutional Reporting",
        route: \"/institutional/docs/analyst/reporting",
      }}
    >
      <section>
        <h2 id="metrics">Interpreting Aggregate Metrics</h2>
        <p>
          The system calculates health metrics by grouping SME assessments into
          their respective sectors (e.g., Agriculture, Manufacturing, Services).
        </p>
        <p>
          <strong>Average Distress Probability:</strong> This indicates the
          overall risk level of a sector. An average above 50% suggests that
          more than half of the businesses in that industry are exhibiting
          financial distress patterns.
        </p>
      </section>

      <section>
        <h2 id="trends">Economic Trend Tracking</h2>
        <p>
          The temporal analysis tools allow analysts to observe shifts in
          financial health over time.
        </p>
        <ul>
          <li>
            <strong>Quarterly Comparisons:</strong> Identifying sectors that are
            gaining or losing stability over the fiscal year.
          </li>
          <li>
            <strong>Risk Distribution:</strong> Observing the spread of risk
            scores within a sector to identify if distress is concentrated or
            widespread.
          </li>
          <li>
            <strong>Macro-Correlations:</strong> Analysts should correlate these
            trends with external data such as Zambian inflation rates, fuel
            prices, or exchange rate fluctuations.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="policy-insights">Deriving Policy Insights</h2>
        <p>
          By identifying which financial ratios (e.g., Current Ratio or
          Debt-to-Equity) are most frequently driving distress within a sector,
          analysts can recommend targeted interventions, such as specialized
          credit facilities or bookkeeping training programs for specific
          industries.
        </p>
      </section>
    </AnalystDocsContentLayout>
  );
}
