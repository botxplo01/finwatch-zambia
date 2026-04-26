/**
 * LoadingSpinner Component
 * 
 * A centralized, highly customizable loading indicator used throughout the application.
 * It features a pulsing background glow and a rotating spinner icon, ensuring
 * that the user receives consistent visual feedback during asynchronous operations.
 */

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /** Size of the spinner in pixels (default: 24) */
  size?: number;
  /** Optional descriptive text to show below the spinner */
  label?: string;
  /** If true, the spinner centers itself within a full-screen blurred backdrop */
  fullPage?: boolean;
  /** Extra CSS classes for the outermost container */
  className?: string;
  /** 
   * Theme color variant to match the current portal context:
   * - primary: Brand standard
   * - emerald: Regulator portal context
   * - purple: SME portal context
   */
  variant?: "primary" | "emerald" | "purple";
}

export function LoadingSpinner({
  size = 24,
  label,
  fullPage = false,
  className,
  variant = "primary",
}: LoadingSpinnerProps) {
  /**
   * Maps variants to specific Tailwind color classes for consistency
   */
  const colorMap = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3 animate-in fade-in duration-500",
      className
    )}>
      <div className="relative">
        {/* Pulsing background ring — provides depth and "active" feeling */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full blur-md opacity-20 animate-pulse",
            variant === "primary" ? "bg-primary" : variant === "emerald" ? "bg-emerald-500" : "bg-purple-500"
          )}
          style={{ width: size, height: size }}
        />
        
        {/* Primary rotating icon */}
        <Loader2 
          size={size} 
          className={cn("animate-spin relative z-10", colorMap[variant])} 
        />
      </div>
      
      {/* Optional labels are pulsed to indicate ongoing progress */}
      {label && (
        <p className="text-sm font-medium text-gray-500 dark:text-zinc-400 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  /**
   * If fullPage is requested, wrap in a fixed-position container with a glassmorphism effect
   */
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
