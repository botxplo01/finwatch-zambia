"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function GettingStartedPage() {
  return (
    <DocsContentLayout
      title="Getting Started"
      nextSection={{
        title: "Understanding Your Results",
        route: "/sme/docs/understanding-results",
      }}
    >
      <section>
        <h2 id="what-is-finwatch">What is FinWatch Zambia</h2>
        <p>
          FinWatch Zambia is a specialized financial health assessment platform
          designed specifically for Small and Medium Enterprises (SMEs) in
          Zambia. Our system uses advanced Machine Learning (AI) to analyze your
          financial data and provide an early warning signal for potential
          financial distress.
        </p>
        <p>
          Unlike traditional bank assessments which can be slow and opaque,
          FinWatch provides immediate, plain-language explanations of your
          business&apos;s strengths and vulnerabilities, helping you take action
          before small problems become large ones.
        </p>
      </section>

      <section>
        <h2 id="creating-account">Creating your account</h2>
        <p>
          To begin, you must register as an SME Owner. During registration, you
          will provide:
        </p>
        <ul>
          <li>
            <strong>Full Name:</strong> Your official name for report
            generation.
          </li>
          <li>
            <strong>Business Email:</strong> Used for login and secure
            communications.
          </li>
          <li>
            <strong>Business Scale:</strong> Choose between &quot;Small Scale&quot; (e.g.,
            market traders, small shops) or &quot;Medium Scale&quot; (e.g., transport
            companies, established retailers with formal bookkeeping).
          </li>
        </ul>
        <p>
          Choosing the correct scale is important, as it determines how simply
          or technically our AI will explain your results to you.
        </p>
      </section>

      <section>
        <h2 id="creating-company">Creating your first company profile</h2>
        <p>
          After logging in, your first step is to create a Company Profile. This
          profile stores the basic information about your business so you don&apos;t
          have to re-enter it for every prediction.
        </p>
        <p>
          Go to the <strong>Companies</strong> page and click &quot;Add New Company&quot;.
          You&apos;ll need the company name and sector (e.g., Agriculture,
          Manufacturing, Services). For example, if you run a poultry farm in
          Chongwe, you would select &quot;Agriculture&quot;.
        </p>
      </section>

      <section>
        <h2 id="first-prediction">
          Running your first prediction — step by step
        </h2>
        <p>Once your company is set up, you can run a health assessment:</p>
        <ol>
          <li>
            Go to the <strong>Predictions</strong> page.
          </li>
          <li>Select your company from the dropdown menu.</li>
          <li>
            Enter the financial period you are assessing (e.g., &quot;Q1 2026&quot; or
            &quot;Full Year 2025&quot;).
          </li>
          <li>
            Choose a model: <strong>Random Forest</strong> (most accurate) or{" "}
            <strong>Logistic Regression</strong> (standard baseline).
          </li>
          <li>
            Enter your financial figures. You can do this manually, upload a
            document, or use our &quot;Conversational Estimation&quot; tool if you don&apos;t
            have formal records.
          </li>
          <li>Click &quot;Run Assessment&quot;.</li>
        </ol>
        <p>
          In a few seconds, you&apos;ll receive your risk score and a detailed
          narrative explaining exactly what the numbers mean for your business.
        </p>
      </section>
    </DocsContentLayout>
  );
}
