"use client";

/**
 * FinWatch Zambia - Analyst FAQ Page
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_DATA = [
  {
    category: "Analytical Access",
    questions: [
      {
        q: "What is the difference between Regulator and Analyst roles?",
        a: "Regulators have full dashboard access including anomaly investigation and individual SME audit trails. Policy Analysts focus exclusively on aggregate sector performance and institutional reporting.",
      },
      {
        q: "Why can't I see specific SME names?",
        a: "Individual SME data is suppressed for analysts to ensure high standards of financial privacy and to focus the analysis on systemic, rather than individual, economic health.",
      },
    ],
  },
  {
    category: "Data Integrity",
    questions: [
      {
        q: "Where does the sector data come from?",
        a: "All aggregate data is derived from anonymized assessments submitted by Zambian SMEs through the primary SME portal.",
      },
      {
        q: "What is the k-anonymity threshold?",
        a: "To prevent individual entity identification, aggregate metrics are only displayed for sectors with at least 5 active company assessments.",
      },
    ],
  },
  {
    category: "Reporting",
    questions: [
      {
        q: "Can I export data for external analysis?",
        a: "Yes. You can generate professional PDF policy briefs or export aggregate sector data in CSV format for use in external analytical tools.",
      },
    ],
  },
];

export default function AnalystFAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (q: string) => {
    setOpenItems((prev) =>
      prev.includes(q) ? prev.filter((item) => item !== q) : [...prev, q]
    );
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 text-left">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href=\"/institutional/docs/analyst\"
          className="hover:text-blue-600 transition-colors"
        >
          Documentation
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">FAQ</span>
      </nav>

      <div className="mb-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Analyst <span className="text-blue-600">FAQ</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Frequently asked questions regarding analytical tools and data
          boundaries.
        </p>
      </div>

      <div className="space-y-12">
        {FAQ_DATA.map((cat, i) => (
          <div key={i} className="space-y-4">
            <h2 className="text-xl font-bold border-b border-border pb-2 text-zinc-900 dark:text-zinc-100">
              {cat.category}
            </h2>
            <div className="space-y-2">
              {cat.questions.map((item, j) => {
                const isOpen = openItems.includes(item.q);
                return (
                  <div
                    key={j}
                    className={cn(
                      "overflow-hidden rounded-xl border border-border transition-all",
                      isOpen
                        ? "bg-blue-50/30 dark:bg-blue-900/5 border-blue-600/20"
                        : "bg-white dark:bg-zinc-950"
                    )}
                  >
                    <button
                      onClick={() => toggleItem(item.q)}
                      className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-900"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-blue-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {item.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 flex flex-col items-center justify-center rounded-3xl bg-zinc-50 p-8 text-center dark:bg-zinc-900/50">
        <h3 className="text-lg font-bold mb-2">Technical Questions?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          The Analyst AI Assistant can help explain specific metrics and trend
          calculations.
        </p>
        <Link
          href=\"/institutional/docs/analyst\"
          className="text-sm font-bold text-blue-600 hover:underline"
        >
          ← Back to Analyst Documentation
        </Link>
      </div>
    </div>
  );
}
