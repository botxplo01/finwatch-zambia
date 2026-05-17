"use client";

/**
 * FinWatch Zambia - Welcome Modal (Rebuild Phase 1: Solid Foundation)
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
    btnBg: "bg-[#7e22ce]",
    headerBg: "bg-[#7e22ce]",
    iconBg: "bg-purple-900",
    iconColor: "text-purple-300",
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
    btnBg: "bg-[#2563eb]",
    headerBg: "bg-[#2563eb]",
    iconBg: "bg-blue-900",
    iconColor: "text-blue-300",
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
    btnBg: "bg-[#10b981]",
    headerBg: "bg-[#10b981]",
    iconBg: "bg-emerald-900",
    iconColor: "text-emerald-300",
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
      {/* 1. SOLID BACKDROP (No Blur) */}
      <div
        className="absolute inset-0 bg-black/80 animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* 2. SOLID MODAL CARD (Proportional Refinement) */}
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] rounded-[2rem] border border-zinc-800 shadow-2xl animate-in zoom-in-95 fade-in duration-500 transform-gpu">
        
        {/* 3. SOLID HEADER (Responsive Height) */}
        <div className={cn("h-24 sm:h-28 md:h-32 flex items-center justify-center px-6 relative transition-colors duration-500", data.headerBg)}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors z-20"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 w-full flex items-center justify-center">
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch"
              width={420}
              height={96}
              priority
              className="w-[clamp(180px,45vw,380px)] h-auto object-contain"
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* 4. SOLID TEXT (High Contrast) */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              {data.title}
            </h2>
            <p className="text-sm sm:text-[15px] leading-relaxed text-zinc-400 font-medium">
              {data.description}
            </p>
          </div>

          {/* 5. SOLID LIST ITEMS (Balanced Spacing) */}
          <div className="space-y-2 sm:space-y-3">
            <ul className="grid grid-cols-1 gap-2 sm:gap-2.5">
              {data.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800"
                >
                  <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0", data.iconBg, data.iconColor)}>
                    <f.icon size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-zinc-200">
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 6. ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={onStartTutorial}
              className={cn("flex-1 py-4 rounded-2xl text-white text-sm font-black shadow-lg", data.btnBg)}
            >
              Start Tutorial
            </button>
            <button
              onClick={onSkipTutorial}
              className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-300 text-sm font-black"
            >
              Skip Tutorial
            </button>
          </div>

          <div className="flex justify-center mt-2">
            <p className="text-[11px] text-zinc-500 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
