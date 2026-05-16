"use client";

/**
 * FinWatch Zambia - System Info Overlay
 */

import {
  X,
  Info,
  ShieldCheck,
  Zap,
  Search,
  CheckCircle2,
  Cpu,
  Database,
  ArrowRight,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  useTutorial,
  SME_TUTORIAL_CONFIG,
  REGULATOR_TUTORIAL_CONFIG,
  ANALYST_TUTORIAL_CONFIG,
} from "@/context/TutorialContext";
import { cn } from "@/lib/utils";

type PortalType = "sme" | "regulator" | "analyst";

interface Props {
  open: boolean;
  onClose: () => void;
  type: PortalType;
}

const CONTENT = {
  sme: {
    title: "System Overview",
    description:
      "FinWatch Zambia uses advanced machine learning to provide early warnings of potential financial distress, helping you protect your business before problems arise.",
    sections: [
      {
        title: "Key Features",
        icon: Zap,
        items: [
          "Automated financial ratio computation from raw data.",
          "Probability-based risk assessment (Random Forest & Logistic Regression).",
          "Explainable AI (SHAP) showing which ratios impact your score.",
          "AI Assistant for plain-English analysis of your results.",
        ],
      },
      {
        title: "How It Works",
        icon: Search,
        items: [
          "1. Upload: Enter your Balance Sheet and Income Statement data.",
          "2. Analyze: Our engine calculates 10 core financial health ratios.",
          "3. Predict: Models compare your data against thousands of SME profiles.",
          "4. Act: Receive a detailed risk report and narrative advice.",
        ],
      },
      {
        title: "The ML Models",
        icon: Cpu,
        badge: "Powered by AI",
        content:
          "We use a multi-model ensemble trained on thousands of corporate data points. The Random Forest model looks for complex non-linear patterns, while Logistic Regression provides stable baseline metrics. Together, they achieve over 92% accuracy in predicting liquidity and insolvency risks.",
      },
    ],
    benefits: [
      "Objective, data-driven financial insights.",
      "Early warning before credit or cash-flow issues occur.",
      "Professional-grade reports for bank or investor readiness.",
      "Privacy-first design: Your data belongs to you.",
    ],
  },
  analyst: {
    title: "Strategic Analysis Overview",
    description:
      "FinWatch provides policy analysts with a strategic synthesis of sector-wide financial trends, enabling data-driven economic monitoring and policy evaluation.",
    sections: [
      {
        title: "Strategic Monitoring",
        icon: ShieldCheck,
        items: [
          "Aggregate distress rates across 10+ economic sectors.",
          "12-month temporal trend analysis of Zambian SMEs.",
          "Cross-sector ratio benchmarking and performance KPIs.",
          "Systemic risk distribution by industry and region.",
        ],
      },
      {
        title: "The Link to SMEs",
        icon: Database,
        items: [
          "Aggregated data from thousands of individual SME assessments.",
          "Fully anonymised data synthesis for policy-level review.",
          "No individual company records or PII are ever exposed.",
          "Enables proactive sector-specific support strategies.",
        ],
      },
      {
        title: "ML in Policy",
        icon: Cpu,
        badge: "Strategic Insight",
        content:
          "Policy analysts leverage ML-driven aggregate data to identify emerging financial pressures 3-6 months before traditional indicators. This enables proactive policy intervention and targeted economic support measures.",
      },
    ],
    note: "You are currently viewing the Analyst Portal. Access to individual high-risk anomaly identifiers and full investigative tools is restricted to Regulator-level clearance.",
  },
  regulator: {
    title: "Regulatory Overview",
    description:
      "FinWatch provides a systemic oversight layer, allowing policy analysts and regulators to monitor sector-level financial stability without compromising SME privacy.",
    sections: [
      {
        title: "Systemic Monitoring",
        icon: ShieldCheck,
        items: [
          "Aggregate distress rates across 10+ economic sectors.",
          "Temporal trend analysis of SME financial health in Zambia.",
          "High-risk anomaly detection for proactive intervention.",
          "Model performance tracking to ensure system accuracy.",
        ],
      },
      {
        title: "The Link to SMEs",
        icon: Database,
        items: [
          "SMEs use the portal for individual health assessments.",
          "Anonymized data is aggregated into the regulatory portal.",
          "No PII (Personally Identifiable Information) is ever exposed.",
          "Ensures a data-driven approach to national economic policy.",
        ],
      },
      {
        title: "ML in Oversight",
        icon: Cpu,
        badge: "Predictive Policy",
        content:
          "By analyzing anonymized SME risk profiles, regulators can identify emerging distress in specific regions or industries 3-6 months before they appear in traditional lagging indicators. Our SHAP-based global importance charts reveal which economic factors are currently putting the most pressure on Zambian SMEs.",
      },
    ],
    note: "All data visible in this portal is anonymised and aggregated. Access to anomaly flags is restricted to users with 'Regulator' level clearance.",
  },
};

