"use client";

/**
 * FinWatch Zambia - NLP Chat Modal
 *
 * AI assistant modal for SME users to ask questions about predictions,
 * financial ratios, and SHAP explanations. Supports multi-tier fallback
 * (Groq, Ollama local, template).
 *
 * Usage Enforcement: 10 messages per 2-hour rolling window.
 */

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react";
import {
  X,
  Send,
  Bot,
  User,
  RefreshCw,
  Sparkles,
  Cloud,
  HardDrive,
  FileText,
  AlertCircle,
  Timer,
  BookOpen,
} from "lucide-react";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { GLOSSARY } from "@/lib/glossary";

// Types

type Role = "user" | "assistant" | "system";
type Source = "groq" | "template" | "glossary" | null;

interface Message {
  role: Role;
  content: string;
  source?: Source;
}

interface Props {
  open: boolean;
  onClose: () => void;
  businessScale?: "small_scale" | "medium_scale" | null;
  isSidebarCollapsed?: boolean;
}

// Constants

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hello! I'm the FinWatch AI assistant. Ask me anything about your financial assessments, ratios, or prediction results. I can explain specific predictions, compare results across companies, or help you understand what the numbers mean for your business.",
  source: null,
};

const SUGGESTED_PROMPTS = [
  "Explain my latest prediction",
  "Why is my distress probability high?",
  "What does a low current ratio mean?",
  "Explain all my predictions",
  "What is SHAP and how does it work?",
];

// Source Badge

