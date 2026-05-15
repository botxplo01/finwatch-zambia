"use client";

/**
 * FinWatch Zambia - Regulator Auth Feature Showcase
 */

import { useEffect, useState } from "react";
import {
  BarChart3,
  ShieldCheck,
  Zap,
  Globe,
  PieChart,
} from "lucide-react";

const FEATURES = [
  {
    title: "Systemic Risk Oversight",
    description:
      "Monitor sector-wide financial health through aggregated analytics and temporal trend detection.",
    icon: Globe,
  },
  {
    title: "Predictive Policy Insights",
    description:
      "Leverage machine learning to anticipate sector-level distress before it impacts the national economy.",
    icon: BarChart3,
  },
  {
    title: "Explainable Governance",
    description:
      "Full transparency via SHAP values. Understand exactly which financial drivers are influencing sector stability.",
    icon: Zap,
  },
  {
    title: "Automated Reporting",
    description:
      "Generate comprehensive PDF and CSV assessments for institutional policy review and academic oversight.",
    icon: ShieldCheck,
  },
  {
    title: "Institutional Intelligence",
    description: "Designed and developed by David Lameck and Denise Seti",
    icon: PieChart,
  },
];

export default function RegulatorFeatureShowcase() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"enter" | "exit">("enter");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setStage("exit");
    }, 4000);

    return () => clearTimeout(timer);
  }, [index, isPaused]);

  useEffect(() => {
    if (stage === "exit") {
      const timer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % FEATURES.length);
        setStage("enter");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const handleManualSwitch = (newIndex: number) => {
    if (newIndex === index || stage === "exit") return;
    setStage("exit");
    setTimeout(() => {
      setIndex(newIndex);
      setStage("enter");
    }, 600);
  };

  const current = FEATURES[index];
  const Icon = current.icon;

  return (
    <div
      className="flex flex-col items-center gap-6 max-w-sm px-6 text-center cursor-default group/carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Icon bubble - Emerald themed */}
      <div
        key={`icon-${index}-${stage}`}
        className={`w-12 h-12 rounded-2xl bg-emerald-500/10 backdrop-blur-md flex items-center justify-center border border-emerald-500/20 transition-all duration-700
          ${stage === "enter" ? "animate-fade-up-reveal" : "animate-fade-up-exit opacity-0"}`}
      >
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>

      {/* Text block */}
      <div
        key={`text-${index}-${stage}`}
        className={`space-y-3 transition-all duration-700
          ${stage === "enter" ? "animate-fade-up-reveal" : "animate-fade-up-exit opacity-0"}`}
      >
        <h3 className="text-xl font-bold text-white tracking-tight">
          {current.title}
        </h3>
        <p className="text-sm text-white/70 leading-relaxed max-w-[280px] mx-auto">
          {current.description}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mt-2">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => handleManualSwitch(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 outline-none
              ${i === index ? "w-6 bg-emerald-500" : "w-1.5 bg-emerald-500/30 hover:bg-emerald-500/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
