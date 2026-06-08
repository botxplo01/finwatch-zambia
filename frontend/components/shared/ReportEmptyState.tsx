"use client";

import React from "react";
import { FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportEmptyStateProps {
  portalType: "sme" | "regulator" | "analyst";
  onReload?: () => void;
}

export function ReportEmptyState({ portalType, onReload }: ReportEmptyStateProps) {
  // Theme configuration based on portal type
  const theme = {
    sme: {
      accentText: "text-purple-600 dark:text-purple-400",
      accentBg: "bg-purple-50 dark:bg-purple-900/20",
      accentBorder: "border-purple-200 dark:border-purple-800/30",
      btnClass: "bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-600 dark:hover:bg-purple-700",
      primary: "No report data available yet.",
      secondary: "Your financial assessment report will appear here after you submit your first prediction. Navigate to the Predict tab to get started.",
    },
    regulator: {
      accentText: "text-emerald-600 dark:text-emerald-400",
      accentBg: "bg-emerald-50 dark:bg-emerald-900/20",
      accentBorder: "border-emerald-200 dark:border-emerald-800/30",
      btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700",
      primary: "No assessment data in the system yet.",
      secondary: "Report data will appear here once SME submissions have been processed. Check back after entities have completed their financial assessments.",
    },
    analyst: {
      accentText: "text-blue-600 dark:text-blue-400",
      accentBg: "bg-blue-50 dark:bg-blue-900/20",
      accentBorder: "border-blue-200 dark:border-blue-800/30",
      btnClass: "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700",
      primary: "No assessment data available.",
      secondary: "Aggregated sector data will appear here once submissions have been recorded. No action is required on your part.",
    },
  }[portalType];

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none animate-in fade-in zoom-in-95 duration-500">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border shadow-sm", theme.accentBg, theme.accentBorder, theme.accentText)}>
        <FolderOpen size={28} />
      </div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider mb-2">
        {theme.primary}
      </h3>
      <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-6">
        {theme.secondary}
      </p>
      {onReload && (
        <Button
          onClick={onReload}
          size="sm"
          className={cn("h-9 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95", theme.btnClass)}
        >
          <RefreshCw size={12} />
          Try Reloading
        </Button>
      )}
    </div>
  );
}