function SourceBadge({ source }: { source: Source }) {
  if (!source) return null;

  const config: Record<
    NonNullable<Source>,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    groq: {
      label: "Groq",
      icon: <Cloud size={9} />,
      color: "text-purple-500 dark:text-purple-400",
    },
    glossary: {
      label: "Glossary",
      icon: <BookOpen size={9} />,
      color: "text-emerald-500 dark:text-emerald-400",
    },
    template: {
      label: "Template",
      icon: <FileText size={9} />,
      color: "text-gray-400 dark:text-zinc-500",
    },
  };

  const item = config[source];
  if (!item) return null;

  return (
    <span
      className={`flex items-center gap-0.5 text-[9px] mt-1 ${item.color} opacity-70`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

// Message Bubble

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 max-w-[90%] flex gap-3">
          <AlertCircle
            size={16}
            className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5"
          />
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              Usage Limit Reached
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5
          ${isUser ? "bg-purple-600" : "bg-purple-100 dark:bg-purple-900/30"}`}
      >
        {isUser ? (
          <User size={11} className="text-white" />
        ) : (
          <Bot size={11} className="text-purple-600 dark:text-purple-400" />
        )}
      </div>
      <div
        className={`max-w-[78%] ${
          isUser ? "items-end" : "items-start"
        } flex flex-col`}
      >
        <div
          className={`px-3 py-2 text-sm leading-relaxed
           ${
             isUser
               ? "bg-purple-600 text-white rounded-2xl rounded-tr-sm shadow-sm"
               : "bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 rounded-2xl rounded-tl-sm shadow-sm"
           }`}
        >
          <FormattedMessage content={message.content} />
        </div>
        {!isUser && message.source && <SourceBadge source={message.source} />}
      </div>
    </div>
  );
}

// Main Modal

export function NLPChatModal({
  open,
  onClose,
  businessScale,
  isSidebarCollapsed = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<Source>(null);
  const [side, setSide] = useState<"left" | "right">("right");

  // Usage limits state
  const [isBlocked, setIsBlocked] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [currentCount, setCurrentCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch usage status from backend
  const checkUsageStatus = async () => {
    try {
      const res = await api.get("/api/chat/status");
      const { is_blocked, cooldown_until, current_count } = res.data;
      setIsBlocked(is_blocked);
      setCooldownUntil(cooldown_until);
      setCurrentCount(current_count ?? 0);

      if (is_blocked && cooldown_until) {
        insertLimitMessage(cooldown_until);
      }
    } catch (err) {
      console.error("Failed to fetch usage status:", err);
    }
  };

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

  const insertLimitMessage = (until: string) => {
    const resetTime = formatLocalTime(until);
    const content = `You have reached the FinWatch AI Assistant usage limit. You can continue using the assistant again at ${resetTime}.`;

    // Check if we already added a system message about this block
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "system" && lastMsg.content.includes(resetTime)) {
        return prev;
      }
      return [...prev, { role: "system", content }];
    });
  };

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
    }
  }, [open]);

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
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // ZERO-STEP: Glossary Guardrail
    const scale = businessScale || "medium_scale";
    const lowercaseText = userText.toLowerCase();

    // Simple keyword matching for glossary
    let glossaryMatch: any = null;
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      const term = entry.term.toLowerCase();
      // Match "what is [term]" or "explain [term]" or just "[term]"
      if (
        lowercaseText === term ||
        lowercaseText.includes(`what is ${term}`) ||
        lowercaseText.includes(`explain ${term}`) ||
        (term.length > 5 && lowercaseText.includes(term))
      ) {
        glossaryMatch = entry;
        break;
      }
    }

    if (glossaryMatch) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `### ${glossaryMatch.term}\n\n${
            glossaryMatch.definition[scale]
          }\n\n**Example:** *"${glossaryMatch.example[scale]}"*${
            glossaryMatch.benchmarks
              ? `\n\n**Benchmark:** ${glossaryMatch.benchmarks[scale]}`
              : ""
          }`,
          source: "glossary",
        },
      ]);
      return;
    }

    setLoading(true);

    const history = updatedMessages
      .slice(1)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.post("/api/chat/", {
        message: userText,
        history,
      });

      const { reply, source, current_count, cooldown_until } = res.data;
      setLastSource(source as Source);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, source: source as Source },
      ]);

      // Update count and block status immediately
      setCurrentCount(current_count);
      if (cooldown_until) {
        setIsBlocked(true);
        setCooldownUntil(cooldown_until);
        insertLimitMessage(cooldown_until);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 429) {
        setIsBlocked(true);
        const until = data?.detail?.cooldown_until;
        setCooldownUntil(until);
        if (until) insertLimitMessage(until);
      } else {
        const fallback =
          data?.detail ??
          "The AI service is temporarily unavailable. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              typeof fallback === "string" ? fallback : "An error occurred.",
            source: "template",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const sourceLabel: Record<NonNullable<Source>, string> = {
    groq: "Groq",
    template: "Template mode",
    glossary: "System Glossary",
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end p-6 pointer-events-none transition-all duration-300",
        side === "right" ? "justify-end" : "justify-start",
        // Shift the panel itself based on sidebar state when justified to the left
        side === "left" && (isSidebarCollapsed ? "md:pl-20" : "md:pl-72")
      )}
    >
      {/* Full-screen backdrop including sidebar */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative w-96 h-[600px] bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-100/50 dark:border-zinc-800/50 flex flex-col overflow-hidden pointer-events-auto transition-all duration-300">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #6d28d9 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles size={14} className="text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-semibold leading-tight">
                  FinWatch AI
                </p>
                <div
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 transition-colors whitespace-nowrap",
                    isBlocked || currentCount >= 10
                      ? "bg-red-500/20 text-red-100 border-red-400/40"
                      : "bg-white/10 text-purple-100 border-white/20"
                  )}
                >
                  {isBlocked ? 0 : Math.max(0, 10 - currentCount)} messages
                  remaining
                </div>
              </div>
              <p className="text-purple-300 text-[10px] leading-tight">
                {isBlocked
                  ? "Limit reached"
                  : lastSource
                  ? sourceLabel[lastSource]
                  : "Financial assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isBlocked && (
              <Timer size={13} className="text-amber-400 mr-1 animate-pulse" />
            )}

            {!isBlocked && lastSource && (
              <div
                title={`Powered by ${sourceLabel[lastSource]}`}
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  lastSource === "groq" ? "bg-green-400" : "bg-amber-400"
                }`}
              />
            )}

            <button
              onClick={resetSession}
              title="Refresh status"
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot
                  size={11}
                  className="text-purple-600 dark:text-purple-400"
                />
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Cooldown Timer Alert (Bottom Strip) */}
        {isBlocked && cooldownUntil && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-[10px] uppercase">
              <Timer size={12} />
              Reset at {formatLocalTime(cooldownUntil)}
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
              Please wait
            </p>
          </div>
        )}

        {/* Suggested Prompts */}
        {messages.length === 1 && !loading && !isBlocked && (
          <div className="px-3 pb-2 bg-transparent flex gap-1.5 flex-wrap">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 px-2 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors leading-tight"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div
          className={cn(
            "p-3 border-t border-gray-100/50 dark:border-zinc-800/50 flex-shrink-0 transition-all",
            isBlocked
              ? "bg-gray-50/50 dark:bg-zinc-950/50 grayscale opacity-70"
              : "bg-white/40 dark:bg-white/5 backdrop-blur-md"
          )}
        >
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 350))}
                onKeyDown={handleKeyDown}
                placeholder={
                  isBlocked
                    ? "Assistant disabled temporarily"
                    : "Ask about your financial data…"
                }
                disabled={loading || isBlocked}
                className="w-full text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 disabled:cursor-not-allowed placeholder:text-gray-300 dark:placeholder:text-zinc-500 transition-all resize-none overflow-y-auto max-h-[120px] leading-relaxed"
              />
              {!isBlocked && (
                <div className="px-1 flex justify-end">
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-colors",
                      input.length >= 300 ? "text-amber-500" : "text-gray-400"
                    )}
                  >
                    {input.length} / 350
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isBlocked}
              className="w-9 h-9 mt-0.5 flex-shrink-0 text-white rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
