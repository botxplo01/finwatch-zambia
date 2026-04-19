"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  X,
  Send,
  Bot,
  User,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_QUESTIONS = 15;

const SUGGESTED_PROMPTS = [
  "What does a current ratio below 1 mean?",
  "Explain my company's distress probability",
  "Which ratios are most important for Zambian SMEs?",
  "What is SHAP and how does it work?",
];

// ── Types ────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant" | "error";

interface Message {
  role: Role;
  content: string;
  timestamp: Date;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── INITIAL MESSAGE ──────────────────────────────────────────────────────────
const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hello! I'm the FinWatch AI assistant. I can help you understand your financial ratios, prediction results, and what they mean for your business. You have 15 questions available this session.",
  timestamp: new Date(),
};

// ── Component ────────────────────────────────────────────────────────────────
export function NLPChatModal({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const questionsLeft = MAX_QUESTIONS - questionCount;
  const limitReached = questionCount >= MAX_QUESTIONS;

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset on new session (re-open)
  function resetSession() {
    setMessages([INITIAL_MESSAGE]);
    setQuestionCount(0);
    setInput("");
    setServiceAvailable(null);
  }

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading || limitReached) return;

    setInput("");
    const userMsg: Message = {
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setQuestionCount((c) => c + 1);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setServiceAvailable(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, timestamp: new Date() },
      ]);
    } catch {
      setServiceAvailable(false);
      // Provide a helpful static fallback rather than a generic error
      const fallback = getFallbackResponse(userText);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fallback, timestamp: new Date() },
      ]);
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

  if (!open) return null;

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
      {/* Clickable backdrop to close */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-96 h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* ── Header ── */}
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
              <p className="text-white text-sm font-semibold leading-tight">
                FinWatch AI
              </p>
              <p className="text-purple-300 text-[10px] leading-tight">
                {limitReached
                  ? "Session limit reached"
                  : `${questionsLeft} question${questionsLeft !== 1 ? "s" : ""} remaining`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Service indicator */}
            {serviceAvailable !== null && (
              <div
                title={
                  serviceAvailable
                    ? "AI service connected"
                    : "Using fallback mode"
                }
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  serviceAvailable ? "bg-green-400" : "bg-amber-400"
                }`}
              />
            )}

            {/* New session */}
            <button
              onClick={resetSession}
              title="Start new session"
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {/* Loading dots */}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={11} className="text-purple-600" />
              </div>
              <div className="bg-white border border-gray-100 px-3 py-2.5 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
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

          {/* Session limit notice */}
          {limitReached && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                You&apos;ve reached the 15-question session limit. Click{" "}
                <button
                  onClick={resetSession}
                  className="underline font-medium hover:text-amber-900"
                >
                  New Session
                </button>{" "}
                to continue.
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Suggested Prompts (only when just opened) ── */}
        {messages.length === 1 && (
          <div className="px-3 pb-1 bg-gray-50/50 flex gap-1.5 flex-wrap">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-[10px] text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors leading-tight"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        <div className="p-3 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                limitReached
                  ? "Session limit reached"
                  : "Ask about your financial data…"
              }
              disabled={limitReached || loading}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-300 transition-all"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || limitReached}
              className="w-9 h-9 flex-shrink-0 text-white rounded-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              <Send size={13} />
            </button>
          </div>
          {serviceAvailable === false && (
            <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={9} />
              AI service offline — showing guided responses
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5
          ${isUser ? "bg-purple-600" : "bg-purple-100"}`}
      >
        {isUser ? (
          <User size={11} className="text-white" />
        ) : (
          <Bot size={11} className="text-purple-600" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] px-3 py-2 text-sm leading-relaxed
          ${
            isUser
              ? "bg-purple-600 text-white rounded-2xl rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
          }`}
      >
        {message.content}
      </div>
    </div>
  );
}

// ── Fallback responses ───────────────────────────────────────────────────────
// Keyword-based static responses used when the backend is unavailable.
// These are grounded in financial domain knowledge relevant to the project.

function getFallbackResponse(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("current ratio") || q.includes("liquidity")) {
    return "The current ratio measures a company's ability to cover short-term liabilities with short-term assets. A ratio below 1.0 signals potential cash flow problems — the company may struggle to pay debts due within 12 months. For Zambian SMEs, this is a critical early warning indicator.";
  }
  if (q.includes("distress") || q.includes("probability")) {
    return "The distress probability is the model's confidence (0–100%) that a company is heading toward financial difficulty. Values above 50% suggest elevated risk. The Random Forest model takes precedence over Logistic Regression in FinWatch when they disagree, as it consistently achieves higher F1 scores on the UCI dataset.";
  }
  if (q.includes("shap")) {
    return "SHAP (SHapley Additive exPlanations) explains each prediction by assigning a contribution score to every financial ratio. A positive SHAP value for 'debt_to_assets' means that ratio is pushing the prediction toward distress. This makes the model interpretable and actionable — you can see exactly which ratios to improve.";
  }
  if (q.includes("debt") || q.includes("leverage")) {
    return "The debt-to-equity and debt-to-assets ratios measure financial leverage. High leverage amplifies both gains and losses. For SMEs in Zambia, limited access to equity financing often means higher leverage — context matters when interpreting these ratios.";
  }
  if (q.includes("ratio") || q.includes("metric")) {
    return "FinWatch tracks 10 financial ratios grouped by category: liquidity (current, quick, cash), leverage (debt-to-equity, debt-to-assets, interest coverage), and profitability/efficiency (net profit margin, ROA, ROE, asset turnover). Each is engineered from the raw financials you enter.";
  }

  return "The AI chat service is currently offline. Your prediction results and SHAP explanations are still available on each prediction detail page, and auto-generated narratives explain the key risk factors in plain language. Please try again later for live chat responses.";
}
