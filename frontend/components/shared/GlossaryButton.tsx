"use client";

/**
 * FinWatch Zambia - Floating Glossary Button
 * 
 * Mechanism 4: Inline glossary accessible from every page.
 * Provides a searchable, scale-aware lookup table of system terms.
 */

import React, { useState, useMemo } from "react";
import { HelpCircle, Search, X, BookOpen, ExternalLink, ChevronRight, Check } from "lucide-react";
import { GLOSSARY, GlossaryEntry } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface Props {
  businessScale?: "small_scale" | "medium_scale" | null;
}

export function GlossaryButton({ businessScale = "medium_scale" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scale = businessScale || "medium_scale";

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return Object.values(GLOSSARY);
    return Object.values(GLOSSARY).filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition[scale].toLowerCase().includes(q)
    );
  }, [search, scale]);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="floating-glossary-button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[152px] right-6 md:bottom-24 md:right-8 w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl flex items-center justify-center text-purple-600 dark:text-purple-400 hover:scale-110 active:scale-95 transition-all z-30"
        title="Open Glossary"
      >
        <HelpCircle size={24} />
      </button>

      {/* Glossary Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl max-h-[80vh] rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">System Glossary</h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    {scale === "small_scale" ? "Plain Language Guide" : "Financial Definitions"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 bg-white dark:bg-transparent">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search terms or definitions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400">No matching terms found.</p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div 
                    key={entry.term}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30 hover:border-purple-200 dark:hover:border-purple-900/40 transition-all group"
                  >
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {entry.term}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
                      {entry.definition[scale]}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                        <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tighter mt-0.5">Example</div>
                        <p className="text-[11px] italic text-gray-500 dark:text-zinc-500 leading-snug">
                          "{entry.example[scale]}"
                        </p>
                      </div>
                      {entry.benchmarks && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                          <Check size={10} />
                          {entry.benchmarks[scale]}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-center">
              <p className="text-[10px] text-gray-400">
                FinWatch Zambia · Empowering SMEs through accessible financial intelligence.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
