"use client";

import { AnalystDocsContentLayout } from "@/components/docs/AnalystDocsContentLayout";

export default function AnalystOverviewPage() {
  return (
    <AnalystDocsContentLayout
      title="Analytical Overview"
      nextSection={{
        title: "Sector Performance",
        route: "/institutional/docs/analyst/sector-performance",
      }}
    >
      <section>
        <h2 id="scope">Scope of Analysis</h2>
        <p>
          Policy Analysts in the FinWatch ecosystem are responsible for
          interpreting systemic financial data to inform macroeconomic strategy
          and regulatory adjustments.
        </p>
        <p>
          Unlike direct regulators, analysts focus on{" "}
          <strong>long-term trends</strong> and{" "}
          <strong>sector-wide distributions</strong>. The tools available at
          `/regulator` (shared with analysts) are designed to reveal the
          underlying financial &quot;physics&quot; of the Zambian SME market.
        </p>
      </section>

      <section>
        <h2 id="boundaries">Data Access Boundaries</h2>
        <p>
          To maintain the highest standards of data governance and SME privacy,
          Analyst access is strictly bounded:
        </p>
        <ul>
          <li>
            <strong>No Individual Tracking:</strong> Individual company names
            and raw figures are entirely suppressed from the analytical view.
          </li>
          <li>
            <strong>Aggregated Results Only:</strong> All metrics, including
            distress probabilities, are presented as sector averages or medians.
          </li>
          <li>
            <strong>Restricted Features:</strong> Detailed anomaly investigation
            and individual SME audit trails are restricted to users with the
            full <strong>Regulator</strong> role.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="governance">Institutional Governance</h2>
        <p>
          Every analytical query and report generated is logged within the
          system&apos;s audit trail. This ensures that the platform is used
          exclusively for its intended purpose of supporting Zambian economic
          stability and SME growth.
        </p>
      </section>
    </AnalystDocsContentLayout>
  );
}
