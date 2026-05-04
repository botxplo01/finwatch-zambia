/**
 * FloatingChatButton Component
 * 
 * A fixed-position Floating Action Button (FAB) for mobile and desktop viewports.
 * Uses a layered animation strategy to decouple translation motion from fixed positioning.
 */

"use client";

import React from "react";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingChatButtonProps {
  onClick: () => void;
  variant?: "purple" | "emerald";
  className?: string;
  isPaused?: boolean;
  showTooltip?: boolean;
  onCloseTooltip?: () => void;
}

export function FloatingChatButton({
  onClick,
  variant = "purple",
  className,
  isPaused = false,
  showTooltip = false,
  onCloseTooltip,
}: FloatingChatButtonProps) {
  return (
    <div
      className={cn(
        "fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 flex flex-col items-end gap-3",
        className,
      )}
    >
      {showTooltip && (
        <div
          className={cn(
            "relative p-[1.5px] overflow-hidden rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-500",
            "max-w-[240px]",
          )}
        >
          {/* Animated border effect */}
          <div
            className={cn(
              "absolute inset-[-100%] animate-spin-slow opacity-60",
              variant === "purple"
                ? "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#6d28d9_100%)]"
                : "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#10b981_100%)]",
            )}
          />

          <div
            className={cn(
              "relative z-10 p-4 rounded-[15px] backdrop-blur-xl border border-transparent",
              "bg-white/95 dark:bg-zinc-900/95"
            )}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTooltip?.();
              }}
              type="button"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 shadow-sm transition-colors"
            >
              <X size={12} />
            </button>

            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1.5">
              AI Assistant
            </p>
            <p className="text-[13px] leading-relaxed text-gray-600 dark:text-zinc-300 font-medium">
              {variant === "purple"
                ? "Need help understanding your prediction? Ask me about your ratios or SHAP drivers!"
                : "I can help you analyze sector risk patterns, investigate anomaly data, or interpret institutional financial trends."}
            </p>
          </div>

          <div
            className={cn(
              "absolute -bottom-1 right-6 w-3 h-3 rotate-45 z-0",
              variant === "purple" ? "bg-purple-100/50" : "bg-emerald-100/50",
            )}
          />
        </div>
      )}

      <button
        onClick={() => {
          onClick();
          onCloseTooltip?.();
        }}
        type="button"
        aria-label="Open AI Assistant"
        className={cn(
          "w-12 h-12 md:w-14 md:h-14 rounded-full",
          "flex items-center justify-center relative",
          "transition-transform duration-200 active:scale-[0.98] outline-none",
        )}
      >
        <div
          className={cn(
            "relative w-full h-full flex items-center justify-center",
            !isPaused && "animate-float",
          )}
        >
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-md opacity-40 -z-10",
              variant === "purple" ? "bg-purple-500" : "bg-emerald-500",
            )}
          />

          <div
            className={cn(
              "w-full h-full rounded-full flex items-center justify-center shadow-lg",
              variant === "purple"
                ? "bg-purple-600 text-white shadow-purple-500/20 dark:shadow-purple-900/40"
                : "bg-emerald-600 text-white shadow-emerald-500/20 dark:shadow-emerald-900/40",
            )}
          >
            <MessageSquare
              size={20}
              className="md:w-6 md:h-6"
              strokeWidth={2.5}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
