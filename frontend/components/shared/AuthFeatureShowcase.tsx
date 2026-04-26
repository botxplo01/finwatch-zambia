"use client";

/**
 * FinWatch Zambia - Auth Feature Showcase
 *
 * Animated carousel displaying key features on the login/register pages.
 * Cycles through predictive intelligence, SHAP explainability, SME-centric design,
 * actionable narratives, and financial early warning.
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
      "Transparent risk assessment. We don't just give you a score; we show you the exact ratios driving it.",
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
    title: "Financial Early Warning",
    description: "Designed and developed by David Lameck and Denise Seti",
    icon: TrendingUp,
  },
];

export default function AuthFeatureShowcase() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    // Show each text for 4.75 seconds before starting the exit animation
    const timer = setTimeout(() => {
      setStage("exit");
    }, 4750);

    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    if (stage === "exit") {
      const timer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % FEATURES.length);
        setStage("enter");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const current = FEATURES[index];
  const Icon = current.icon;

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
      {/* Icon bubble */}
      <div
        key={`icon-${index}-${stage}`}
        className={`w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 transition-all duration-700
          ${stage === "enter" ? "animate-fade-up-reveal" : "animate-fade-up-exit opacity-0"}`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Text block */}
      <div key={`text-${index}-${stage}`} className="space-y-3">
        <h3
          className={`text-xl font-bold text-white tracking-tight transition-all duration-700
          ${stage === "enter" ? "animate-fade-up-reveal" : "animate-fade-up-exit opacity-0"}`}
        >
          {current.title}
        </h3>
        <p
          className={`text-sm text-white/70 leading-relaxed transition-all duration-700 delay-75
          ${stage === "enter" ? "animate-fade-up-reveal" : "animate-fade-up-exit opacity-0"}`}
        >
          {current.description}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mt-2">
        {FEATURES.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-500
              ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
