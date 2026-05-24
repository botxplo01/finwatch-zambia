"use client";

/**
 * FinWatch Zambia - Floating Glossary Button (REBUILD PHASE 1)
 *
 * Mechanism 4: Inline glossary accessible from every page.
 * Stripped down version to isolate rendering glitch.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { HelpCircle, Search, X, BookOpen } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface Props {
  businessScale?: "small_scale" | "medium_scale" | null;
}

export function GlossaryButton({ businessScale = "medium_scale" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scale = businessScale || "medium_scale";

  // Dragging logic (unchanged)
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) setHasMoved(true);
    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    buttonRef.current?.releasePointerCapture(e.pointerId);
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
      >
        <HelpCircle size={24} />
      </button>

      {/* REBUILD STEP 1: Minimal Modal Structure */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-xl max-h-[70vh] flex flex-col rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Minimal Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100">
                Glossary
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              >
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            {/* Minimal Search */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Minimal List */}
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-zinc-900">
              <div className="space-y-4">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.term}
                    className="p-3 border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {entry.term}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.definition[scale]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
