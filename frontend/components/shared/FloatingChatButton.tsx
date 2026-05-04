/**
 * FloatingChatButton Component
 * 
 * A fixed-position Floating Action Button (FAB) tailored for mobile viewports.
 * Implements a decoupling strategy where the button container remains fixed
 * to prevent cumulative layout shift, while an internal layer executes a 
 * translation-only animation for a smooth, high-polish "hovering" effect.
 * 
 * Design Pattern: Layered Animation
 * - Base: Fixed hit area with subtle interaction feedback (active:scale).
 * - Floating Layer: Decoupled translation layer for consistent motion performance.
 */

"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interface for the FloatingChatButton properties.
 */
interface FloatingChatButtonProps {
  /** Callback function executed upon user interaction. */
  onClick: () => void;
  /** UI theme variant: 'purple' for SME context, 'emerald' for Regulator context. */
  variant?: "purple" | "emerald";
  /** Optional CSS classes for external layout overrides. */
  className?: string;
  /** Boolean flag to halt the floating animation during active modal states. */
  isPaused?: boolean;
}

export function FloatingChatButton({
  onClick,
  variant = "purple",
  className,
  isPaused = false,
}: FloatingChatButtonProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-label="Open AI Assistant"
      className={cn(
        /* Structural constraints */
        "fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40",
        "w-12 h-12 md:w-14 md:h-14 rounded-full",
        "flex items-center justify-center",

        /* Interaction feedback */
        "transition-transform duration-200 active:scale-[0.98] outline-none",

        className,
      )}
    >
      {/* 
          Internal motion layer: Encapsulates the vertical translation.
          Decoupling the animation from the fixed button prevents 
          interfering with native browser scroll/touch behaviors.
      */}
      <div
        className={cn(
          "relative w-full h-full flex items-center justify-center",
          !isPaused && "animate-float",
        )}
      >
        {/* Visual elevation: Glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-md opacity-40 -z-10",
            variant === "purple" ? "bg-purple-500" : "bg-emerald-500",
          )}
        />

        {/* Button base */}
        <div
          className={cn(
            "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg",
            variant === "purple"
              ? "bg-purple-600 text-white shadow-purple-500/20 dark:shadow-purple-900/40"
              : "bg-emerald-600 text-white shadow-emerald-500/20 dark:shadow-emerald-900/40",
          )}
        >
          <MessageSquare size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
        </div>

      </div>
    </button>
  );
}
