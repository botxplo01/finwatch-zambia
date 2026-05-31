"use client";

/**
 * FinWatch Zambia - FAQ Page
 *
 * Accordion-style frequently asked questions.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_DATA = [
  {
    category: "About the System",
    questions: [
      {
        q: "What is FinWatch Zambia?",
        a: "FinWatch Zambia is a proof-of-concept AI system designed to help Zambian SMEs monitor their financial health. It uses machine learning to predict potential financial distress based on historical business data.",
      },
      {
        q: "Is FinWatch a banking app?",
        a: "No. FinWatch is an analytical tool. We do not hold your money, facilitate payments, or provide actual loans. We provide information to help you make better business decisions.",
      },
      {
        q: "Who developed this system?",
        a: "The system was developed as a research project at Cavendish University Zambia (2026) to address the credit gap for SMEs in Zambia.",
      },
      {
        q: "Is there a mobile app?",
        a: "Yes! FinWatch Zambia is available as an Android application, featuring 30-day persistent sessions and native mobile optimization.",
      },
    ],
  },
  {
    category: "About Your Data",
    questions: [
      {
        q: "Is my financial data secure?",
        a: "Yes. All data is stored in encrypted databases. We use secure authentication protocols (JWT) to ensure only you can access your company's figures.",
      },
      {
        q: "Can the government see my specific numbers?",
        a: "No. Regulators only see aggregate, anonymized sector trends. They can see general health across the country, but never your specific company name or private figures.",
      },
      {
        q: "How long is my data stored?",
        a: "Your data is stored as long as your account is active. If you delete your account, all your data, including company profiles and prediction history, is permanently removed.",
      },
      {
        q: "Can I use the system without formal records?",
        a: "Yes. If you don't have formal statements, you can use our 'Conversational Estimation' tool which helps you estimate your figures through simple business questions.",
      },
    ],
  },
  {
    category: "About Predictions and Results",
    questions: [
      {
        q: "How accurate are the predictions?",
        a: "The system uses models trained on thousands of business records. While high, accuracy is never 100%. Predictions should be used as a guide, not a guarantee.",
      },
      {
        q: "What if the system says my business is 'Distressed'?",
        a: "This is an early warning. It means your current financial ratios match patterns often seen in businesses that struggle. It's an invitation to review your costs and cash flow.",
      },
      {
        q: "Which AI model should I use?",
        a: "We recommend the Random Forest model for the best overall accuracy. Logistic Regression is provided as a standard comparison baseline.",
      },
      {
        q: "Can I download my results?",
        a: "Yes. Every prediction can be exported as a professional PDF report or a CSV file for your records.",
      },
    ],
  },
  {
    category: "About the AI Assistant",
    questions: [
      {
        q: "What can I ask the AI Assistant?",
        a: "You can ask it to explain financial terms, interpret your specific results, or help you find your way around the platform.",
      },
      {
        q: "Is there a limit to how many questions I can ask?",
        a: "Yes. To ensure system stability, there is a rolling limit of 10 messages every 2 hours. The documentation AI assistant also has its own 15-message limit.",
      },
      {
        q: "Does the AI give financial advice?",
        a: "No. The AI provides educational guidance and data interpretation only. It cannot give specific investment, legal, or tax advice.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (q: string) => {
    setOpenItems((prev) =>
      prev.includes(q) ? prev.filter((item) => item !== q) : [...prev, q]
    );
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/sme/docs"
          className="hover:text-purple-600 transition-colors"
        >
          Documentation
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">FAQ</span>
      </nav>

      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Frequently Asked <span className="text-purple-600">Questions</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Quick answers to the most common questions about FinWatch Zambia.
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
                        ? "bg-purple-50/30 dark:bg-purple-900/5 border-purple-600/20"
                        : "bg-white dark:bg-zinc-950"
                    )}
                  >
                    <button
                      onClick={() => toggleItem(item.q)}
                      className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-purple-600" />
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
        <h3 className="text-lg font-bold mb-2">
          Can&apos;t find what you&apos;re looking for?
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Our AI Assistant is available 24/7 to answer specific questions about
          the platform.
        </p>
        <Link
          href="/sme/docs"
          className="text-sm font-bold text-purple-600 hover:underline"
        >
          ← Back to Documentation Home
        </Link>
      </div>
    </div>
  );
}
