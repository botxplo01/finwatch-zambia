"use client";

/**
 * FinWatch Zambia - Atmospheric Background Component
 * 
 * Provides a dynamic, portal-aware gradient system with 
 * glassmorphism-friendly washes. Includes an ambient blob
 * animation for the main dashboard.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface AtmosphericBackgroundProps {
  portal: "sme" | "regulator" | "analyst";
  isDashboard?: boolean;
}

export function AtmosphericBackground({ portal, isDashboard = false }: AtmosphericBackgroundProps) {
  // Portal-specific accent colors for the background wash
  const portalConfig = {
    sme: {
      base: "from-purple-50 via-zinc-100/50 to-zinc-200/30 dark:from-purple-900/30 dark:via-black dark:to-black",
      blob: "bg-purple-400/20 dark:bg-purple-500/40",
    },
    regulator: {
      base: "from-emerald-50 via-zinc-100/50 to-zinc-200/30 dark:from-emerald-900/30 dark:via-black dark:to-black",
      blob: "bg-emerald-400/20 dark:bg-emerald-500/40",
    },
    analyst: {
      base: "from-blue-50 via-zinc-100/50 to-zinc-200/30 dark:from-blue-900/30 dark:via-black dark:to-black",
      blob: "bg-blue-400/20 dark:bg-blue-500/40",
    },
  }[portal];

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-colors duration-1000">
      {/* Base Layer: Dynamic Gradient Wash */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br transition-all duration-1000",
        portalConfig.base
      )} />

      {/* Decorative Layer: Atmospheric Blobs (Dashboard Only) */}
      {isDashboard && (
        <>
          {/* Top Left Blob - erratic movement */}
          <div className={cn(
            "absolute top-[-15%] left-[-15%] w-[70%] h-[70%] rounded-full blur-[100px] animate-blob-1",
            portalConfig.blob
          )} />
          
          {/* Bottom Right Blob - circular logic */}
          <div className={cn(
            "absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full blur-[100px] animate-blob-2 [animation-delay:2s]",
            portalConfig.blob
          )} />

          {/* Center Blob - breathing logic */}
          <div className={cn(
            "absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full blur-[120px] animate-blob-3 [animation-delay:5s] opacity-60",
            portalConfig.blob
          )} />

          {/* Middle Left Blob - counter movement */}
          <div className={cn(
            "absolute top-[40%] left-[-20%] w-[50%] h-[50%] rounded-full blur-[100px] animate-blob-2 [animation-delay:8s] opacity-40",
            portalConfig.blob
          )} />
        </>
      )}

      {/* Subtle overlay to ensure readability */}
      <div className="absolute inset-0 bg-white/5 dark:bg-black/5" />
    </div>
  );
}
