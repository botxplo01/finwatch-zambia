"use client";

/**
 * FinWatch Zambia - NLP Chat Modal
 *
 * Floating AI assistant modal enabling SME users to query financial health assessments and metrics.
 */

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import {
  X,
  Send,
  Loader2,
  AlertTriangle,
  User,
  History,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  RotateCcw,
  Cloud,
  HardDrive,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { AIAssistantIcon } from "../shared/AIAssistantIcon";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import { ChatHistoryPanel } from "@/components/shared/ChatHistoryPanel";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  source?: any;
}

type Source = Message["source"];

interface NLPChatModalProps {
  open: boolean;
  onClose: () => void;
  sidebarCollapsed?: boolean;
  initialConversationId?: number | null;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hello! I'm FinWatch AI. I can help you understand your financial ratios, clarify prediction results, and guide you through the platform's early-warning metrics. Ask me anything about your business health!",
  source: null,
};

export function NLPChatModal({
  open,
  onClose,
  sidebarCollapsed = false,
  initialConversationId = null,
}: NLPChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<Source>(null);
  const [side, setSide] = useState<"left" | "right">("right");
  const [canInteract, setCanInteract] = useState(false);
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  const [initialVisualHeight, setInitialVisualHeight] = useState<number | null>(null);

  // Keyboard / Viewport handling for mobile
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;

    // Capture the initial height BEFORE keyboard opens
    const initial = window.visualViewport.height;
    setInitialVisualHeight(initial);
    setVisualHeight(initial);

    const handleResize = () => {
      setVisualHeight(window.visualViewport?.height || null);
    };

    window.visualViewport.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      setInitialVisualHeight(null);
      setVisualHeight(null);
    };
  }, [open]);

  // Conversation history and capacity states
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);

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

  // Synchronize layout side directly to avoid opening-side flashes
  useLayoutEffect(() => {
    if (open) {
      const savedSide = sessionStorage.getItem("chat_button_side");
      if (savedSide === "left" || savedSide === "right") {
        setSide(savedSide);
      }
    }
  }, [open, checkUsageStatus]);

  // Handle open state
  useEffect(() => {
    if (open) {
      checkUsageStatus();

      // Interaction delay to prevent ghost-click closing on mobile
      const timer = setTimeout(() => setCanInteract(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanInteract(false);
    }
  }, [open, checkUsageStatus]);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/conversations/${id}`);
      const { messages: storedMessages, at_capacity } = res.data;
      const loadedMessages: Message[] = [
        INITIAL_MESSAGE,
        ...storedMessages.map((m: any) => ({
          role: m.role,
          content: m.content,
          source: m.source || null,
        })),
      ];
      setMessages(loadedMessages);
      setConversationId(id);
      setAtCapacity(at_capacity ?? false);
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const resetSession = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setLastSource(null);
    setConversationId(null);
    setAtCapacity(false);
    checkUsageStatus();
  }, [checkUsageStatus]);

  const handleHistoryLoad = useCallback((id: number) => {
    if (id === -1) {
      resetSession();
    } else {
      loadConversation(id);
    }
  }, [loadConversation, resetSession]);

  useEffect(() => {
    if (open && initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [open, initialConversationId, loadConversation]);

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading || isBlocked || atCapacity) return;

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
        conversation_id: conversationId ?? undefined,
      });

      const { reply, source, current_count, cooldown_until: newCooldown, conversation_id: respConversationId, conversation_at_capacity } = res.data;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          source: source,
        },
      ]);

      if (source) setLastSource(source);
      if (respConversationId) setConversationId(respConversationId);
      if (conversation_at_capacity) setAtCapacity(true);
      
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
      <div
        className="fixed inset-0 bg-black/80 sm:hidden z-[60] transition-all duration-500 animate-in fade-in"
        onClick={() => canInteract && onClose()}
      />

      <div
        className={cn(
          "fixed z-[70] flex flex-col bg-white dark:bg-zinc-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-gray-100 dark:border-zinc-800 transition-all duration-300 animate-in slide-in-from-bottom-4 zoom-in-95",
          "inset-x-3 bottom-[80px] sm:inset-auto sm:bottom-24 sm:m-0",
          "h-fit max-h-[80vh] sm:w-[420px] sm:h-[540px]",
          side === "left"
            ? sidebarCollapsed
              ? "sm:left-[96px]"
              : "sm:left-[288px]"
            : "sm:right-8",
          "rounded-3xl overflow-hidden"
        )}
        style={(() => {
          if (!visualHeight || !initialVisualHeight) return {};
          const keyboardOpen = initialVisualHeight - visualHeight > 80;
          if (!keyboardOpen) return {};
          return {
            height: `${visualHeight - 32}px`,
            bottom: "16px",
          };
        })()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 flex shrink-0 items-center justify-between border-b border-gray-50 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <AIAssistantIcon size={26} className="text-white" animate={false} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  FinWatch AI
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetSession}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              title="Reset Conversation"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors relative"
              title="Conversation History"
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

        {showHistory && (
          <div className="absolute top-[76px] left-0 right-0 z-20">
            <ChatHistoryPanel
              portalType="sme"
              activeConversationId={conversationId}
              onLoad={handleHistoryLoad}
              onClose={() => setShowHistory(false)}
              onModalClose={onClose}
            />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900 relative">
          {messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div
                  key={i}
                  className="flex justify-center w-full animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-100 dark:border-red-900/40 w-full rounded-none text-center">
                    <FormattedMessage content={msg.content} />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm border dark:border-white/5",
                    msg.role === "user"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/30"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <AIAssistantIcon size={16} animate={false} />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/10"
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
                    <div className="mt-1.5 flex items-center gap-1.5 px-2">
                      {msg.source === "groq" ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 dark:border-purple-400/20 text-purple-600 dark:text-purple-400 backdrop-blur-sm">
                          <Cloud size={10} className="text-purple-500 dark:text-purple-400" />
                          <span>Groq</span>
                        </div>
                      ) : msg.source === "openrouter" ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20 text-blue-600 dark:text-blue-400 backdrop-blur-sm">
                          <Cloud size={10} className="text-blue-500 dark:text-blue-400" />
                          <span>OpenRouter</span>
                        </div>
                      ) : msg.source === "template" ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 text-amber-600 dark:text-amber-400 backdrop-blur-sm">
                          <HardDrive size={10} className="text-amber-500 dark:text-amber-400" />
                          <span>Template Engine</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3 animate-in fade-in duration-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 shadow-sm">
                <AIAssistantIcon size={16} animate={false} />
              </div>
              <div className="flex flex-col gap-1.5 max-w-[85%]">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-2xl rounded-tl-none border border-gray-100 dark:border-white/5 shadow-sm">
                  <Loader2 size={12} className="animate-spin text-purple-600" />
                  <span className="text-xs text-gray-400 italic">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Prompt Suggestions (moved to scrollable area) */}
          {messages.length <= 1 && !loading && (
            <div className="pt-2 flex flex-wrap gap-2">
              {[
                "What is my current ratio?",
                "Analyze my latest failure risk",
                "Explain debt-to-assets",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isBlocked || atCapacity}
                  className="px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-900/30 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 pb-6 sm:p-5 sm:pt-2 shrink-0 bg-white dark:bg-zinc-950 relative z-10 border-t border-gray-50 dark:border-zinc-900 pb-safe">
          {atCapacity && (
            <div className="mb-3 px-4 py-2.5 rounded-xl bg-amber-50
                            dark:bg-amber-950/20 border border-amber-100
                            dark:border-amber-900/30 text-xs text-amber-700
                            dark:text-amber-400 font-medium flex items-center
                            justify-between animate-in fade-in slide-in-from-top-1">
              <span>Conversation limit reached.</span>
              <button
                onClick={resetSession}
                className="underline font-bold ml-2 text-purple-600 dark:text-purple-400"
              >
                Start new
              </button>
            </div>
          )}
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
              placeholder={isBlocked ? "Message limit reached" : atCapacity ? "Conversation limit reached" : "Ask about your business health..."}
              disabled={loading || isBlocked || atCapacity}
              className={cn(
                "w-full bg-gray-50 dark:bg-zinc-900 border border-transparent focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none rounded-2xl pl-4 pr-12 py-3.5 text-sm resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-600 dark:text-white min-h-[52px] max-h-[120px]",
                (isBlocked || atCapacity) && "opacity-50 grayscale"
              )}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isBlocked || atCapacity}
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
