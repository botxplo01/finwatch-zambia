"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function FinancialConceptsPage() {
  return (
    <DocsContentLayout
      title="Financial Concepts"
      previousSection={{
        title: "Understanding Your Results",
        route: "/sme/docs/understanding-results",
      }}
      nextSection={{
        title: "Submitting Financial Data",
        route: "/sme/docs/submitting-data",
      }}
    >
      <section>
        <h2 id="intro">Financial Health Indicators</h2>
        <p>
          FinWatch Zambia evaluates your business using 10 core financial
          ratios. A ratio is simply a comparison of two numbers from your
          financial records that tells a story about your performance.
        </p>
      </section>

      <section>
        <h2 id="liquidity">Liquidity Ratios (Your Cash Safety Net)</h2>
        <p>
          These ratios measure if you have enough cash or &quot;easy-to-sell&quot; assets
          to pay your immediate bills.
        </p>

        <h3 id="current-ratio">Current Ratio</h3>
        <p>
          <strong>Definition:</strong> Total Current Assets divided by Total
          Current Liabilities.
        </p>
        <p>
          <strong>Zambian Example:</strong> If you have K20,000 worth of stock
          and cash, and you owe suppliers K10,000 this month, your ratio is 2.0.
        </p>
        <p>
          <strong>Healthy Range:</strong> 1.5 to 2.5 is ideal. Below 1.0 means
          you may struggle to pay your bills on time.
        </p>

        <h3 id="quick-ratio">Quick Ratio (The Acid Test)</h3>
        <p>
          <strong>Definition:</strong> Current Assets (minus Inventory) divided
          by Current Liabilities.
        </p>
        <p>
          <strong>Why it matters:</strong> It tests if you can pay bills{" "}
          <em>without</em> having to sell your stock first.
        </p>

        <h3 id="cash-ratio">Cash Ratio</h3>
        <p>
          <strong>Definition:</strong> Cash and Bank Balances divided by Current
          Liabilities.
        </p>
        <p>
          <strong>Why it matters:</strong> This is your ultimate safety net —
          purely the money sitting in your bank account or mobile money wallet
          today.
        </p>
      </section>

      <section>
        <h2 id="leverage">Leverage Ratios (Your Borrowing Health)</h2>
        <p>
          These measure how much of your business is funded by debt versus your
          own money.
        </p>

        <h3 id="debt-to-equity">Debt-to-Equity Ratio</h3>
        <p>
          <strong>Definition:</strong> Total Liabilities divided by Total
          Equity.
        </p>
        <p>
          <strong>Zambian Example:</strong> If you have invested K50,000 of your
          own money but have a bank loan of K100,000, your ratio is 2.0.
        </p>
        <p>
          <strong>Healthy Range:</strong> Generally below 2.0. High leverage
          increases your risk during slow business months.
        </p>

        <h3 id="debt-to-assets">Debt-to-Assets Ratio</h3>
        <p>
          <strong>Definition:</strong> Total Liabilities divided by Total
          Assets.
        </p>
        <p>
          <strong>Why it matters:</strong> Shows what percentage of your
          business equipment and property is actually &quot;owned&quot; by the bank or
          lenders.
        </p>

        <h3 id="interest-coverage">Interest Coverage Ratio</h3>
        <p>
          <strong>Definition:</strong> Profit before interest (EBIT) divided by
          Interest Expense.
        </p>
        <p>
          <strong>Healthy Range:</strong> Above 3.0 is safe. Below 1.5 means
          almost all your profit is going just to pay interest on loans.
        </p>
      </section>

      <section>
        <h2 id="profitability">Profitability Ratios (Your Performance)</h2>

        <h3 id="net-profit-margin">Net Profit Margin</h3>
        <p>
          <strong>Definition:</strong> Net Profit divided by Total Revenue.
        </p>
        <p>
          <strong>Zambian Example:</strong> If a restaurant sells K1,000 of food
          and keeps K100 after all costs (charcoal, wages, ingredients), the
          margin is 10%.
        </p>
        <p>
          <strong>Healthy Range:</strong> Varies by sector, but generally above
          5% is a good baseline for SMEs.
        </p>

        <h3 id="roa">Return on Assets (ROA)</h3>
        <p>
          <strong>Definition:</strong> Net Profit divided by Total Assets.
        </p>
        <p>
          <strong>Why it matters:</strong> Shows how well your equipment
          (fridges, trucks, tools) is generating money for you.
        </p>

        <h3 id="roe">Return on Equity (ROE)</h3>
        <p>
          <strong>Definition:</strong> Net Profit divided by Shareholder&apos;s
          Equity.
        </p>
        <p>
          <strong>Why it matters:</strong> Shows the return on the actual money
          you have personally invested in the business.
        </p>

        <h3 id="asset-turnover">Asset Turnover Ratio</h3>
        <p>
          <strong>Definition:</strong> Total Revenue divided by Total Assets.
        </p>
        <p>
          <strong>Why it matters:</strong> Measures how &quot;busy&quot; your assets are.
          A high turnover means you are using your resources efficiently to make
          sales.
        </p>
      </section>

      <section>
        <h2 id="ml-basics">What is Machine Learning?</h2>
        <p>
          You don&apos;t need to be a scientist to use FinWatch. Machine Learning is
          simply a way for a computer to &quot;learn&quot; from thousands of historical
          examples of healthy and failing businesses. By looking at your 10
          ratios together, the AI identifies patterns that a human might miss,
          providing you with a more accurate prediction of your future
          stability.
        </p>
      </section>
    </DocsContentLayout>
  );
}