export function SystemInfoOverlay({ open, onClose, type }: Props) {
  const { startTutorial } = useTutorial();
  const [mounted, setMounted] = useState(false);
  const data = CONTENT[type];

  useEffect(() => {
    setMounted(true);
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const handleStartTutorial = () => {
    onClose();
    setTimeout(() => {
      let config = REGULATOR_TUTORIAL_CONFIG;
      if (type === "sme") config = SME_TUTORIAL_CONFIG;
      if (type === "analyst") config = ANALYST_TUTORIAL_CONFIG;
      startTutorial(config);
    }, 300);
  };

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-lg h-full bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-2xl shadow-2xl border-l border-gray-100/50 dark:border-zinc-800/50 overflow-y-auto animate-in slide-in-from-right duration-500 ease-out flex flex-col`}
      >
        <div
          className={`sticky top-0 z-20 px-6 py-5 bg-white/40 dark:bg-white/5 backdrop-blur-md border-b border-gray-50/50 dark:border-zinc-900/50 flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-500",
                type === "sme"
                  ? "bg-purple-50 dark:bg-purple-900/20"
                  : type === "analyst"
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "bg-emerald-50 dark:bg-emerald-900/20",
              )}
            >
              <Info
                className={cn(
                  "transition-colors duration-500",
                  type === "sme"
                    ? "text-purple-600 dark:text-purple-400"
                    : type === "analyst"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400",
                )}
                size={18}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                {data.title}
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-tight">
                System Guidance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-8 pb-20">
          <section className="p-5 rounded-2xl border-2 border-dashed border-gray-100 dark:border-zinc-800 flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                Need a guided tour?
              </h3>
              <p className="text-[13px] text-gray-500 dark:text-zinc-400 font-medium">
                Let us show you around the key features of the {type === "analyst" ? "analyst" : type} portal.
              </p>
            </div>
            <button
              onClick={handleStartTutorial}
              className={cn(
                "flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-95 shadow-md",
                type === "sme"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : type === "analyst"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              <Play size={14} fill="currentColor" /> Start Guided Tutorial
            </button>
          </section>

          <section>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400 font-medium">
              {data.description}
            </p>
          </section>

          {data.sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <section key={idx} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "transition-colors duration-500",
                        type === "sme"
                          ? "text-purple-500"
                          : type === "analyst"
                            ? "text-blue-500"
                            : "text-emerald-500",
                      )}
                      size={16}
                    />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                      {section.title}
                    </h3>
                  </div>
                  {section.badge && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors duration-500",
                        type === "sme"
                          ? "bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800"
                          : type === "analyst"
                            ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"
                            : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800",
                      )}
                    >
                      {section.badge}
                    </span>
                  )}
                </div>

                {section.items ? (
                  <ul className="grid grid-cols-1 gap-2">
                    {section.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-gray-100/50 dark:border-zinc-800/50"
                      >
                        <CheckCircle2
                          className={cn(
                            "mt-0.5 flex-shrink-0 transition-colors duration-500",
                            type === "sme"
                              ? "text-purple-500"
                              : type === "analyst"
                                ? "text-blue-500"
                                : "text-emerald-500",
                          )}
                          size={14}
                        />
                        <span className="text-xs text-gray-600 dark:text-zinc-400 leading-normal font-medium">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 rounded-xl bg-white/40 dark:bg-white/5 border border-gray-100/50 dark:border-zinc-800/50">
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed italic font-medium">
                      {section.content}
                    </p>
                  </div>
                )}
              </section>
            );
          })}

          {type === "sme" && CONTENT.sme.benefits && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                Benefits to You
              </h3>
              <div className="p-4 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-500/20">
                <ul className="space-y-2">
                  {CONTENT.sme.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ArrowRight
                        className="mt-1 flex-shrink-0 opacity-70"
                        size={12}
                      />
                      <span className="text-xs font-bold">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(type === "regulator" || type === "analyst") &&
            (CONTENT.regulator.note || CONTENT.analyst.note) && (
              <div
                className={cn(
                  "p-4 rounded-xl flex gap-3 transition-colors duration-500",
                  type === "analyst"
                    ? "bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30"
                    : "bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30",
                )}
              >
                <ShieldCheck
                  className={cn(
                    "flex-shrink-0 transition-colors duration-500",
                    type === "analyst"
                      ? "text-blue-600 dark:text-blue-500"
                      : "text-amber-600 dark:text-amber-500",
                  )}
                  size={18}
                />
                <p
                  className={cn(
                    "text-[11px] font-bold leading-relaxed transition-colors duration-500",
                    type === "analyst"
                      ? "text-blue-800 dark:text-blue-400"
                      : "text-amber-800 dark:text-amber-400",
                  )}
                >
                  {type === "analyst" ? CONTENT.analyst.note : CONTENT.regulator.note}
                </p>
              </div>
            )}
        </div>

        <div className="mt-auto px-6 pt-6 pb-8 border-t border-gray-50 dark:border-zinc-900 flex justify-center">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-5 py-1.5 rounded-full border border-gray-100 dark:border-zinc-800 shadow-sm">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
