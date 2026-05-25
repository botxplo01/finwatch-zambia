"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function SubmittingDataPage() {
  return (
    <DocsContentLayout
      title="Submitting Financial Data"
      previousSection={{
        title: "Financial Concepts",
        route: \"/sme/docs/financial-concepts",
      }}
      nextSection={{ title: "AI Assistant", route: \"/sme/docs/ai-assistant" }}
    >
      <section>
        <h2 id="overview">Data Entry Methods</h2>
        <p>
          FinWatch Zambia offers three flexible ways to provide your financial
          data. We understand that every business has a different level of
          bookkeeping.
        </p>
      </section>

      <section>
        <h2 id="manual-entry">Manual Entry — how to fill in the form</h2>
        <p>
          If you have your Balance Sheet and Income Statement ready, Manual
          Entry is the most precise method.
        </p>
        <p>
          You will be asked for specific values like "Total Current Assets",
          "Long-term Liabilities", and "Net Profit".
        </p>
        <ul>
          <li>
            <strong>Accuracy:</strong> Double-check your zeros. A common mistake
            is entering K1,000 as K10,000, which will significantly skew your
            risk score.
          </li>
          <li>
            <strong>Period:</strong> Ensure all numbers are from the same
            financial period (e.g., all from the 2025 financial year).
          </li>
        </ul>
      </section>

      <section>
        <h2 id="document-upload">Document Upload — AI extraction</h2>
        <p>
          You can upload your financial statements directly, and our AI will
          attempt to extract the required figures for you.
        </p>
        <ul>
          <li>
            <strong>Supported Formats:</strong> PDF (scanned or digital), CSV,
            XLSX, and XLS.
          </li>
          <li>
            <strong>What works best:</strong> Digital PDFs (generated from
            accounting software like Sage or QuickBooks) have the highest
            extraction accuracy. Scanned photos of handwritten ledgers may
            require manual correction.
          </li>
          <li>
            <strong>Verification:</strong> Always review the extracted numbers
            in the form before clicking "Run Assessment".
          </li>
        </ul>
      </section>

      <section>
        <h2 id="conversational">Conversational Estimation</h2>
        <p>
          For businesses without formal financial statements (Small Scale), we
          offer a conversational mode. The system will ask you simple questions
          like "How much cash do you have in your business today?" or "What is
          the total value of the stock in your shop?" and calculate the ratios
          for you.
        </p>
      </section>

      <section>
        <h2 id="data-reuse">Re-using previous data</h2>
        <p>
          If you have already run a prediction for a company, you can use the
          "Auto-populate from Previous" feature. This is useful if you want to
          run a new assessment with only small changes to your figures, saving
          you from re-entering every value.
        </p>
      </section>
    </DocsContentLayout>
  );
}
