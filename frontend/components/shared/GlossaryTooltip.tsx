"use client";

/**
 * FinWatch Zambia - Glossary Tooltip
 * 
 * Mechanism 1: Contextual ratio definitions on every input field.
 * Provides a scale-aware tooltip with definition, example, and benchmarks.
 */

import React, { useState } from "react";
import { Info, Check, X } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface Props {
  termKey: string;
  businessScale?: "small_scale" | "medium_scale" | null;
  className?: string;
}

export function GlossaryTooltip({ termKey, businessScale = "medium_scale", className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const entry = GLOSSARY[termKey];
  const scale = businessScale || "medium_scale";

  if (!entry) return null;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-gray-400 hover:text-purple-500 transition-colors p-1 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/20"
      >
        <Info size={14} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 z-[50] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none sm:pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
              {entry.term}
            </h4>
          </div>
          
          <p className="text-[11px] text-gray-700 dark:text-zinc-300 leading-relaxed mb-3">
            {entry.definition[scale]}
          </p>

          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter block mb-1">Example</span>
              <p className="text-[10px] italic text-gray-500 dark:text-zinc-500 leading-snug">
                "{entry.example[scale]}"
              </p>
            </div>

            {entry.benchmarks && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">
                <Check size={10} />
                {entry.benchmarks[scale]}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-white dark:border-t-zinc-900" />
        </div>
      )}
    </div>
  );
}
