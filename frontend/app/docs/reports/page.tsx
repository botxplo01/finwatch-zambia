"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function ReportsPage() {
  return (
    <DocsContentLayout
      title="Reports"
      previousSection={{ title: "AI Assistant", route: "/docs/ai-assistant" }}
      nextSection={{ title: "Account and Privacy", route: "/docs/account-privacy" }}
    >
      <section>
        <h2 id="overview">Documenting Your Progress</h2>
        <p>
          FinWatch allows you to turn your digital predictions into formal PDF reports. These are useful for record-keeping, sharing with business partners, or discussing with financial advisors.
        </p>
      </section>

      <section>
        <h2 id="pdf-reports">How to generate and download a PDF report</h2>
        <ol>
          <li>Run a new prediction or find a previous one in your <strong>History</strong>.</li>
          <li>On the result page, click the <strong>"Export PDF"</strong> button.</li>
          <li>The system will generate a professional document and prompt you to download it.</li>
        </ol>
        <p>
          If you are using the mobile app, the PDF will be saved to your device's downloads folder.
        </p>
      </section>

      <section>
        <h2 id="report-content">What the report contains</h2>
        <p>
          Every FinWatch assessment report includes:
        </p>
        <ul>
          <li><strong>Institutional Header:</strong> Official FinWatch branding and assessment date.</li>
          <li><strong>Executive Summary:</strong> Your distress probability and classification status.</li>
          <li><strong>Ratio Breakdown:</strong> A table of all 10 ratios calculated for that period.</li>
          <li><strong>Visual Explanation:</strong> A snapshot of your SHAP feature attribution chart.</li>
          <li><strong>AI Narrative:</strong> The full plain-language assessment and recommendations.</li>
        </ul>
      </section>

      <section>
        <h2 id="sharing">Using your reports</h2>
        <p>
          These reports are designed to bridge the communication gap. You can take them to your bank manager to demonstrate that you are proactively monitoring your business health,
          or use them during internal monthly reviews to track improvements in your liquidity and profitability.
        </p>
      </section>
    </DocsContentLayout>
  );
}
