"use client";

/**
 * FinWatch Zambia - Welcome Modal
 * 
 * Redesigned for a professional, clean, and modern institutional aesthetic.
 * Optimized for vertical density to ensure a perfect fit without scrolling.
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
  ArrowRight,
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
    title: "Welcome to FinWatch",
    description:
      "Your intelligent partner in business resilience. We help you navigate financial complexities using data-driven insights tailored for Zambian SMEs.",
    features: [
      { icon: Zap, text: "Instant health assessments" },
      { icon: Sparkles, text: "Explainable AI insights" },
      { icon: TrendingUp, text: "Strategic health tracking" },
    ],
    accent: "bg-purple-600",
    text: "text-purple-600 dark:text-purple-400",
    light: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-100 dark:border-purple-800/30",
  },
  analyst: {
    title: "Policy Analysis Active",
    description:
      "Synthesise sector-wide financial data. Monitor economic trends and generate strategic institutional reports for policy review.",
    features: [
      { icon: BarChart3, text: "Sector performance insights" },
      { icon: TrendingUp, text: "Temporal distress trends" },
      { icon: ShieldCheck, text: "Institutional aggregate reporting" },
    ],
    accent: "bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    light: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-100 dark:border-blue-800/30",
  },
  regulator: {
    title: "Institutional Oversight Portal",
    description:
      "Empowering policy-making through real-time systemic oversight. Monitor SME financial health system-wide.",
    features: [
      { icon: Activity, text: "Systemic risk metrics" },
      { icon: ShieldCheck, text: "Proactive anomaly detection" },
      { icon: BarChart3, text: "Temporal policy analysis" },
    ],
    accent: "bg-emerald-600",
    text: "text-emerald-600 dark:text-emerald-400",
    light: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-100 dark:border-emerald-800/30",
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
      {/* 1. Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/40 dark:bg-black/80 animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* 2. Modal Card - Optimized for vertical space */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0a0a0a] rounded-[1.5rem] md:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] animate-in zoom-in-95 fade-in duration-500 transform-gpu overflow-hidden">
        
        {/* Dynamic Top Accent Bar */}
        <div className={cn("h-1.5 w-full", data.accent)} />

        {/* 3. Header Section - Minimalist */}
        <div className="px-6 py-6 md:px-10 md:py-8 flex flex-col items-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="mb-6">
            <Image
              src="/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
              alt="FinWatch"
              width={160}
              height={38}
              className="block dark:hidden opacity-90"
              priority
            />
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch"
              width={160}
              height={38}
              className="hidden dark:block opacity-90"
              priority
            />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
              {data.title}
            </h2>
            <p className="text-sm md:text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium max-w-md mx-auto">
              {data.description}
            </p>
          </div>
        </div>

        {/* 4. Features Grid - Compact rows */}
        <div className="px-6 md:px-10">
          <div className="grid grid-cols-1 gap-2.5">
            {data.features.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 transition-all group"
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105",
                  data.light,
                  data.text
                )}>
                  <f.icon size={18} strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Action Buttons - Tightened layout without footer */}
        <div className="p-6 md:p-8 bg-zinc-50/50 dark:bg-zinc-900/30 mt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStartTutorial}
              className={cn(
                "flex-[1.5] py-4 rounded-xl text-white text-sm font-bold shadow-lg shadow-purple-500/10 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2",
                data.accent
              )}
            >
              Start Guided Tutorial
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onSkipTutorial}
              className="flex-1 py-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#0a0a0a] text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
