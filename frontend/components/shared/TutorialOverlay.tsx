"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useTutorial } from "@/context/TutorialContext";
import { cn } from "@/lib/utils";

/**
 * Overlay component that highlights a target element and displays the tutorial tooltip.
 * Provides a guided onboarding experience with responsive positioning and portal-specific theming.
 */
export function TutorialOverlay() {
  const { 
    isActive, 
    currentStepIndex, 
    config, 
    nextStep, 
    prevStep, 
    exitTutorial 
  } = useTutorial();
  
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport for responsive behavior
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Monitor target element position and handle scroll synchronization
  useEffect(() => {
    if (!isActive || !config) return;

    const updatePosition = () => {
      let targetId = config.steps[currentStepIndex].targetId;
      
      // Map desktop IDs to mobile bottom navigation IDs if on mobile
      if (isMobile && targetId.startsWith("nav-")) {
        targetId = targetId.replace("nav-", "mobile-nav-");
      }

      const element = document.getElementById(targetId) || 
                      document.querySelector(`[data-tutorial="${targetId}"]`);
      
      if (element) {
        const rect = element.getBoundingClientRect();
        // Automatically scroll element into view if not fully visible
        const isOffScreen = rect.top < 0 || rect.bottom > window.innerHeight;

        if (isOffScreen && targetId !== "info-trigger") {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [isActive, currentStepIndex, config, isMobile]);

  if (!isActive || !config) return null;

  const currentStep = config.steps[currentStepIndex];
  const totalSteps = config.steps.length;
  
  const theme = {
    purple: {
      accent: "#6B17E9",
      btn: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
    },
    emerald: {
      accent: "#10b981",
      btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
    }
  }[config.portal === "sme" ? "purple" : "emerald"];

  // Position flags
  const isBottomTarget = 
    currentStep.targetId === "nav-reports" || 
    currentStep.targetId === "nav-settings" || 
    currentStep.targetId === "ai-assistant-fab";

  const isInfoTarget = currentStep.targetId === "info-trigger";

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[110] pointer-events-none overflow-hidden"
    >
      {/* 
          Background Dimming Layer 
          Wrapped in a relative div with z-0 to ensure stacking context.
      */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 4}
                  y={targetRect.top - 4}
                  width={targetRect.width + 8}
                  height={targetRect.height + 8}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#tutorial-mask)"
          />
        </svg>
      </div>

      {/* Target Highlight: Soft Glow and Outline */}
      {targetRect && (
        <div
          className="absolute transition-all duration-300 ease-out z-10 rounded-2xl pointer-events-none border-2"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderColor: theme.accent,
            boxShadow: `0 0 30px ${theme.accent}44`,
          }}
        />
      )}

      {/* 
          Tutorial Tooltip 
          High z-index to ensure it is never dimmed by the backdrop layer.
      */}
      <div
        className={cn(
          "absolute z-[100] pointer-events-auto transition-all duration-500 animate-in fade-in zoom-in-95 shadow-2xl",
          !targetRect && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          // Mobile responsive placement
          isMobile && (
            isBottomTarget ? "top-1/3 left-1/2 -translate-x-1/2" : 
            isInfoTarget ? "top-[80px] left-1/2 -translate-x-1/2" :
            "bottom-[110px] left-1/2 -translate-x-1/2 top-auto"
          )
        )}
        style={(!isMobile && targetRect) ? {
          // Desktop Positioning
          top: isInfoTarget 
            ? targetRect.top 
            : currentStep.targetId === "ai-assistant-fab"
              ? targetRect.top - 280
              : targetRect.bottom + 24 > window.innerHeight - 300 
                ? targetRect.top - 280 
                : targetRect.bottom + 24,
          
          left: isInfoTarget
            ? targetRect.left - 330 // Left of the System Info icon
            : currentStep.targetId === "ai-assistant-fab"
              ? window.innerWidth - 340 
              : Math.max(20, Math.min(targetRect.left, window.innerWidth - 340)),
        } : {}}
      >
        <div className="w-[320px] md:w-[300px] bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden text-center md:text-left">
          {/* Tooltip Header */}
          <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800/50 flex items-center justify-between">
            <span className={cn("text-[10px] font-black uppercase tracking-[0.15em]", 
              config.portal === "sme" ? "text-purple-600" : "text-emerald-600")}>
              Onboarding · {currentStepIndex + 1}/{totalSteps}
            </span>
            <button 
              onClick={exitTutorial}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tooltip Body */}
          <div className="p-6 pb-4 text-left">
            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2.5">
              {currentStep.title}
            </h3>
            <p className="text-[13px] leading-relaxed text-gray-500 dark:text-zinc-400 font-medium">
              {currentStep.content}
            </p>
          </div>

          {/* Progress Indicator Bar */}
          <div className="px-6 mb-2 text-left">
            <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-700 ease-in-out rounded-full", 
                  config.portal === "sme" ? "bg-purple-600 shadow-[0_0_10px_#6B17E9]" : "bg-emerald-600 shadow-[0_0_10px_#10b981]")}
                style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-5 py-5 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <button 
              onClick={exitTutorial}
              className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip Tour
            </button>
            
            <div className="flex gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-gray-500 dark:text-zinc-400 text-[11px] font-bold border border-gray-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 transition-all active:scale-95"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              
              <button
                onClick={nextStep}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[11px] font-bold transition-all active:scale-95 shadow-lg",
                  theme.btn
                )}
              >
                {currentStepIndex === totalSteps - 1 ? (
                  <>Complete <Check size={14} /></>
                ) : (
                  <>Next <ChevronRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Tooltip Directional Arrows (Desktop Only) */}
        {!isMobile && targetRect && (
          <div className={cn(
            "absolute rotate-45 border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 w-4 h-4",
            // Arrow pointing RIGHT for info-trigger
            isInfoTarget
              ? "top-1/2 -right-[8px] -translate-y-1/2 border-r border-t"
              // Arrow pointing DOWN for FAB or bottom items
              : (currentStep.targetId === "ai-assistant-fab" || targetRect.bottom + 24 > window.innerHeight - 300)
                ? "bottom-[-8px] border-r border-b"
                : "top-[-8px] border-l border-t", // Arrow pointing UP (default)
            // Horizontal alignment for arrows
            isInfoTarget 
              ? "" 
              : currentStep.targetId === "ai-assistant-fab" ? "right-[36px]" : "left-8"
          )} />
        )}
      </div>
    </div>
  );
}
