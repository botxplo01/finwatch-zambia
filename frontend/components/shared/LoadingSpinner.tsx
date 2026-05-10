/**
 * LoadingSpinner Component
 */

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
  fullPage?: boolean;
  className?: string;
  variant?: "primary" | "emerald" | "purple";
}

export function LoadingSpinner({
  size = 24,
  label,
  fullPage = false,
  className,
  variant = "primary",
}: LoadingSpinnerProps) {

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
        {/* Pulsing background ring */}
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

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
