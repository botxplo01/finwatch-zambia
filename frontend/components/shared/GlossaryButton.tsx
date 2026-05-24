"use client";

/**
 * FinWatch Zambia - Floating Glossary Button
 *
 * Mechanism 4: Inline glossary accessible from every page.
 * Provides a searchable, scale-aware lookup table of system terms.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  HelpCircle,
  Search,
  X,
  BookOpen,
  ExternalLink,
  ChevronRight,
  Check,
  AlertTriangle,
} from "lucide-react";
import { GLOSSARY, GlossaryEntry } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface Props {
  businessScale?: "small_scale" | "medium_scale" | null;
}

export function GlossaryButton({ businessScale = "medium_scale" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scale = businessScale || "medium_scale";

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initialize side from session storage
  useEffect(() => {
    const savedSide = sessionStorage.getItem("glossary_button_side");
    if (savedSide === "left" || savedSide === "right") {
      setSide(savedSide);
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (usually left click or touch)
    if (e.button !== 0 && e.pointerType === "mouse") return;

    setIsDragging(true);
    setHasMoved(false);
    startPos.current = { x: e.clientX, y: e.clientY };
    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasMoved(true);
    }

    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    buttonRef.current?.releasePointerCapture(e.pointerId);

    // Snapping logic: based on viewport center
    const newSide = e.clientX < window.innerWidth / 2 ? "left" : "right";
    setSide(newSide);
    sessionStorage.setItem("glossary_button_side", newSide);

    setDragPos({ x: 0, y: 0 });
  };
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
        ref={buttonRef}
        id="floating-glossary-button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
          } else {
            setIsOpen(true);
          }
        }}
        style={{
          transform: isDragging
            ? `translate(${dragPos.x}px, ${dragPos.y}px) scale(0.9)`
            : `translate(0, 0) scale(1)`,
          transition: isDragging
            ? "none"
            : "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          touchAction: "none",
          userSelect: "none",
        }}
        className={cn(
          "absolute bottom-[152px] md:bottom-24 z-30 w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl flex items-center justify-center text-purple-600 dark:text-purple-400 hover:scale-110 active:scale-95 transition-all",
          side === "right" ? "right-6 md:right-8" : "left-6 md:left-8"
        )}
        title="Open Glossary"
      >
        <HelpCircle size={24} />
      </button>

      {/* Glossary Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          {/* Backdrop - Simple dimming like WelcomeModal */}
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/80"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="relative bg-white dark:bg-[#0a0a0a] w-full max-w-2xl h-full max-h-[80vh] rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Restored Original Look */}
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    System Glossary
                  </h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    {scale === "small_scale"
                      ? "Plain Language Guide"
                      : "Financial Definitions"}
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
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-[#0a0a0a] flex-shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search terms or definitions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Content Area - Restored Previous Look but Solid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-white dark:bg-[#0a0a0a]">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400">
                    No matching terms found.
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry.term}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 hover:border-purple-200 dark:hover:border-purple-900/40 transition-all group"
                  >
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {entry.term}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
                      {entry.definition[scale]}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800">
                        <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tighter mt-0.5">
                          Example
                        </div>
                        <p className="text-[11px] italic text-gray-500 dark:text-zinc-500 leading-snug">
                          "{entry.example[scale]}"
                        </p>
                      </div>
                      {entry.benchmarks && (
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                          {(() => {
                            const raw = entry.benchmarks[scale];
                            const parts = raw
                              .split(". ")
                              .map((p) => p.trim().replace(/\.$/, ""));
                            const healthy = parts.find((p) =>
                              p.toLowerCase().startsWith("healthy")
                            );
                            const concerning = parts.find((p) =>
                              p.toLowerCase().startsWith("concerning")
                            );

                            return (
                              <>
                                {healthy && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-100 dark:border-emerald-900/30 transition-colors">
                                    <Check size={10} strokeWidth={3} />
                                    {healthy}
                                  </div>
                                )}
                                {concerning && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-[10px] text-red-700 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30 transition-colors">
                                    <AlertTriangle size={10} strokeWidth={3} />
                                    {concerning}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-center flex-shrink-0">
              <p className="text-[10px] text-gray-400">
                FinWatch Zambia · Empowering SMEs through accessible financial
                intelligence.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
