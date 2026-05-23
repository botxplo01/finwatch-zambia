"use client";

/**
 * FinWatch Zambia - Documentation AI Assistant
 *
 * A focused, circular floating assistant specifically for documentation help.
 * Separate from the main portal assistant, uses its own API and session state.
 */

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, User, Bot, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import api from "@/lib/api";
import { FormattedMessage } from "@/components/shared/FormattedMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function DocsAIAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const MAX_MESSAGES = 10;

  // Initialize side from session storage
  useEffect(() => {
    const savedSide = sessionStorage.getItem("docs_chat_button_side");
    if (savedSide === "left" || savedSide === "right") {
      setSide(savedSide);
    }
  }, []);

  const toggleChat = () => setIsOpen((prev) => !prev);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setIsDragging(true);
    setHasMoved(false);
    startPos.current = { x: e.clientX, y: e.clientY };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    // 5px threshold to distinguish between a click and a drag
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasMoved(true);
    }
    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    containerRef.current?.releasePointerCapture(e.pointerId);

    // Only toggle if we haven't moved significantly
    if (!hasMoved) {
      toggleChat();
    }

    const newSide = e.clientX < window.innerWidth / 2 ? "left" : "right";
    setSide(newSide);
    sessionStorage.setItem("docs_chat_button_side", newSide);
    setDragPos({ x: 0, y: 0 });
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isLoading || count >= MAX_MESSAGES) return;

    const userMessage = message.trim();
    setMessage("");
    setHistory((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const section =
        pathname.split("/").pop()?.replace(/-/g, " ") || "General";

      const res = await api.post(
        "/api/docs/chat",
        {
          message: userMessage,
          history: history,
          current_section: section,
        },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply },
      ]);
      setCount((prev) => prev + 1);
    } catch (error) {
      console.error("DocsChat Error:", error);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Draggable Container */}
      <div
        ref={containerRef}
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
          "fixed bottom-6 z-[70] flex flex-col gap-3 transition-all duration-300",
          side === "right" ? "right-6 items-end" : "left-6 items-start"
        )}
      >
        {/* Floating Toggle Button */}
        <button
          id="docs-assistant-toggle"
          onClick={(e) => {
            // programmatic clicks (like from landing page) trigger this
            // only run if it's a real click (not after a drag which is handled in onPointerUp)
            if (!isDragging) {
              toggleChat();
            }
          }}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 sm:h-16 sm:w-16",
            isOpen ? "rotate-90" : "rotate-0"
          )}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Sparkles className="h-6 w-6" />
          )}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold dark:bg-zinc-100 dark:text-zinc-900">
              {MAX_MESSAGES - count}
            </span>
          )}
        </button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl transition-all dark:bg-zinc-950 sm:w-[380px] sm:h-[480px]",
            "w-[calc(100vw-3rem)] h-[60vh]",
            "bottom-24",
            side === "right" ? "right-6" : "left-6"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-purple-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-bold">Documentation Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
                <Bot className="h-10 w-10 text-purple-600 mb-2" />
                <p className="text-sm font-medium">
                  Hello! How can I help you understand FinWatch Zambia today?
                </p>
                <p className="text-xs">
                  Ask about ratios, results, or how to use the platform.
                </p>
              </div>
            )}

            {history.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2 text-sm shadow-sm",
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                  )}
                >
                  <FormattedMessage
                    content={msg.content}
                    className={msg.role === "user" ? "prose-invert" : ""}
                  />
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-xs text-muted-foreground italic">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border bg-zinc-50/50 p-4 dark:bg-zinc-900/50">
            <form onSubmit={handleSend} className="relative">
              <input
                type="text"
                placeholder={
                  count >= MAX_MESSAGES
                    ? "Usage limit reached"
                    : "Ask a question..."
                }
                disabled={isLoading || count >= MAX_MESSAGES}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                className="w-full rounded-full border border-border bg-white py-2.5 pl-4 pr-12 text-sm focus:border-purple-600 focus:outline-none dark:bg-zinc-950"
              />
              <button
                type="submit"
                disabled={!message.trim() || isLoading || count >= MAX_MESSAGES}
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white transition-opacity disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground">
                {count} of {MAX_MESSAGES} questions used
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Docs AI
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
