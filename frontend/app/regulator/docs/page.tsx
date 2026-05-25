"use client";

/**
 * FinWatch Zambia - Regulator Documentation Landing Page
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import {
  Search,
  Layout,
  TrendingUp,
  AlertTriangle,
  FileText,
  ShieldCheck,
  BookOpen,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { regulatorDocsSearchIndex } from "@/lib/regulator-docs-index";

const CARDS = [
  {
    title: "Institutional Overview",
    icon: Layout,
    description: "System purpose, mandate, and anonymization standards",
    route: "/regulator/docs/overview",
    color: "emerald",
  },
  {
    title: "Sector Trends",
    icon: TrendingUp,
    description: "Reading aggregate heatmaps and temporal analytics",
    route: "/regulator/docs/sector-trends",
    color: "blue",
  },
  {
    title: "Anomaly Detection",
    icon: AlertTriangle,
    description: "Understanding logic and thresholds for flagging SMEs",
    route: "/regulator/docs/anomaly-detection",
    color: "amber",
  },
  {
    title: "Institutional Reporting",
    icon: FileText,
    description: "Generating cross-sector summaries and data exports",
    route: "/regulator/docs/reporting",
    color: "sky",
  },
  {
    title: "AI Governance",
    icon: ShieldCheck,
    description: "Model transparency, ethics, and system audit trails",
    route: "/regulator/docs/governance",
    color: "purple",
  },
  {
    title: "Regulator FAQ",
    icon: BookOpen,
    description: "Quick answers to common institutional oversight questions",
    route: "/regulator/docs/faq",
    color: "slate",
  },
];

const SEARCH_SUGGESTIONS = [
  "Search institutional guides...",
  "Anonymization standards",
  "How to read heatmaps?",
  "Anomaly detection logic",
  "Generating sector reports",
  "Model transparency audit",
  "System purpose overview",
  "Exporting aggregate data",
];

export default function RegulatorDocsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

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
      setResults(fuse.search(query).slice(0, 6));
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  useEffect(() => {
    if (query.length > 0) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_SUGGESTIONS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full relative py-20 px-4 border-b border-border bg-white dark:bg-[#0a0a0a] z-30">
        {/* Animated Background Elements - Institutional Emerald/Indigo */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[70%] rounded-full bg-emerald-500/60 dark:bg-emerald-400/40 blur-[40px] animate-blob-1" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[70%] rounded-full bg-indigo-500/45 dark:bg-indigo-400/35 blur-[60px] animate-blob-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-emerald-400/35 dark:bg-emerald-300/25 blur-[40px] animate-blob-3" />
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-zinc-900 dark:text-zinc-100">
            Institutional Oversight &{" "}
            <span className="text-emerald-600">Analytics Guide</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Technical documentation for regulators and policy analysts
            monitoring systemic financial health.
          </p>

          {/* Search Bar */}
          <div
            ref={searchRef}
            className="relative mt-12 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200"
          >
            <div className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && setShowResults(true)}
                className="w-full h-12 sm:h-14 pl-10 sm:pl-12 pr-4 py-2 sm:py-3 text-sm border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-gray-900 dark:text-zinc-100 rounded-2xl shadow-sm focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 transition-all relative z-10"
              />

              {query.length === 0 && (
                <div className="absolute left-10 sm:left-12 top-0 bottom-0 flex items-center pointer-events-none z-20 overflow-hidden pr-4">
                  <div
                    key={placeholderIndex}
                    className="text-gray-400 dark:text-zinc-500 text-[13px] sm:text-sm animate-placeholder-rotate whitespace-nowrap"
                  >
                    {SEARCH_SUGGESTIONS[placeholderIndex]}
                  </div>
                </div>
              )}

              <Search
                className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 group-focus-within:text-emerald-600 transition-colors z-30 pointer-events-none"
                size={16}
              />
            </div>

            {/* Results Dropdown */}
            {showResults && (
              <div className="absolute top-[calc(100%+0.75rem)] left-0 right-0 z-[100] rounded-[1.5rem] border border-zinc-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden flex flex-col text-left">
                {results.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto max-h-[60vh] sm:max-h-[420px] scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                    {results.map((result, i) => (
                      <Link
                        key={i}
                        href={result.item.route}
                        onClick={() => setShowResults(false)}
                        className="flex flex-col items-start px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                            {result.item.section}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {result.item.heading}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {result.item.excerpt}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <SearchX className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">
                      No institutional matches found.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Card Grid */}
      <section className="container mx-auto py-12 px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            const colorClasses: Record<string, string> = {
              emerald:
                "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 group-hover:bg-emerald-600",
              blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-600",
              amber:
                "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 group-hover:bg-amber-600",
              sky: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400 group-hover:bg-sky-600",
              purple:
                "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 group-hover:bg-purple-600",
              slate:
                "bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400 group-hover:bg-slate-600",
            };
            const accentTextClasses: Record<string, string> = {
              emerald:
                "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
              blue: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
              amber:
                "group-hover:text-amber-600 dark:group-hover:text-amber-400",
              sky: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
              purple:
                "group-hover:text-purple-600 dark:group-hover:text-purple-400",
              slate:
                "group-hover:text-slate-600 dark:group-hover:text-slate-400",
            };
            const borderHoverClasses: Record<string, string> = {
              emerald: "hover:border-emerald-600/30 hover:shadow-emerald-500/5",
              blue: "hover:border-blue-600/30 hover:shadow-blue-500/5",
              amber: "hover:border-amber-600/30 hover:shadow-amber-500/5",
              sky: "hover:border-sky-600/30 hover:shadow-sky-500/5",
              purple: "hover:border-purple-600/30 hover:shadow-purple-500/5",
              slate: "hover:border-slate-600/30 hover:shadow-slate-500/5",
            };

            return (
              <Link
                key={i}
                href={card.route}
                className={cn(
                  "group flex flex-col rounded-2xl border border-border bg-white dark:bg-zinc-950 p-4 sm:p-6 transition-all hover:-translate-y-1 dark:hover:bg-zinc-900/50 hover:shadow-lg",
                  borderHoverClasses[card.color]
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:text-white shadow-sm",
                    colorClasses[card.color]
                  )}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h3
                  className={cn(
                    "text-sm sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 transition-colors",
                    accentTextClasses[card.color]
                  )}
                >
                  {card.title}
                </h3>
                <p className="mt-2 text-[11px] sm:text-sm text-muted-foreground leading-relaxed line-clamp-3 sm:line-clamp-none">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Institutional Help */}
      <section className="container mx-auto pb-12 px-4 sm:px-6">
        <div className="rounded-3xl bg-zinc-950 p-8 sm:p-12 dark:bg-emerald-900/10 border border-white/5 overflow-hidden relative shadow-2xl">
          <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Institutional Support
            </h2>
            <p className="text-zinc-400 mb-8">
              Access dedicated guidance on systemic risk modeling, anonymization
              protocols, and regulatory reporting features.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/regulator/docs/faq"
                className="rounded-full bg-white px-8 py-3 text-sm font-bold text-zinc-950 transition-transform hover:scale-105 active:scale-95"
              >
                Read FAQ
              </Link>
              <button
                onClick={() => {
                  const btn = document.getElementById(
                    "docs-assistant-toggle"
                  ) as HTMLButtonElement;
                  if (btn) btn.click();
                }}
                className="text-sm font-bold text-white hover:text-emerald-400 transition-colors"
              >
                Institutional Assistant →
              </button>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>
      </section>
    </div>
  );
}
