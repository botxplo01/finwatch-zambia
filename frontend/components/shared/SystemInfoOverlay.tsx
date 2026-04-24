"use client";

import { 
  X, 
  Info, 
  ShieldCheck, 
  Zap, 
  Search,
  CheckCircle2,
  Cpu,
  Database,
  ArrowRight
} from "lucide-react";
import { useEffect, useState } from "react";

type PortalType = "sme" | "regulator";

interface Props {
  open: boolean;
  onClose: () => void;
  type: PortalType;
}

const CONTENT = {
  sme: {
    title: "System Overview",
    description: "FinWatch Zambia uses advanced machine learning to provide early warnings of potential financial distress, helping you protect your business before problems arise.",
    sections: [
      {
        title: "Key Features",
        icon: Zap,
        items: [
          "Automated financial ratio computation from raw data.",
          "Probability-based risk assessment (Random Forest & Logistic Regression).",
          "Explainable AI (SHAP) showing which ratios impact your score.",
          "AI Assistant for plain-English analysis of your results."
        ]
      },
      {
        title: "How It Works",
        icon: Search,
        items: [
          "1. Upload: Enter your Balance Sheet and Income Statement data.",
          "2. Analyze: Our engine calculates 10 core financial health ratios.",
          "3. Predict: Models compare your data against thousands of SME profiles.",
          "4. Act: Receive a detailed risk report and narrative advice."
        ]
      },
      {
        title: "The ML Models",
        icon: Cpu,
        badge: "Powered by AI",
        content: "We use a multi-model ensemble trained on thousands of corporate data points. The Random Forest model looks for complex non-linear patterns, while Logistic Regression provides stable baseline metrics. Together, they achieve over 92% accuracy in predicting liquidity and insolvency risks."
      }
    ],
    benefits: [
      "Objective, data-driven financial insights.",
      "Early warning before credit or cash-flow issues occur.",
      "Professional-grade reports for bank or investor readiness.",
      "Privacy-first design: Your data belongs to you."
    ]
  },
  regulator: {
    title: "Regulatory Overview",
    description: "FinWatch provides a systemic oversight layer, allowing policy analysts and regulators to monitor sector-level financial stability without compromising SME privacy.",
    sections: [
      {
        title: "Systemic Monitoring",
        icon: ShieldCheck,
        items: [
          "Aggregate distress rates across 10+ economic sectors.",
          "Temporal trend analysis of SME financial health in Zambia.",
          "High-risk anomaly detection for proactive intervention.",
          "Model performance tracking to ensure system accuracy."
        ]
      },
      {
        title: "The Link to SMEs",
        icon: Database,
        items: [
          "SMEs use the portal for individual health assessments.",
          "Anonymized data is aggregated into the regulatory portal.",
          "No PII (Personally Identifiable Information) is ever exposed.",
          "Ensures a data-driven approach to national economic policy."
        ]
      },
      {
        title: "ML in Oversight",
        icon: Cpu,
        badge: "Predictive Policy",
        content: "By analyzing anonymized SME risk profiles, regulators can identify emerging distress in specific regions or industries 3-6 months before they appear in traditional lagging indicators. Our SHAP-based global importance charts reveal which economic factors are currently putting the most pressure on Zambian SMEs."
      }
    ],
    note: "All data visible in this portal is anonymised and aggregated. Access to anomaly flags is restricted to users with 'Regulator' level clearance."
  }
};

export function SystemInfoOverlay({ open, onClose, type }: Props) {
  const [mounted, setMounted] = useState(false);
  const data = CONTENT[type];
  const themeColor = type === "sme" ? "purple" : "emerald";

  useEffect(() => {
    setMounted(true);
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [open]);

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Fly-out panel */}
      <div className={`relative w-full max-w-lg h-full bg-white dark:bg-zinc-950 shadow-2xl border-l border-gray-100 dark:border-zinc-800 overflow-y-auto animate-in slide-in-from-right duration-500 ease-out flex flex-col`}>
        {/* Header */}
        <div className={`sticky top-0 z-20 px-6 py-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-50 dark:border-zinc-900 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-${themeColor}-50 dark:bg-${themeColor}-900/20 flex items-center justify-center`}>
              <Info className={`text-${themeColor}-600 dark:text-${themeColor}-400`} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{data.title}</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">System Documentation & Guidance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-10 pb-32">
          {/* Intro */}
          <section>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
              {data.description}
            </p>
          </section>

          {/* Dynamic Sections */}
          {data.sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <section key={idx} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`text-${themeColor}-500`} size={18} />
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100">{section.title}</h3>
                  </div>
                  {section.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-${themeColor}-50 dark:bg-${themeColor}-900/40 text-${themeColor}-700 dark:text-${themeColor}-300 border border-${themeColor}-100 dark:border-${themeColor}-800`}>
                      {section.badge}
                    </span>
                  )}
                </div>
                
                {section.items ? (
                  <ul className="grid grid-cols-1 gap-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-100/50 dark:border-zinc-800/50">
                        <CheckCircle2 className={`mt-0.5 text-${themeColor}-500 flex-shrink-0`} size={14} />
                        <span className="text-xs text-gray-600 dark:text-zinc-400 leading-normal font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-100/50 dark:border-zinc-800/50">
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed italic font-medium">
                      {section.content}
                    </p>
                  </div>
                )}
              </section>
            );
          })}

          {/* Benefits/Note */}
          {type === "sme" && data.benefits && (
            <section className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">Benefits to You</h3>
              <div className={`p-5 rounded-2xl bg-${themeColor}-600 text-white shadow-lg shadow-${themeColor}-500/20`}>
                <ul className="space-y-3">
                  {data.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ArrowRight className="mt-1 flex-shrink-0 opacity-70" size={12} />
                      <span className="text-xs font-bold">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {type === "regulator" && CONTENT.regulator.note && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
              <ShieldCheck className="text-amber-600 dark:text-amber-500 flex-shrink-0" size={18} />
              <p className="text-[11px] text-amber-800 dark:text-amber-400 font-bold leading-relaxed">
                {CONTENT.regulator.note}
              </p>
            </div>
          )}
        </div>

        {/* End-of-page Footer with Divider — Only seen at the very bottom */}
        <div className="mt-auto px-6 pt-10 pb-12 border-t border-gray-50 dark:border-zinc-900 flex justify-center">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-gray-100 dark:border-zinc-800 shadow-sm">
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
