"use client";

/**
 * FinWatch Zambia - Floating Glossary Button
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  HelpCircle,
  Search,
  X,
  BookOpen,
  Check,
  AlertTriangle,
} from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface Props {
  businessScale?: "small_scale" | "medium_scale" | null;
  className?: string;
  variant?: "purple" | "emerald" | "blue";
  id?: string;
}

export function GlossaryButton({
  businessScale = "medium_scale",
  className,
  variant = "purple",
  id,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scale = businessScale || "medium_scale";

  // Dragging logic
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const parentRect = useRef<DOMRect | null>(null);
  const buttonRect = useRef<DOMRect | null>(null);

  useEffect(() => {
    const savedSide = sessionStorage.getItem("glossary_button_side");
    if (savedSide === "left" || savedSide === "right") {
      setSide(savedSide);
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setIsDragging(true);
    setHasMoved(false);
    startPos.current = { x: e.clientX, y: e.clientY };

    // Capture boundaries for desktop constraints
    if (window.innerWidth >= 768 && buttonRef.current) {
      parentRect.current =
        buttonRef.current.parentElement?.getBoundingClientRect() || null;
      buttonRect.current = buttonRef.current.getBoundingClientRect();
    }

    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    let dx = e.clientX - startPos.current.x;
    let dy = e.clientY - startPos.current.y;

    // Desktop boundary enforcement
    if (window.innerWidth >= 768 && parentRect.current && buttonRect.current) {
      const minX = parentRect.current.left - buttonRect.current.left;
      const maxX = parentRect.current.right - buttonRect.current.right;
      const minY = parentRect.current.top - buttonRect.current.top;
      const maxY = parentRect.current.bottom - buttonRect.current.bottom;

      dx = Math.max(minX, Math.min(maxX, dx));
      dy = Math.max(minY, Math.min(maxY, dy));
    }

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) setHasMoved(true);
    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      if (buttonRef.current?.hasPointerCapture(e.pointerId)) {
        buttonRef.current?.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Safely ignore auto-released pointer capture errors
    }

    // Snapping logic - localized to content area on desktop
    const midPoint =
      window.innerWidth >= 768 && parentRect.current
        ? parentRect.current.left + parentRect.current.width / 2
        : window.innerWidth / 2;

    const newSide = e.clientX < midPoint ? "left" : "right";
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
        id={id || "floating-glossary-button"}
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
          "fixed md:absolute bottom-20 md:bottom-24 z-40 w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all",
          variant === "purple"
            ? "text-purple-600 dark:text-purple-400"
            : variant === "blue"
            ? "text-blue-600 dark:text-blue-400"
            : "text-emerald-600 dark:text-emerald-400",
          side === "right" ? "right-4 md:right-8" : "left-4 md:left-8",
          className
        )}
      >
        <HelpCircle size={24} />
      </button>

      {/* Final Performance-Optimized Modal Structure (No Animations) */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop - Solid Dimming */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container - NO ANIMATION, NO TRANSPARENCY */}
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
            {/* Header - Restore Original Look with SOLID backgrounds */}
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 leading-none">
                    System Glossary
                  </h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1.5">
                    {scale === "small_scale"
                      ? "Plain Language Guide"
                      : "Financial Definitions"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar - Styled like History Page */}
            <div className="p-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
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
                  className="w-full h-12 pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* List Content - SOLID background */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white dark:bg-zinc-900">
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
                    className="p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/40 transition-all group shadow-sm"
                  >
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {entry.term}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
                      {entry.definition[scale]}
                    </p>

                    {/* Rich Details */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
                        <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tighter mt-0.5">
                          Example
                        </div>
                        <p className="text-[11px] italic text-gray-500 dark:text-zinc-500 leading-snug">
                          &quot;{entry.example[scale]}&quot;
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
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-[10px] text-emerald-700 dark:text-white font-bold border border-emerald-200 dark:border-emerald-800">
                                    <Check size={10} strokeWidth={3} />
                                    {healthy}
                                  </div>
                                )}
                                {concerning && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900 text-[10px] text-red-700 dark:text-white font-bold border border-red-200 dark:border-red-800">
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

            {/* Footer - SOLID background */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-center flex-shrink-0">
              <p className="text-[10px] text-gray-400">
                FinWatch © 2026 · Developed by David &amp; Denise
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
