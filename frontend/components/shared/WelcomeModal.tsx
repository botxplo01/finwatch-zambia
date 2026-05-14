"use client";

/**
 * FinWatch Zambia - Welcome Modal
 */

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  ShieldCheck,
  Activity,
  Zap,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
  portalType: "sme" | "regulator" | "analyst";
}

const CONTENT = {
  sme: {
    title: "Welcome to FinWatch!",
    description:
      "Your intelligent partner in business resilience. We help you navigate financial complexities using data-driven insights tailored for Zambian SMEs.",
    features: [
      { icon: Zap, text: "Instant financial health assessments" },
      { icon: Sparkles, text: "Explainable AI (SHAP) insights" },
      { icon: TrendingUp, text: "Long-term trajectory tracking" },
    ],

    btnBg: "bg-[#7e22ce] dark:bg-[#9333ea]",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  analyst: {
    title: "Strategic Analysis Portal Active",
    description:
      "Synthesise sector-wide financial data. Monitor economic trends and generate strategic institutional reports for policy review.",
    features: [
      { icon: BarChart3, text: "Strategic sector performance insights" },
      { icon: TrendingUp, text: "12-month temporal distress trends" },
      { icon: ShieldCheck, text: "Institutional aggregate reporting" },
    ],
    btnBg: "bg-[#2563eb] dark:bg-[#3b82f6]",
    iconBg: "bg-blue-100 dark:bg-blue-900/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  regulator: {
    title: "Welcome to the Regulator Portal!",
    description:
      "Empowering policy-making through real-time systemic oversight. Monitor SME financial health system-wide.",
    features: [
      { icon: Activity, text: "Sector-wide risk distribution metrics" },
      { icon: ShieldCheck, text: "Proactive anomaly & fraud detection" },
      { icon: BarChart3, text: "Temporal trend analysis for policy" },
    ],

    btnBg: "bg-[#10b981] dark:bg-[#34d399]",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

export function WelcomeModal({
  isOpen,
  onClose,
  onStartTutorial,
  onSkipTutorial,
  portalType,
}: WelcomeModalProps) {
  const [mounted, setMounted] = useState(false);
  const data = CONTENT[portalType];

  useEffect(() => {
    setMounted(true);
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop with high-radius blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header Section */}
        <div
          className={cn(
            "h-32 w-full relative overflow-hidden flex items-center justify-center transition-colors duration-500",
            portalType === "sme"
              ? "bg-[#7e22ce]"
              : portalType === "analyst"
                ? "bg-[#2563eb]"
                : "bg-[#10b981]",
          )}
        >
          {/* Background Icon Decoration */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -bottom-8 -right-8 rotate-12">
              <Image
                src="/brand/dark_mode/FinWatch_Logo_Icon_dark_mode.svg"
                alt=""
                width={160}
                height={160}
                className="opacity-40"
              />
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-20"
          >
            <X size={18} />
          </button>

          {/* Main Logo Centered - Increased Size */}
          <div className="relative z-10 w-[500px] h-[300px] scale-90">
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch Zambia"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Text Content */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight mb-2">
              {data.title}
            </h2>
            <p className="text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400 font-medium">
              {data.description}
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
              Key Capabilities
            </p>
            <ul className="grid grid-cols-1 gap-2.5">
              {data.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 transition-colors"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                      data.iconBg,
                      data.iconColor,
                    )}
                  >
                    <f.icon size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={onStartTutorial}
              className={cn(
                "flex-1 py-4 rounded-2xl text-white text-sm font-black transition-all active:scale-[0.98] shadow-lg",
                data.btnBg,
              )}
            >
              Start Tutorial
            </button>
            <button
              onClick={onSkipTutorial}
              className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-sm font-black transition-all hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-[0.98]"
            >
              Skip Tutorial
            </button>
          </div>

          <div className="flex justify-center mt-2">
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
