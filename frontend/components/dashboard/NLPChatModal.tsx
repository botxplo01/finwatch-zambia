"use client";

/**
 * FinWatch Zambia - NLP Chat Modal
 *
 * Floating modal for SME owners to ask questions about their health assessments,
 * specific financial ratios, or general financial health.
 * Synchronized with the global ai-usage-update event for badge persistence.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  Loader2,
  AlertTriangle,
  Bot,
  User,
  History,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  source?: {
    company: string;
    period: string;
    risk: string;
  } | null;
}

type Source = Message["source"];

interface NLPChatModalProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hello! I'm FinWatch AI. I've analyzed your SME's data—ask me anything about your health assessments or financial ratios.",
  source: null,
};

export function NLPChatModal({ open, onClose }: NLPChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<Source>(null);
  const [side, setSide] = useState<"left" | "right">("right");
  const [canInteract, setCanInteract] = useState(false);

  // Usage limits state
  const [isBlocked, setIsBlocked] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [currentCount, setCurrentCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const formatLocalTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    if (isToday) return timeStr;

    return `${timeStr} (${date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })})`;
  };

  const insertLimitMessage = useCallback((until: string) => {
    const resetTime = formatLocalTime(until);
    const content = `You have reached the FinWatch AI Assistant usage limit. You can continue using the assistant again at ${resetTime}.`;

    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "system" && lastMsg.content.includes(resetTime)) {
        return prev;
      }
      return [...prev, { role: "system", content }];
    });
  }, []);

  // 1. Fetch usage status from backend
  const checkUsageStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/chat/status");
      const { is_blocked, cooldown_until, current_count } = res.data;

      setIsBlocked(is_blocked);
      setCooldownUntil(cooldown_until);
      setCurrentCount(current_count ?? 0);
      window.dispatchEvent(
        new CustomEvent("ai-usage-update", {
          detail: { count: current_count ?? 0 },
        })
      );

      if (is_blocked && cooldown_until) {
        insertLimitMessage(cooldown_until);
      }
    } catch (err) {
      console.error("Failed to fetch usage status:", err);
    }
  }, [insertLimitMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [input]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle open state
  useEffect(() => {
    if (open) {
      const savedSide = sessionStorage.getItem("chat_button_side");
      if (savedSide === "left" || savedSide === "right") {
        setSide(savedSide);
      }
      checkUsageStatus();
      setTimeout(() => inputRef.current?.focus(), 100);

      // Interaction delay to prevent ghost-click closing on mobile
      const timer = setTimeout(() => setCanInteract(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanInteract(false);
    }
  }, [open, checkUsageStatus]);

  function resetSession() {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setLastSource(null);
    checkUsageStatus();
  }

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading || isBlocked) return;

    setInput("");
    const userMsg: Message = { role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Create simplified history for backend (limit to last 10 turns)
      const chatHistory = messages
        .filter((m) => m.role !== "system")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await api.post("/api/chat/", {
        message: userText,
        history: chatHistory,
      });

      const { reply, source, current_count, cooldown_until: newCooldown } = res.data;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          source: source,
        },
      ]);

      if (source) setLastSource(source);
      
      // Update local count and fire event for the floating badge
      setCurrentCount(current_count);
      window.dispatchEvent(
        new CustomEvent("ai-usage-update", { detail: { count: current_count } })
      );

      if (newCooldown) {
        setIsBlocked(true);
        setCooldownUntil(newCooldown);
        insertLimitMessage(newCooldown);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 429) {
        setIsBlocked(true);
        const until = detail?.cooldown_until;
        if (until) {
          setCooldownUntil(until);
          insertLimitMessage(until);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "Sorry, I'm having trouble connecting. Please try again.",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop with tap-to-close */}
      <div
        className="fixed inset-0 bg-black/5 z-[60] transition-all duration-500 animate-in fade-in"
        onClick={() => canInteract && onClose()}
      />

      <div
        className={cn(
          "fixed z-[70] bottom-24 flex flex-col bg-white dark:bg-zinc-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-gray-100 dark:border-zinc-800 transition-all duration-500 animate-in slide-in-from-bottom-4 zoom-in-95",
          // Layout: Desktop center or side based on setting, Mobile full width
          "left-4 right-4 sm:left-auto sm:right-auto sm:w-[420px] sm:h-[600px]",
          side === "left" ? "sm:left-8" : "sm:right-8",
          "rounded-[2.5rem] overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  FinWatch AI
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetSession}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              title="Clear History"
            >
              <History size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900 relative">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === "user" ? "ml-auto items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/10"
                    : msg.role === "system"
                    ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-100 dark:border-red-900/40 w-full rounded-none text-center"
                    : "bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 rounded-tl-none border border-transparent dark:border-white/5"
                )}
              >
                <FormattedMessage
                  content={msg.content}
                  className={msg.role === "user" ? "prose-invert" : ""}
                />
              </div>

              {/* Message Source Metadata */}
              {msg.role === "assistant" && msg.source && (
                <div className="mt-2 flex items-center gap-2 px-2">
                  <div className="w-4 h-4 rounded bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 flex items-center justify-center">
                    <Info size={10} className="text-gray-400" />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Context: {msg.source.company} · {msg.source.period}
                  </p>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center animate-pulse">
                <Sparkles size={14} className="text-purple-600" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-2xl rounded-tl-none border border-gray-100 dark:border-white/5">
                <Loader2 size={12} className="animate-spin text-purple-600" />
                <span className="text-xs text-gray-400 italic">
                  Analysing financial drivers...
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer / Input */}
        <div className="p-5 pt-2 bg-white dark:bg-zinc-950 relative z-10 border-t border-gray-50 dark:border-zinc-900">
          {/* Cooldown Timer Alert */}
          {isBlocked && cooldownUntil && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-[10px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Reset at {formatLocalTime(cooldownUntil)}
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium italic">
                Daily limits applied
              </p>
            </div>
          )}

          {/* Prompt Suggestions (only if no user messages yet) */}
          {messages.length <= 1 && !loading && (
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "What is my current ratio?",
                "Analyze my latest failure risk",
                "Explain debt-to-assets",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isBlocked}
                  className="px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-900/30 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="relative group">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={isBlocked ? "Message limit reached" : "Ask about your business health..."}
              disabled={loading || isBlocked}
              className={cn(
                "w-full bg-gray-50 dark:bg-zinc-900 border border-transparent focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 rounded-2xl pl-4 pr-12 py-3.5 text-sm resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-600 dark:text-white min-h-[52px] max-h-[120px]",
                isBlocked && "opacity-50 grayscale"
              )}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isBlocked}
              className="absolute right-2 bottom-2 p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-30 disabled:hover:bg-purple-600 transition-all active:scale-90 shadow-lg shadow-purple-600/20"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 flex items-center gap-1">
              <span className={cn(currentCount >= 10 ? "text-red-500" : "text-purple-500")}>
                {Math.max(0, 10 - currentCount)}
              </span>
              <span>messages remaining</span>
            </p>
            <div className="flex items-center gap-1.5 opacity-40">
              <ShieldCheck size={10} className="text-gray-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                End-to-End Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
