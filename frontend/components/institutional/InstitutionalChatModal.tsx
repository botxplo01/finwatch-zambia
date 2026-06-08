"use client";

/**
 * FinWatch Zambia - Institutional Chat Modal
 *
 * AI assistant modal for regulator and policy analyst users to ask questions
 * about system-wide distress patterns, sector trends, model performance,
 * and anomaly logic.
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
  Info,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import { getInstitutionalAuthHeader } from "@/lib/institutional-auth";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  source?: string | null;
}

interface InstitutionalChatModalProps {
  open: boolean;
  onClose: () => void;
  userRole: string;
  variant?: "emerald" | "blue";
}

export function InstitutionalChatModal({
  open,
  onClose,
  userRole,
  variant = "emerald",
}: InstitutionalChatModalProps) {
  const isAnalyst = userRole === "policy_analyst";
  const initialGreeting = isAnalyst
    ? "Hello! I'm the FinWatch Policy Analyst AI. I can help you interpret systemic trends and aggregate SME metrics for policy briefings."
    : "Hello! I'm the FinWatch Regulatory AI. I've analyzed the latest sectoral data and high-risk flags—how can I assist your oversight today?";

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: initialGreeting, source: null },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<string | null>(null);
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

  const checkUsageStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/institutional/chat/status", {
        headers: getInstitutionalAuthHeader(),
      });
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
      console.error("Failed to fetch institutional usage status:", err);
    }
  }, [insertLimitMessage]);

  // Theme Config
  const accentColor =
    variant === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : "text-emerald-600 dark:text-emerald-400";
  const iconBg =
    variant === "blue"
      ? "bg-blue-600 shadow-blue-600/20"
      : "bg-emerald-600 shadow-emerald-600/20";
  const badgeColor =
    variant === "blue"
      ? "text-blue-700 dark:text-blue-400"
      : "text-emerald-700 dark:text-emerald-400";
  const promptBg =
    variant === "blue"
      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
      : "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50";
  const inputFocus =
    variant === "blue"
      ? "focus:border-blue-400 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      : "focus:border-emerald-400 focus:ring-emerald-100 dark:focus:ring-emerald-900/40";
  const sendBtnBg =
    variant === "blue"
      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
      : "linear-gradient(135deg, #059669, #047857)";

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    setMessages([{ role: "assistant", content: initialGreeting, source: null }]);
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
      const chatHistory = messages
        .filter((m) => m.role !== "system")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await api.post(
        "/api/institutional/chat/",
        {
          message: userText,
          history: chatHistory,
        },
        {
          headers: getInstitutionalAuthHeader(),
        }
      );

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
      console.error("Institutional chat error:", err);
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
            content: "The analytical assistant is currently unavailable. Please try again later.",
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
      <div
        className="fixed inset-0 bg-black/10 z-[60] transition-all duration-500 animate-in fade-in"
        onClick={() => canInteract && onClose()}
      />

      <div
        className={cn(
          "fixed z-[70] bottom-36 sm:bottom-24 flex flex-col bg-white dark:bg-zinc-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-zinc-800 transition-all duration-500 animate-in slide-in-from-bottom-4 zoom-in-95",
          "left-4 right-4 sm:left-auto sm:right-auto sm:w-[450px] sm:h-[650px]",
          side === "left" ? "sm:left-8" : "sm:right-8",
          "rounded-[2.5rem] overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg",
                iconBg
              )}
            >
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {isAnalyst ? "Analyst AI" : "Regulator AI"}
                </h3>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                Institutional Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetSession}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              title="Reset Analysis"
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900 relative">
          <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/30 rounded-2xl p-3 flex items-start gap-2.5">
            <ShieldCheck size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
              Institutional AI provides aggregate sectoral insights. Specific SME identifiers are always suppressed in compliance with data privacy regulations.
            </p>
          </div>

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
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? (variant === "blue" ? "bg-blue-600" : "bg-emerald-600") + " text-white rounded-tr-none"
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
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center animate-pulse",
                  variant === "blue" ? "bg-blue-50 dark:bg-blue-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"
                )}
              >
                <Sparkles size={14} className={variant === "blue" ? "text-blue-600" : "text-emerald-600"} />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-2xl rounded-tl-none border border-gray-100 dark:border-white/5">
                <Loader2 size={12} className={cn("animate-spin", variant === "blue" ? "text-blue-600" : "text-emerald-600")} />
                <span className="text-xs text-gray-400 italic font-medium">
                  Synthesising sectoral metrics...
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer Area */}
        <div className="p-5 pt-2 bg-white dark:bg-zinc-950 relative z-10 border-t border-gray-50 dark:border-zinc-900">
          {/* Cooldown Alert */}
          {isBlocked && cooldownUntil && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-[10px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Reset at {formatLocalTime(cooldownUntil)}
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium italic">
                Institutional Limit
              </p>
            </div>
          )}

          {/* Prompt Chips */}
          {messages.length <= 1 && !loading && (
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "Analyse high-risk sectors",
                "Summarise overall distress",
                "Explain anomaly logic",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isBlocked}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50",
                    promptBg
                  )}
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
              placeholder={isBlocked ? "Analytical limit reached" : "Ask about sector patterns..."}
              disabled={loading || isBlocked}
              className={cn(
                "w-full bg-gray-50 dark:bg-zinc-900 border border-transparent rounded-2xl pl-4 pr-12 py-3.5 text-sm resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-600 dark:text-white min-h-[52px] max-h-[120px] shadow-inner",
                inputFocus,
                isBlocked && "opacity-50 grayscale"
              )}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isBlocked}
              className={cn(
                "absolute right-2 bottom-2 p-2 rounded-xl text-white transition-all active:scale-90 shadow-lg",
                loading ? "bg-zinc-400" : variant === "blue" ? "bg-blue-600 shadow-blue-600/20" : "bg-emerald-600 shadow-emerald-600/20"
              )}
              style={loading ? {} : { background: sendBtnBg }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest">
              <span className={cn(currentCount >= 10 ? "text-red-500" : badgeColor)}>
                {Math.max(0, 10 - currentCount)}
              </span>
              <span>Credits Remaining</span>
            </p>
            <div className="flex items-center gap-1.5 opacity-30">
              <ShieldCheck size={10} className="text-gray-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                Authorized Session
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
