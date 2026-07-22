"use client";

/**
 * FinWatch Zambia - Welcome Modal
 *
 * Onboarding modal providing initial system introductions for SME, Regulator, and Analyst users.
 */

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  Check,
  Activity,
  Zap,
  FileText,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
  portalType: "sme" | "regulator" | "analyst";
  businessScale?: "small_scale" | "medium_scale" | null;
}

export function WelcomeModal({
  isOpen,
  onClose,
  onStartTutorial,
  onSkipTutorial,
  portalType,
  businessScale = "medium_scale",
}: WelcomeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0); // 0: Story, 1: What it does, 2: What you need
  const scale = businessScale || "medium_scale";

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep(0);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Theme configuration
  const theme = useMemo(() => {
    if (portalType === "regulator") {
      return {
        accent: "#10b981", // Emerald 600
        bg: "bg-emerald-600",
        lightBg: "bg-emerald-50 dark:bg-emerald-900/20",
        shadow: "shadow-emerald-500/10",
        icon: "text-emerald-600 dark:text-emerald-400",
      };
    }
    if (portalType === "analyst") {
      return {
        accent: "#2563eb", // Blue 600
        bg: "bg-blue-600",
        lightBg: "bg-blue-50 dark:bg-blue-900/20",
        shadow: "shadow-blue-500/10",
        icon: "text-blue-600 dark:text-blue-400",
      };
    }
    return {
      accent: "#6B17E9", // Purple 600
      bg: "bg-purple-600",
      lightBg: "bg-purple-50 dark:bg-purple-900/20",
      shadow: "shadow-purple-500/10",
      icon: "text-purple-600 dark:text-purple-400",
    };
  }, [portalType]);

  const steps = useMemo(() => {
    if (portalType === "regulator") {
      return [
        {
          title: "Meet the System",
          content:
            "As a Regulator, you oversee the financial stability of the SME sector. FinWatch provides aggregate analytics to identify systemic risks and high-risk anomalies without compromising individual company privacy.",
          icon: <Sparkles className={theme.icon} size={32} />,
        },
        {
          title: "What does this system do?",
          points: [
            "Monitor sector-wide financial health",
            "Track temporal distress trends",
            "Identify high-risk sector anomalies",
          ],
          icon: <Activity className={theme.icon} size={32} />,
        },
        {
          title: "Institutional Access",
          content:
            "Access is purely analytical. You can review anonymised datasets and export comprehensive sector-level reports for policy review.",
          icon: <ShieldCheck className={theme.icon} size={32} />,
        },
      ];
    }
    if (portalType === "analyst") {
      return [
        {
          title: "Meet the System",
          content:
            "As a Policy Analyst, you derive data-driven insights from sectoral patterns. FinWatch empowers you with high-level KPI summaries and risk distribution metrics to help formulate informed policy recommendations.",
          icon: <Sparkles className={theme.icon} size={32} />,
        },
        {
          title: "What does this system do?",
          points: [
            "Analyse sectoral performance",
            "Compare model-based risk profiles",
            "Generate anonymised policy reports",
          ],
          icon: <TrendingUp className={theme.icon} size={32} />,
        },
        {
          title: "Analytical Scope",
          content:
            "Your view is focused on aggregate data. You have access to all sector-level dashboards to monitor emerging financial pressures across Zambia.",
          icon: <Activity className={theme.icon} size={32} />,
        },
      ];
    }

    // SME Portal
    const story =
      scale === "small_scale"
        ? "Imagine Chanda runs a grocery shop in Lusaka. She wants to expand but is not sure if her business is financially ready. FinWatch helps her understand her situation in three minutes — no accounting knowledge needed."
        : "Imagine Mwamba runs a transport company with 12 vehicles. He needs to know if his business can take on a bank loan without putting operations at risk. FinWatch gives him the answer and explains exactly why.";

    return [
      {
        title: "Meet the System",
        content: story,
        icon: <Sparkles className={theme.icon} size={32} />,
      },
      {
        title: "What does this system do?",
        points: [
          "It reads your financial situation",
          "It tells you if your business is at risk",
          "It explains what is causing the risk and what to do about it",
        ],
        icon: <Activity className={theme.icon} size={32} />,
      },
      {
        title: "What will you need?",
        content:
          scale === "small_scale"
            ? "Just answer a few simple questions about your business. No receipts or records needed."
            : "You can upload your financial records or enter your figures manually.",
        icon: <FileText className={theme.icon} size={32} />,
      },
    ];
  }, [portalType, scale, theme]);

  if (!mounted || !isOpen) return null;

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/40 dark:bg-black/80 animate-in fade-in duration-500"
        onClick={onSkipTutorial}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0a0a0a] rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col">
        {/* Progress Accent Bar */}
        <div className={cn("h-1.5 w-full", theme.bg)} />

        {/* Header Branding */}
        <div className="pt-8 px-8 flex justify-center">
          <Image
            src="/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
            alt="FinWatch"
            width={140}
            height={32}
            className="block dark:hidden opacity-90"
            priority
          />
          <Image
            src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
            alt="FinWatch"
            width={140}
            height={32}
            className="hidden dark:block opacity-90"
            priority
          />
        </div>

        <div className="p-8 md:p-12 flex flex-col items-center text-center space-y-6">
          <div
            className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300",
              theme.lightBg
            )}
          >
            {currentStep.icon}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
            {currentStep.title}
          </h2>

          <div className="min-h-[140px] flex items-center justify-center w-full max-w-sm mx-auto">
            {currentStep.points ? (
              <ul className="space-y-4 text-left">
                {currentStep.points.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm md:text-base text-zinc-600 dark:text-zinc-400 font-medium"
                  >
                    <div
                      className={cn(
                        "mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                        theme.lightBg
                      )}
                    >
                      <Check className={theme.icon} size={12} strokeWidth={3} />
                    </div>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base md:text-[17px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium italic">
                &quot;{currentStep.content}&quot;
              </p>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex gap-2 py-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step
                    ? cn("w-8", theme.bg)
                    : "w-2 bg-zinc-200 dark:bg-zinc-800"
                )}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-8 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col sm:flex-row gap-3">
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              className={cn(
                "flex-[1.5] py-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2",
                theme.bg,
                theme.shadow
              )}
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={onStartTutorial}
              className={cn(
                "flex-[1.5] py-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2",
                theme.bg,
                theme.shadow
              )}
            >
              Start Full Tutorial <ArrowRight size={18} />
            </button>
          )}
          <button
            onClick={onSkipTutorial}
            className="flex-1 py-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#0a0a0a] text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
