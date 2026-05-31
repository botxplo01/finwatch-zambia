"use client";

/**
 * FinWatch Zambia - Auth Feature Showcase
 */

import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Users,
  BrainCircuit,
} from "lucide-react";

const FEATURES = [
  {
    title: "Predictive Intelligence",
    description:
      "Advanced machine learning models designed to spot financial distress signs up to 2 years in advance.",
    icon: BrainCircuit,
  },
  {
    title: "SHAP Explainability",
    description:
      "Transparent risk assessment. We don't just give you a score, we show you the exact ratios driving it.",
    icon: Zap,
  },
  {
    title: "SME-Centric Design",
    description:
      "Tailored specifically for the Zambian economic landscape, making high-level financial analysis accessible.",
    icon: Users,
  },
  {
    title: "Actionable Narratives",
    description:
      "Our NLP engine translates complex financial data into plain-English reports for non-specialist owners.",
    icon: ShieldCheck,
  },
  {
    title: "FinWatch Zambia",
    description: "Designed and developed by David Lameck and Denise Seti",
    icon: TrendingUp,
  },
];

export default function AuthFeatureShowcase() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"enter" | "exit">("enter");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    // Show each text for 4.75 seconds before starting the exit animation
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
      {/* Icon bubble */}
      <div
        key={`icon-${index}-${stage}`}
        className={`w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 backdrop-blur-md flex items-center justify-center border border-black/5 dark:border-white/20 transition-all duration-700
          ${
            stage === "enter"
              ? "animate-fade-up-reveal"
              : "animate-fade-up-exit opacity-0"
          }`}
      >
        <Icon className="w-6 h-6 text-gray-900 dark:text-white" />
      </div>

      {/* Text block - Animated as a single unit for smoothness */}
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

      {/* Progress dots - Interactive */}
      <div className="flex gap-1.5 mt-2">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => handleManualSwitch(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 outline-none
              ${
                i === index
                  ? "w-6 bg-gray-900 dark:bg-white"
                  : "w-1.5 bg-gray-200 dark:bg-white/30 hover:bg-gray-300 dark:hover:bg-white/50"
              }`}
          />
        ))}
      </div>
    </div>
  );
}
