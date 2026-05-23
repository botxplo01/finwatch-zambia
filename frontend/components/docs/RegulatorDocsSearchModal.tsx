"use client";

/**
 * FinWatch Zambia - Regulator Docs Search Modal
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import { Search, X, SearchX, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { regulatorDocsSearchIndex, DocsSearchEntry } from "@/lib/regulator-docs-index";

interface RegulatorDocsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegulatorDocsSearchModal({ isOpen, onClose }: RegulatorDocsSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setSearchIndex] = useState(-1);

  const fuse = new Fuse(regulatorDocsSearchIndex, {
    keys: [
      { name: "heading", weight: 0.5 },
      { name: "tags", weight: 0.3 },
      { name: "excerpt", weight: 0.2 },
    ],
    threshold: 0.4,
    includeMatches: true,
  });

  useEffect(() => {
    if (query.length >= 2) {
      const searchResults = fuse.search(query).slice(0, 8);
      setResults(searchResults);
    } else {
      setResults([]);
    }
    setSearchIndex(-1);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      setQuery("");
    }

    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      const route = results[activeIndex].item.route;
      window.location.href = route;
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 md:p-20 overflow-hidden text-left">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 fade-in duration-300 pointer-events-auto">

        {/* Header / Input */}
        <div className="p-4 sm:p-6 border-b border-zinc-50 dark:border-zinc-800 flex-shrink-0 text-left">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search institutional guides..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 pl-12 pr-12 text-lg bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 transition-all text-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
          {query.length < 2 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
              <Search size={40} className="mb-4 text-emerald-600" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Institutional Search</p>
              <p className="text-xs mt-1 italic">Find analytics guides, detection logic, and policy reports</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-3">
              {results.map((result, i) => (
                <Link
                  key={i}
                  href={result.item.route}
                  onClick={onClose}
                  onMouseEnter={() => setSearchIndex(i)}
                  className={cn(
                    "group flex flex-col p-4 rounded-2xl border transition-all duration-200",
                    activeIndex === i
                      ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 shadow-md translate-x-1"
                      : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                      {result.item.section}
                    </span>
                    <ArrowRight size={14} className={cn("transition-all", activeIndex === i ? "text-emerald-600 translate-x-0" : "text-zinc-300 opacity-0 -translate-x-2")} />
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {result.item.heading}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {result.item.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
              <SearchX size={40} className="mb-4" />
              <p className="text-sm font-medium">No institutional matches found for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 border-t border-zinc-50 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/30 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
          <div className="flex items-center gap-3">
             <span className="flex items-center gap-1"><kbd className="px-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-xs">ESC</kbd> to close</span>
          </div>
          <span>Institutional Documentation</span>
        </div>
      </div>
    </div>
  );
}
