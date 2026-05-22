"use client";

/**
 * FinWatch Zambia - Welcome Modal
 * 
 * Redesigned into a 3-step story-based onboarding flow.
 * Provides relatable business scenarios before showing UI elements.
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

  const storyContent = useMemo(() => {
    if (scale === "small_scale") {
      return "Imagine Chanda runs a grocery shop in Lusaka. She wants to expand but is not sure if her business is financially ready. FinWatch helps her understand her situation in three minutes — no accounting knowledge needed.";
    }
    return "Imagine Mwamba runs a transport company with 12 vehicles. He needs to know if his business can take on a bank loan without putting operations at risk. FinWatch gives him the answer and explains exactly why.";
  }, [scale]);

  const steps = [
    {
      title: "Meet the System",
      content: storyContent,
      icon: <Sparkles className="text-purple-600" size={32} />
    },
    {
      title: "What does this system do?",
      points: [
        "It reads your financial situation",
        "It tells you if your business is at risk",
        "It explains what is causing the risk and what to do about it"
      ],
      icon: <Activity className="text-purple-600" size={32} />
    },
    {
      title: "What will you need?",
      content: scale === "small_scale" 
        ? "Just answer a few simple questions about your business. No receipts or records needed."
        : "You can upload your financial records or enter your figures manually.",
      icon: <FileText className="text-purple-600" size={32} />
    }
  ];

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
        <div className="h-1.5 w-full bg-purple-600" />
        
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
          <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300">
            {currentStep.icon}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
            {currentStep.title}
          </h2>

          <div className="min-h-[140px] flex items-center justify-center w-full max-w-sm mx-auto">
            {currentStep.points ? (
              <ul className="space-y-4 text-left">
                {currentStep.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm md:text-base text-zinc-600 dark:text-zinc-400 font-medium">
                    <div className="mt-1 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Check className="text-purple-600 dark:text-purple-400" size={12} strokeWidth={3} />
                    </div>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base md:text-[17px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium italic">
                "{currentStep.content}"
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
                  i === step ? "w-8 bg-purple-600" : "w-2 bg-zinc-200 dark:bg-zinc-800"
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
              className="flex-[1.5] py-4 rounded-xl bg-purple-600 text-white text-sm font-bold shadow-lg shadow-purple-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={onStartTutorial}
              className="flex-[1.5] py-4 rounded-xl bg-purple-600 text-white text-sm font-bold shadow-lg shadow-purple-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
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
