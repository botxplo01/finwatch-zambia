"use client";

/**
 * FinWatch Zambia - Regulator Chat Modal
 *
 * AI assistant modal for regulator and policy analyst users to ask questions
 * about system-wide distress patterns, sector trends, model performance,
 * and ratio benchmarks. All data referenced is anonymised aggregate.
 * 
 * Usage Enforcement: 15 messages per 2-hour rolling window.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  X,
  Send,
  Bot,
  User,
  RefreshCw,
  ShieldCheck,
  Cloud,
  HardDrive,
  FileText,
  AlertCircle,
  Timer
} from "lucide-react";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import api from "@/lib/api";
import { getRegAuthHeader } from "@/lib/regulator-auth";
import { cn } from "@/lib/utils";

// Types

type Role = "user" | "assistant" | "system";
type Source = "groq" | "ollama_local" | "ollama_local_fallback" | "template" | null;

interface Message {
  role: Role;
  content: string;
  source?: Source;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: string; // "regulator" | "policy_analyst"
}

// Constants

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hello! I'm the FinWatch regulatory AI assistant. I can help you interpret system-wide distress patterns, sector trends, model performance, and ratio benchmarks. All data I reference is fully anonymised — no company names or personal information.",
  source: null,
};

const REGULATOR_PROMPTS = [
  "Summarise the current system distress situation",
  "Which sector has the highest distress rate?",
  "Compare Random Forest vs Logistic Regression performance",
  "What do the ratio benchmarks tell us about distressed SMEs?",
  "Explain the anomaly flags",
];

const ANALYST_PROMPTS = [
  "Summarise the current system distress situation",
  "Which sector has the highest distress rate?",
  "Compare model performance across assessments",
  "What does the average distress probability indicate?",
  "Explain what SHAP values mean at the system level",
];

// Source Badge

function SourceBadge({ source }: { source: Source }) {
  if (!source) return null;

  const config: Record<
    NonNullable<Source>,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    groq: { label: "Groq", icon: <Cloud size={9} />, color: "text-purple-400" },
    ollama_local: {
      label: "Ollama Local",
      icon: <HardDrive size={9} />,
      color: "text-amber-400",
    },
    ollama_local_fallback: {
      label: "Local Fallback",
      icon: <HardDrive size={9} />,
      color: "text-orange-400",
    },
    template: {
      label: "Template",
      icon: <FileText size={9} />,
      color: "text-gray-400",
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
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Usage Limit Reached</p>
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
          ${
            isUser ? "bg-emerald-600" : "bg-emerald-100 dark:bg-emerald-900/30"
          }`}
      >
        {isUser ? (
          <User size={11} className="text-white" />
        ) : (
          <Bot size={11} className="text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <div
       className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}
      >
       <div
         className={`px-3 py-2 text-sm leading-relaxed
           ${
             isUser
               ? "bg-emerald-600 text-white rounded-2xl rounded-tr-sm shadow-sm"
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

export function RegulatorChatModal({ open, onClose, userRole }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<Source>(null);

  // Usage limits state
  const [isBlocked, setIsBlocked] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedPrompts =
    userRole === "regulator" ? REGULATOR_PROMPTS : ANALYST_PROMPTS;
  const roleLabel = userRole === "regulator" ? "Regulator" : "Policy Analyst";

  // 1. Fetch usage status from backend
  const checkUsageStatus = async () => {
    try {
      const res = await api.get("/api/regulator/chat/status", { headers: getRegAuthHeader() });
      const { is_blocked, cooldown_until } = res.data;
      setIsBlocked(is_blocked);
      setCooldownUntil(cooldown_until);

      if (is_blocked && cooldown_until) {
        insertLimitMessage(cooldown_until);
      }
    } catch (err) {
      console.error("Failed to fetch regulator usage status:", err);
    }
  };

  const formatLocalTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const insertLimitMessage = (until: string) => {
    const resetTime = formatLocalTime(until);
    const content = `You have reached the FinWatch AI Assistant usage limit. You can continue using the assistant again at ${resetTime}.`;
    
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "system" && lastMsg.content.includes(resetTime)) {
        return prev;
      }
      return [...prev, { role: "system", content }];
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
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
    setLoading(true);

    const history = updatedMessages
      .slice(1)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.post(
        "/api/regulator/chat/",
        { message: userText, history },
        { headers: getRegAuthHeader() },
      );
      const { reply, source, cooldown_until } = res.data;
      setLastSource(source as Source);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, source: source as Source },
      ]);

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
        const fallback = data?.detail ?? "The AI service is temporarily unavailable. Please try again.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: typeof fallback === 'string' ? fallback : "An error occurred.", source: "template" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const sourceLabel: Record<NonNullable<Source>, string> = {
    groq: "Groq",
    ollama_local: "Ollama Local",
    ollama_local_fallback: "Local Fallback",
    template: "Template mode",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative w-96 h-[600px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden pointer-events-auto transition-all duration-300">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <ShieldCheck size={14} className="text-emerald-200" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">
                FinWatch Regulatory AI
              </p>
              <p className="text-emerald-300 text-[10px] leading-tight">
                {isBlocked ? "Limit reached" : (lastSource ? sourceLabel[lastSource] : roleLabel)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isBlocked && <Timer size={13} className="text-amber-400 mr-1 animate-pulse" />}

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

        {/* Privacy notice strip */}
        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-900/30">
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 text-center">
            All data referenced is anonymised aggregate — no company names or
            PII
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-zinc-950/50">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot
                  size={11}
                  className="text-emerald-600 dark:text-emerald-400"
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

        {/* Cooldown Timer Alert */}
        {isBlocked && cooldownUntil && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-[10px] uppercase">
              <Timer size={12} />
              Reset at {formatLocalTime(cooldownUntil)}
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Please wait</p>
          </div>
        )}

        {/* Suggested Prompts */}
        {messages.length === 1 && !loading && !isBlocked && (
          <div className="px-3 pb-2 bg-gray-50/50 dark:bg-zinc-950/50 flex gap-1.5 flex-wrap">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors leading-tight"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className={cn(
          "p-3 border-t border-gray-100 dark:border-zinc-800 flex-shrink-0 transition-all",
          isBlocked ? "bg-gray-50/50 dark:bg-zinc-950/50 grayscale opacity-70" : "bg-white dark:bg-zinc-900"
        )}>
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBlocked ? "Assistant disabled temporarily" : "Ask about distress trends, sectors, models…"}
              disabled={loading || isBlocked}
              className="flex-1 text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 disabled:cursor-not-allowed placeholder:text-gray-300 dark:placeholder:text-zinc-500 transition-all"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isBlocked}
              className="w-9 h-9 flex-shrink-0 text-white rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
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
