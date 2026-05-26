"use client";

/**
 * FinWatch Zambia - Onboarding Page
 *
 * Multi-stage, interactive post-registration experience for SME owners.
 * Stage 1: Dynamic Welcome
 * Stage 2: Concept Onboarding (Wizard)
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  TrendingUp,
  ChevronRight,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { setUser } from "@/lib/auth";

// Ratio metadata mapping to ratio_engine.py keys
const RATIO_CONCEPTS = [
  {
    key: "current_ratio",
    title: "Bill-Paying Ability",
    description:
      "This measures if your business has enough cash and stock to pay off bills due in the next few months.",
    small_scale:
      "Can you pay your suppliers on time? This checks if your daily cash and stock cover your upcoming bills.",
    medium_scale:
      "Formally known as the **Current Ratio**, it balances your short-term assets against your short-term debts.",
  },
  {
    key: "net_profit_margin",
    title: "Profit Efficiency",
    description:
      "This shows how much of every Kwacha you earn actually stays in your pocket as profit.",
    small_scale:
      "After paying for stock and expenses, how much 'take-home' profit is left from your sales?",
    medium_scale:
      "Your **Net Profit Margin** indicates the percentage of revenue remaining after all operating expenses and taxes.",
  },
  {
    key: "debt_to_assets",
    title: "Debt Load",
    description:
      "This looks at how much of your business equipment or stock belongs to you versus how much belongs to lenders.",
    small_scale:
      "Are you borrowing too much? We look at what portion of your business is built on credit or loans.",
    medium_scale:
      "Your **Debt-to-Assets** ratio measures the total solvency and leverage risk of your operation.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<1 | 2>(1);
  const [step, setStep] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showGetStarted, setShowGetStarted] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const profile = JSON.parse(raw);
        setUserProfile(profile);
        // If already complete, go to dashboard
        if (profile.onboarding_complete) {
          router.replace("/sme");
        }
      } catch (e) {}
    } else {
      router.replace("/sme/auth/login");
    }
  }, [router]);

  // Stage 1: Delayed button reveal
  useEffect(() => {
    if (stage === 1) {
      const timer = setTimeout(() => setShowGetStarted(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const handleNext = () => {
    if (step < RATIO_CONCEPTS.length - 1) {
      setStep(step + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const finishOnboarding = async () => {
    setIsFinishing(true);
    try {
      // 1. Update backend
      await api.put("/api/auth/me", { onboarding_complete: true });

      // 2. Update local state
      const updatedProfile = { ...userProfile, onboarding_complete: true };
      await setUser(updatedProfile);

      // 3. Set a session flag to trigger the tutorial on dashboard mount
      sessionStorage.setItem("justFinishedOnboarding", "true");

      // 4. Redirect
      router.push("/sme");
    } catch (err) {
      console.error("Failed to finish onboarding:", err);
      // Fallback: still go to dashboard if user is technically registered
      router.push("/sme");
    } finally {
      setIsFinishing(false);
    }
  };

  const currentConcept = RATIO_CONCEPTS[step];
  const isSmallScale = userProfile?.business_scale === "small_scale";

  // Custom Icon Component using CSS Filter to brand the black SVGs
  const OnboardingIcon = ({ name }: { name: string }) => (
    <img
      src={`/assets/icons/onboarding/${name}.svg`}
      alt={name}
      className="w-10 h-10 md:w-12 md:h-12 pointer-events-none select-none"
      style={{
        // Dynamic Filter: Purple 600 by default, White on mobile dark mode
        filter: "var(--onboarding-icon-filter)",
      }}
    />
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white dark:bg-[#0a0a0a] font-sans">
      {/* Global CSS for the dynamic filter to handle the mobile dark mode swap */}
      <style jsx global>{`
        :root {
          --onboarding-icon-filter: invert(18%) sepia(88%) saturate(5428%)
            hue-rotate(264deg) brightness(84%) contrast(110%);
        }
        @media (max-width: 767px) {
          .dark {
            --onboarding-icon-filter: brightness(0) invert(1);
          }
        }
      `}</style>
      {/* BACKGROUND MESH: Replicated from Docs Hero Section for high-intensity consistent branding */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[70%] rounded-full bg-purple-500/60 dark:bg-purple-400/40 blur-[40px] animate-blob-1 transform-gpu" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[70%] rounded-full bg-indigo-500/45 dark:bg-indigo-400/35 blur-[60px] animate-blob-2 transform-gpu" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-purple-400/35 dark:bg-purple-300/25 blur-[40px] animate-blob-3 transform-gpu" />
      </div>

      {/* STAGE 1: WELCOME SCREEN */}
      {stage === 1 && (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-8 text-center">
          <div className="animate-fade-up-reveal [animation-duration:1.2s]">
            <Image
              src="/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
              alt="FinWatch"
              width={180}
              height={40}
              className="block dark:hidden mb-8 mx-auto"
            />
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch"
              width={180}
              height={40}
              className="hidden dark:block mb-8 mx-auto"
            />

            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-gray-900 dark:text-white mb-4">
              Welcome to{" "}
              <span className="font-bold text-purple-600">FinWatch</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
              We've created a simple way to help you understand your business
              health and predict financial risk.
            </p>
          </div>

          <div
            className={cn(
              "mt-12 transition-all duration-1000 transform",
              showGetStarted
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-8 scale-95 pointer-events-none"
            )}
          >
            <button
              onClick={() => setStage(2)}
              className="relative group overflow-hidden h-14 md:h-16 px-10 md:px-12 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-base md:text-lg shadow-xl shadow-purple-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
            >
              <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
              <div className="relative z-10 flex items-center gap-2 md:gap-3 transition-colors duration-500 group-hover:dark:text-white">
                Get Started
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: CONCEPT WIZARD */}
      {stage === 2 && (
        <div className="relative z-10 flex h-full w-full flex-col">
          {/* Header Area */}
          <header className="p-6 md:p-12 flex flex-col items-center">
            <div className="w-full max-w-3xl flex flex-col items-start gap-4">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {currentConcept.title}
              </h2>

              {/* Progress Circles - Moved below title */}
              <div className="flex gap-1.5 md:gap-2">
                {RATIO_CONCEPTS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 md:h-1.5 rounded-full transition-all duration-500",
                      i === step
                        ? "w-8 md:w-10 bg-purple-600"
                        : i < step
                        ? "w-4 md:w-5 bg-purple-300 dark:bg-purple-900"
                        : "w-2 md:w-2.5 bg-gray-200 dark:bg-zinc-800"
                    )}
                  />
                ))}
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
            <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] md:rounded-[2.5rem] bg-purple-50 dark:bg-purple-600 md:dark:bg-purple-900/20 flex items-center justify-center mb-6 md:mb-8 mx-auto shadow-inner transition-colors duration-300">
                {step === 0 && <OnboardingIcon name="liquidity" />}
                {step === 1 && <OnboardingIcon name="profitability" />}
                {step === 2 && <OnboardingIcon name="solvency" />}
              </div>

              <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] border border-white/20 dark:border-white/5 p-6 md:p-10 shadow-sm text-center">
                <div className="text-base md:text-xl text-gray-700 dark:text-zinc-300 leading-relaxed font-medium prose dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {isSmallScale
                      ? currentConcept.small_scale
                      : currentConcept.medium_scale}
                  </ReactMarkdown>
                </div>

                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-4 text-left">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <TrendingUp
                      className="text-purple-600 dark:text-purple-400"
                      size={16}
                    />
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-500 dark:text-zinc-500 font-medium">
                    This directly influences your{" "}
                    <span className="text-purple-600 font-bold">
                      Health Score
                    </span>{" "}
                    in our prediction model.
                  </p>
                </div>
              </div>
            </div>
          </main>

          {/* Sticky Navigation Footer */}
          <footer className="p-6 md:p-12 flex items-center justify-between w-full max-w-5xl mx-auto z-20">
            <div className="flex items-center">
              <button
                onClick={finishOnboarding}
                className="text-gray-400 hover:text-purple-600 font-bold text-[10px] md:text-xs uppercase tracking-widest transition-colors flex items-center gap-2 group px-2 md:px-4 py-2"
              >
                Skip
                <ChevronRight
                  size={14}
                  className="opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0"
                />
              </button>
            </div>

            <div className="flex gap-3 md:gap-4">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  className="h-12 md:h-14 px-6 md:px-8 rounded-full border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 font-bold text-xs md:text-sm hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}

              <button
                onClick={handleNext}
                disabled={isFinishing}
                className="relative group overflow-hidden h-12 md:h-14 px-8 md:px-10 rounded-full border-none bg-black dark:bg-white text-white dark:text-black font-bold text-xs md:text-sm shadow-lg shadow-purple-500/10 transition-all duration-300 active:scale-[0.98] flex items-center gap-3 disabled:opacity-50"
              >
                <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
                <div className="relative z-10 flex items-center gap-2 md:gap-3 transition-colors duration-500 group-hover:dark:text-white">
                  {isFinishing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      {step === RATIO_CONCEPTS.length - 1 ? "Finish" : "Next"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </div>
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
