"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function UnderstandingResultsPage() {
  return (
    <DocsContentLayout
      title="Understanding Your Results"
      previousSection={{
        title: "Getting Started",
        route: "/sme/docs/getting-started",
      }}
      nextSection={{
        title: "Financial Concepts",
        route: "/sme/docs/financial-concepts",
      }}
    >
      <section>
        <h2 id="risk-score">What the risk score means</h2>
        <p>
          The primary output of FinWatch is the{" "}
          <strong>Distress Probability Score</strong>. This is a percentage (0%
          to 100%) that indicates how closely your current financial situation
          matches patterns seen in businesses that previously experienced
          financial distress.
        </p>
        <ul>
          <li>
            <strong>0% - 20%: Very Healthy.</strong> Your business shows strong
            stability across most indicators.
          </li>
          <li>
            <strong>21% - 50%: Stable.</strong> Generally healthy, but with some
            areas that could be improved.
          </li>
          <li>
            <strong>51% - 75%: Elevated Risk.</strong> The system has identified
            significant patterns of concern. You should review your cash flow
            immediately.
          </li>
          <li>
            <strong>76% - 100%: High Distress.</strong> Immediate action is
            recommended to address liquidity or solvency issues.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="classification">
          Distressed vs. Healthy — what each classification means
        </h2>
        <p>Beyond the score, the system provides a binary classification:</p>
        <p>
          <strong>Healthy:</strong> Your business's overall profile suggests
          financial stability. Most of your ratios are within safe benchmarks.
        </p>
        <p>
          <strong>Distressed:</strong> This is an early warning. It doesn't mean
          your business will fail tomorrow, but it means the "financial physics"
          of your business currently match the profile of businesses that have
          struggled. For example, if your debt is very high while your cash is
          low, the system will flag this as Distressed.
        </p>
      </section>

      <section>
        <h2 id="shap-chart">How to read the SHAP chart</h2>
        <p>
          The SHAP chart is the "Explainable AI" component of FinWatch. It shows
          you the <strong>why</strong> behind your score.
        </p>
        <p>Each bar on the chart represents a financial ratio.</p>
        <ul>
          <li>
            <strong>Bars to the Right (Positive/Purple):</strong> These ratios
            are <em>increasing</em> your risk. These are your vulnerabilities.
          </li>
          <li>
            <strong>Bars to the Left (Negative/Neutral):</strong> These ratios
            are <em>reducing</em> your risk. These are your strengths.
          </li>
        </ul>
        <p>
          The longer the bar, the more powerful that ratio's influence on your
          final score.
        </p>
      </section>

      <section>
        <h2 id="narrative">Understanding the AI narrative</h2>
        <p>
          FinWatch provides a narrative summary of your results. This narrative
          takes the complex data from the SHAP chart and translates it into
          actionable business advice.
        </p>
        <p>
          If you are registered as a <strong>Small Scale</strong> business, the
          narrative will avoid technical jargon and use simple examples like
          "managing mobile money float" or "supplier credit". If you are{" "}
          <strong>Medium Scale</strong>, it will use more formal financial terms
          like "Working Capital" and "Net Margin".
        </p>
      </section>

      <section>
        <h2 id="what-to-do">
          What to do if your business is classified as distressed
        </h2>
        <ol>
          <li>
            <strong>Don't Panic:</strong> This is a tool for early warning, not
            a final judgment.
          </li>
          <li>
            <strong>Identify the Drivers:</strong> Look at the top purple bars
            in the SHAP chart. Is it your debt? Is it your low cash?
          </li>
          <li>
            <strong>Read the AI Advice:</strong> Follow the concrete steps
            suggested in the narrative.
          </li>
          <li>
            <strong>Consult a Professional:</strong> Use the generated PDF
            report to discuss your situation with an accountant or a bank
            advisor.
          </li>
        </ol>
      </section>
    </DocsContentLayout>
  );
}
