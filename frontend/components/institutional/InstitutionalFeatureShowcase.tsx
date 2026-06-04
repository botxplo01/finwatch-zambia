"use client";

/**
 * FinWatch Zambia - Regulator Auth Feature Showcase
 */

import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck, Zap, Globe, PieChart } from "lucide-react";
import { useAuthAccent } from "@/context/AuthAccentContext";
import { cn } from "@/lib/utils";

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
    title: "FinWatch Institutional Intelligence",
    description: "Designed and developed by David Lameck and Denise Seti",
    icon: PieChart,
  },
];

export default function RegulatorFeatureShowcase() {
  const { accent } = useAuthAccent();
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
  const isBlue = accent === "blue";

  return (
    <div
      className="flex flex-col items-center gap-6 max-w-sm px-6 text-center cursor-default group/carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Icon bubble */}
      <div
        key={`icon-${index}-${stage}`}
        className={cn(
          "w-12 h-12 rounded-2xl backdrop-blur-md flex items-center justify-center border transition-all duration-700",
          stage === "enter"
            ? "animate-fade-up-reveal"
            : "animate-fade-up-exit opacity-0",
          isBlue
            ? "bg-blue-500/10 border-blue-500/10 dark:border-blue-500/20"
            : "bg-emerald-500/10 border-emerald-500/10 dark:border-emerald-500/20"
        )}
      >
        <Icon
          className={cn(
            "w-6 h-6",
            isBlue
              ? "text-blue-600 dark:text-blue-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
        />
      </div>

      {/* Text block */}
      <div
        key={`text-${index}-${stage}`}
        className={`space-y-3 transition-all duration-700
          ${
            stage === "enter"
              ? "animate-fade-up-reveal"
              : "animate-fade-up-exit opacity-0"
          }`}
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          {current.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed max-w-[280px] mx-auto font-medium">
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
            className={cn(
              "h-1 rounded-full transition-all duration-500 outline-none",
              i === index
                ? isBlue
                  ? "w-6 bg-blue-600 dark:bg-blue-500"
                  : "w-6 bg-emerald-600 dark:bg-emerald-500"
                : isBlue
                ? "w-1.5 bg-blue-200 dark:bg-blue-500/30 hover:bg-blue-300 dark:hover:bg-blue-500/50"
                : "w-1.5 bg-emerald-200 dark:bg-emerald-500/30 hover:bg-emerald-300 dark:hover:bg-emerald-500/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
