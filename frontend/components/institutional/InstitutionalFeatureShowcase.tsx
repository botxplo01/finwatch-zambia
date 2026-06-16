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
    title: (
      <>
        FinWatch <span className="text-gray-500 dark:text-zinc-400">Institutional</span> Intelligence
      </>
    ),
    description: "Designed and developed by David Lameck and Denise Seti",
    icon: PieChart,
  },
  {
    title: (
      <>
        Systemic Risk <span className="text-blue-600 dark:text-blue-400">Oversight</span>
      </>
    ),
    description:
      "Monitor sector-wide financial health through aggregated analytics and temporal trend detection.",
    icon: Globe,
  },
  {
    title: (
      <>
        <span className="text-purple-600 dark:text-purple-400">Predictive</span> Policy Insights
      </>
    ),
    description:
      "Leverage machine learning to anticipate sector-level distress before it impacts the national economy.",
    icon: BarChart3,
  },
  {
    title: (
      <>
        <span className="text-green-600 dark:text-green-400">Explainable</span> Governance
      </>
    ),
    description:
      "Full transparency via SHAP values. Understand exactly which financial drivers are influencing sector stability.",
    icon: Zap,
  },
  {
    title: (
      <>
        <span className="text-yellow-600 dark:text-yellow-400">Automated</span> Reporting
      </>
    ),
    description:
      "Generate comprehensive PDF and CSV assessments for institutional policy review and academic oversight.",
    icon: ShieldCheck,
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
          "w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/10 backdrop-blur-md flex items-center justify-center border border-black/5 dark:border-white/20 transition-all duration-700",
          stage === "enter"
            ? "animate-fade-up-reveal"
            : "animate-fade-up-exit opacity-0"
        )}
      >
        <Icon
          className="w-7 h-7 text-gray-900 dark:text-white"
        />
      </div>

      {/* Text block - Fixed height to stabilize dots */}
      <div className="min-h-[130px] flex flex-col justify-center">
        <div
          key={`text-${index}-${stage}`}
          className={`space-y-3 transition-all duration-700
            ${
              stage === "enter"
                ? "animate-fade-up-reveal"
                : "animate-fade-up-exit opacity-0"
            }`}
        >
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {current.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed max-w-[280px] mx-auto font-medium">
            {current.description}
          </p>
        </div>
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
                ? "w-6 bg-gray-900 dark:bg-white"
                : "w-1.5 bg-gray-300 dark:bg-white/30 hover:bg-gray-400 dark:hover:bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
