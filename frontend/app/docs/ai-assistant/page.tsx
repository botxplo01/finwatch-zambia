"use client";

import { DocsContentLayout } from "@/components/docs/DocsContentLayout";

export default function AIAssistantPage() {
  return (
    <DocsContentLayout
      title="AI Assistant"
      previousSection={{
        title: "Submitting Financial Data",
        route: "/docs/submitting-data",
      }}
      nextSection={{ title: "Reports", route: "/docs/reports" }}
    >
      <section>
        <h2 id="overview">Your Conversational Partner</h2>
        <p>
          FinWatch Zambia features a built-in AI Assistant to help you navigate
          the platform and understand your financial health results. You can
          access it through the floating purple chat icon in your dashboard.
        </p>
      </section>

      <section>
        <h2 id="assistant-scope">What the AI Assistant can help with</h2>
        <ul>
          <li>
            <strong>Interpreting Ratios:</strong> "What does it mean if my
            current ratio is 0.8?"
          </li>
          <li>
            <strong>Platform Guidance:</strong> "How do I add a new company
            profile?" or "Where can I find my previous reports?"
          </li>
          <li>
            <strong>Result Deep-Dives:</strong> "Can you explain why my ROA is
            pulling me towards distress?"
          </li>
          <li>
            <strong>Business Scenarios:</strong> "I'm thinking of taking a loan
            for a new truck, how will that affect my debt ratios?"
          </li>
        </ul>
      </section>

      <section>
        <h2 id="assistant-limits">What the AI Assistant cannot do</h2>
        <p>
          The assistant is a specialized reference tool, not a professional
          consultant.
        </p>
        <ul>
          <li>
            <strong>No Financial Advice:</strong> The assistant cannot tell you
            which stocks to buy, which banks to use, or give legal advice.
          </li>
          <li>
            <strong>No Real-time Data:</strong> The assistant only knows about
            the data you have submitted to the platform. It cannot see your
            actual bank accounts or external market data.
          </li>
          <li>
            <strong>No Transactions:</strong> You cannot use the assistant to
            move money, pay bills, or apply for actual loans.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="usage-limits">Understanding the usage limit</h2>
        <p>
          To ensure high performance for all users, the AI Assistant has a
          rolling usage limit:
        </p>
        <ul>
          <li>
            <strong>Limit:</strong> 10 messages every 2 hours.
          </li>
          <li>
            <strong>Reset:</strong> The window resets 2 hours after your first
            message in that session.
          </li>
          <li>
            <strong>Docs Assistant:</strong> The Documentation AI Assistant (the
            one you are using now) has its own separate limit of 15 messages.
          </li>
        </ul>
        <p>
          If you reach the limit, the system will show you exactly when your
          next messages will be available.
        </p>
      </section>
    </DocsContentLayout>
  );
}
