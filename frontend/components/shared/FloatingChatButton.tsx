/**
 * FinWatch Zambia - FloatingChatButton Component
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIAssistantIcon } from "./AIAssistantIcon";

interface FloatingChatButtonProps {
  onClick: () => void;
  variant?: "purple" | "emerald" | "blue";
  className?: string;
  isPaused?: boolean;
  showTooltip?: boolean;
  onCloseTooltip?: () => void;
  id?: string;
  messageCount?: number | null;
}

export function FloatingChatButton({
  onClick,
  variant = "purple",
  className,
  isPaused = false,
  showTooltip = false,
  onCloseTooltip,
  id,
  messageCount = null,
}: FloatingChatButtonProps) {
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRect = useRef<DOMRect | null>(null);
  const buttonRect = useRef<DOMRect | null>(null);
  const lastToggleTime = useRef(0);

  // Initialize side from session storage
  useEffect(() => {
    const savedSide = sessionStorage.getItem("chat_button_side");
    if (savedSide === "left" || savedSide === "right") {
      setSide(savedSide);
    }
  }, []);

  const safeToggle = () => {
    const now = Date.now();
    if (now - lastToggleTime.current < 300) return;
    lastToggleTime.current = now;
    onClick();
    onCloseTooltip?.();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer
    if (e.button !== 0 && e.pointerType === "mouse") return;

    setIsDragging(true);
    setHasMoved(false);
    startPos.current = { x: e.clientX, y: e.clientY };

    // Capture boundaries for desktop constraints
    if (window.innerWidth >= 768 && containerRef.current) {
      parentRect.current =
        containerRef.current.parentElement?.getBoundingClientRect() || null;
      buttonRect.current = containerRef.current.getBoundingClientRect();
    }

    containerRef.current?.setPointerCapture(e.pointerId);
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

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasMoved(true);
    }

    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    try {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current?.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Safely ignore auto-released pointer capture errors
    }

    // Only toggle if we haven't moved significantly
    // safeToggle handles the debounce for both pointer and click events
    if (!hasMoved) {
      safeToggle();
    }

    // Snapping logic - localized to content area on desktop
    const midPoint =
      window.innerWidth >= 768 && parentRect.current
        ? parentRect.current.left + parentRect.current.width / 2
        : window.innerWidth / 2;

    const newSide = e.clientX < midPoint ? "left" : "right";
    setSide(newSide);
    sessionStorage.setItem("chat_button_side", newSide);

    setDragPos({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      id={id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
        "fixed md:absolute bottom-6 md:bottom-8 flex flex-col gap-3",
        isPaused ? "z-[65]" : "z-40",
        side === "right"
          ? "right-4 md:right-8 items-end"
          : "left-4 md:left-8 items-start",
        className
      )}
    >
      {showTooltip && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerCancel={(e) => e.stopPropagation()}
          className="relative group animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div
            className={cn(
              "relative p-[1.5px] overflow-hidden rounded-2xl shadow-2xl",
              "max-w-[240px]"
            )}
          >
            {/* Animated border effect */}
            <div
              className={cn(
                "absolute inset-[-100%] animate-spin-slow opacity-60",
                variant === "purple"
                  ? "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#6d28d9_100%)]"
                  : variant === "blue"
                  ? "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#2563eb_100%)]"
                  : "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#10b981_100%)]"
              )}
            />

            <div
              className={cn(
                "relative z-10 p-4 rounded-[15px] backdrop-blur-xl border border-transparent",
                variant === "purple"
                  ? "bg-purple-100/60 dark:bg-purple-900/40"
                  : variant === "blue"
                  ? "bg-blue-100/60 dark:bg-blue-900/40"
                  : "bg-emerald-100/60 dark:bg-emerald-900/40"
              )}
            >
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider mb-1.5",
                  variant === "purple"
                    ? "text-purple-700/50 dark:text-purple-300/50"
                    : variant === "blue"
                    ? "text-blue-700/50 dark:text-blue-300/50"
                    : "text-emerald-700/50 dark:text-emerald-300/50"
                )}
              >
                {variant === "purple" ? "FinWatch AI" : "AI Assistant"}
              </p>
              <p
                className={cn(
                  "text-[13px] leading-relaxed font-medium",
                  variant === "purple"
                    ? "text-purple-900 dark:text-purple-100"
                    : variant === "blue"
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-emerald-900 dark:text-emerald-100"
                )}
              >
                {variant === "purple"
                  ? "Need help understanding your prediction? Ask me about your ratios or SHAP drivers!"
                  : variant === "blue"
                  ? "I can help you analyze sector risk patterns or interpret institutional financial policy trends."
                  : "I can help you analyze sector risk patterns, investigate anomaly data, or interpret institutional financial trends."}
              </p>
            </div>

            <div
              className={cn(
                "absolute -bottom-1 w-3 h-3 rotate-45 z-0",
                side === "right" ? "right-6" : "left-6",
                variant === "purple"
                  ? "bg-purple-100/60 dark:bg-purple-900/40"
                  : variant === "blue"
                  ? "bg-blue-100/60 dark:bg-blue-900/40"
                  : "bg-emerald-100/60 dark:bg-emerald-900/40"
              )}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseTooltip?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerCancel={(e) => e.stopPropagation()}
            type="button"
            className={cn(
              "absolute -top-2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border flex items-center justify-center transition-colors z-20 shadow-sm",
              side === "right" ? "-right-2" : "-left-2",
              variant === "purple"
                ? "border-purple-100 dark:border-purple-900/30 text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
                : variant === "blue"
                ? "border-blue-100 dark:border-blue-900/30 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                : "border-emerald-100 dark:border-emerald-900/30 text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200"
            )}
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      )}

      <button
        onClick={(e) => {
          // Standard clicks and programmatic triggers
          // debounced safeToggle handles the double-trigger if onPointerUp already fired
          safeToggle();
        }}
        type="button"
        aria-label="Open AI Assistant"
        className={cn(
          "w-12 h-12 md:w-14 md:h-14 rounded-full",
          "flex items-center justify-center relative",
          "transition-transform duration-200 active:scale-[0.98] outline-none"
        )}
      >
        <div
          className={cn(
            "relative w-full h-full flex items-center justify-center rounded-full shadow-lg",
            !isPaused && "animate-float",
            variant === "purple"
              ? "bg-purple-600 text-white shadow-purple-500/20 dark:shadow-purple-900/40"
              : variant === "blue"
              ? "bg-blue-600 text-white shadow-blue-500/20 dark:shadow-blue-900/40"
              : "bg-emerald-600 text-white shadow-emerald-500/20 dark:shadow-emerald-900/40"
          )}
        >
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-md opacity-40 -z-10",
              variant === "purple"
                ? "bg-purple-500"
                : variant === "blue"
                ? "bg-blue-500"
                : "bg-emerald-500"
            )}
          />

          {isPaused ? (
            <X size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
          ) : (
            <AIAssistantIcon
              size={32}
              className="md:w-10 md:h-10"
              animate={true}
            />
          )}

          {/* Message Badge - Inside animation container to float together */}
          {!isPaused && messageCount !== null && (
            <span className="absolute -top-1 -right-1 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white border border-white/20 shadow-xl dark:bg-zinc-100 dark:text-zinc-900 animate-in fade-in zoom-in duration-300">
              {messageCount}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
