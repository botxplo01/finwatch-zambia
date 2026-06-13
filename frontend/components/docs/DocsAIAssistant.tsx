"use client";

/**
 * FinWatch Zambia - Documentation AI Assistant
 *
 * A focused, circular floating assistant specifically for documentation help.
 * Supports multiple portals (SME, Regulator, Analyst) with theme-aware styling.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  X,
  Send,
  User,
  Bot,
  Loader2,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Cloud,
  HardDrive,
  History,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { getInstitutionalToken } from "@/lib/institutional-auth";
import api from "@/lib/api";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import { ConversationHistoryPanel } from "@/components/shared/ConversationHistoryPanel";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
}

interface DocsAIAssistantProps {
  portalType?: "sme" | "regulator" | "analyst";
}

export function DocsAIAssistant({ portalType = "sme" }: DocsAIAssistantProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  const [initialVisualHeight, setInitialVisualHeight] = useState<number | null>(null);

  // Keyboard / Viewport handling for mobile
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport)
      return;

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
  }, [isOpen]);

  const [isBlocked, setIsBlocked] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversation persistence states
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);



  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastToggleTime = useRef(0);

  const MAX_MESSAGES = 15;
  const storageKey =
    portalType === "sme" ? "docs_chat_button_side" : "reg_docs_chat_side";

  // Decoupled portal-aware tooltip keys
  const tooltipSessionKey =
    portalType === "sme"
      ? "hasSeenSmeDocsAITooltipThisSession"
      : portalType === "analyst"
      ? "hasSeenAnalystDocsAITooltipThisSession"
      : "hasSeenRegulatorDocsAITooltipThisSession";

  // 1. Fetch usage status from backend
  const checkUsageStatus = useCallback(async () => {
    try {
      const token = portalType === "sme" ? getToken() : getInstitutionalToken();
      const res = await api.get("/api/docs/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { is_blocked, cooldown_until, current_count } = res.data;
      setIsBlocked(is_blocked);
      setCooldownUntil(cooldown_until);
      setCount(current_count ?? 0);
    } catch (err) {
      console.error("Failed to fetch docs usage status:", err);
    }
  }, [portalType]);

  const resetSession = useCallback(() => {
    setHistory([]);
    setMessage("");
    setConversationId(null);
    setAtCapacity(false);
    checkUsageStatus();
  }, [checkUsageStatus]);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const token = portalType === "sme" ? getToken() : getInstitutionalToken();
      const res = await api.get(`/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { messages: storedMessages, at_capacity } = res.data;
      const loadedMessages: Message[] = storedMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
        source: m.source,
      }));
      setHistory(loadedMessages);
      setConversationId(id);
      setAtCapacity(at_capacity);
      checkUsageStatus();
    } catch (err) {
      console.error("Failed to load docs conversation:", err);
    }
  }, [portalType, checkUsageStatus]);

  const handleHistoryLoad = (id: number) => {
    if (id === -1) {
      resetSession();
    } else {
      loadConversation(id);
    }
    setShowHistory(false);
  };

  useEffect(() => {
    const handleLoadDocConversation = (e: any) => {
      const { conversationId: cid, portalType: pType } = e.detail || {};
      const targetPortalType = portalType === "sme" ? "sme_docs" : portalType === "regulator" ? "regulator_docs" : "analyst_docs";
      if (pType === targetPortalType && cid) {
        if (cid === -1) {
          resetSession();
        } else {
          loadConversation(cid);
          setIsOpen(true);
        }
      }
    };
    window.addEventListener("load-conversation", handleLoadDocConversation);
    return () => {
      window.removeEventListener("load-conversation", handleLoadDocConversation);
    };
  }, [portalType, loadConversation, resetSession]);

  useEffect(() => {
    const pending = localStorage.getItem("load_docs_conversation");
    if (pending) {
      try {
        const { conversationId: cid, portalType: pType } = JSON.parse(pending);
        const targetPortalType = portalType === "sme" ? "sme_docs" : portalType === "regulator" ? "regulator_docs" : "analyst_docs";
        if (pType === targetPortalType && cid) {
          localStorage.removeItem("load_docs_conversation");
          loadConversation(cid);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to parse pending docs conversation:", err);
      }
    }
  }, [portalType, loadConversation]);

  // Theme Config
  const theme = {
    bg:
      portalType === "regulator"
        ? "bg-emerald-600"
        : portalType === "analyst"
        ? "bg-blue-600"
        : "bg-purple-600",
    text:
      portalType === "regulator"
        ? "text-emerald-600"
        : portalType === "analyst"
        ? "text-blue-600"
        : "text-purple-600",
    lightBg:
      portalType === "regulator"
        ? "bg-emerald-100 dark:bg-emerald-900/30"
        : portalType === "analyst"
        ? "bg-blue-100 dark:bg-blue-900/30"
        : "bg-purple-100 dark:bg-purple-900/30",
    focus:
      portalType === "regulator"
        ? "focus:border-emerald-600 focus:ring-emerald-100 dark:focus:ring-emerald-900/40"
        : portalType === "analyst"
        ? "focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-900/40"
        : "focus:border-purple-600 focus:ring-purple-100 dark:focus:ring-purple-900/40",
    icon: Sparkles,
  };

  const ThemeIcon = theme.icon;

  // Tooltip Logic
  useEffect(() => {
    const isLandingPage =
      pathname === "/sme/docs" ||
      pathname === "/analyst/docs" ||
      pathname === "/regulator/docs";

    const hasSeenTooltip = sessionStorage.getItem(tooltipSessionKey) === "true";

    if (isLandingPage && !hasSeenTooltip && !isOpen) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        sessionStorage.setItem(tooltipSessionKey, "true");
        // Auto-hide after 10s
        setTimeout(() => setShowTooltip(false), 10000);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pathname, isOpen, tooltipSessionKey]);

  const closeTooltip = () => {
    setShowTooltip(false);
    sessionStorage.setItem(tooltipSessionKey, "true");
  };

  // Initialize side from session storage
  useEffect(() => {
    const savedSide = sessionStorage.getItem(storageKey);
    if (savedSide === "left" || savedSide === "right") {
      setSide(savedSide);
    }
    checkUsageStatus();
  }, [storageKey, checkUsageStatus]);

  const toggleChat = () => {
    const now = Date.now();
    if (now - lastToggleTime.current < 300) return;
    lastToggleTime.current = now;
    if (!isOpen) {
      checkUsageStatus();
    }
    setIsOpen(!isOpen);
  };

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
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) setHasMoved(true);
    setDragPos({ x: dx, y: dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    containerRef.current?.releasePointerCapture(e.pointerId);

    if (!hasMoved) {
      toggleChat();
    }

    const newSide = e.clientX < window.innerWidth / 2 ? "left" : "right";
    setSide(newSide);
    sessionStorage.setItem(storageKey, newSide);
    setDragPos({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || isBlocked || count >= MAX_MESSAGES || atCapacity)
      return;

    const userMsg: Message = { role: "user", content: message };
    setHistory((prev) => [...prev, userMsg]);
    setMessage("");
    setIsLoading(true);

    try {
      const token = portalType === "sme" ? getToken() : getInstitutionalToken();
      const endpoint = "/api/docs/chat";

      const res = await api.post(
        endpoint,
        {
          message: userMsg.content,
          history: history.map((h) => ({ role: h.role, content: h.content })),
          conversation_id: conversationId ?? undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const {
        reply,
        source,
        current_count,
        cooldown_until: newCooldown,
        conversation_id,
        conversation_at_capacity,
      } = res.data;

      setHistory((prev) => [...prev, { role: "assistant", content: reply, source }]);
      setCount(current_count);

      if (conversation_id) {
        setConversationId(conversation_id);
      }
      if (conversation_at_capacity) {
        setAtCapacity(true);
      }

      if (newCooldown) {
        setIsBlocked(true);
        setCooldownUntil(newCooldown);
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setIsBlocked(true);
        const until = err?.response?.data?.detail?.cooldown_until;
        if (until) setCooldownUntil(until);
      }

      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting to the knowledge base.",
        },
      ]);
    } finally {
      setIsLoading(false);
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

  return (
    <>
      {/* Subtle Dimmer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/5 pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}

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
                  portalType === "regulator"
                    ? "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#10b981_100%)]"
                    : portalType === "analyst"
                    ? "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#2563eb_100%)]"
                    : "bg-[conic-gradient(from_0deg,transparent_0,transparent_70%,#6d28d9_100%)]"
                )}
              />

              <div
                className={cn(
                  "relative z-10 p-4 rounded-[15px] backdrop-blur-xl border border-transparent",
                  theme.lightBg
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-50",
                    theme.text
                  )}
                >
                  Docs AI
                </p>
                <p
                  className={cn(
                    "text-[13px] leading-relaxed font-medium",
                    portalType === "regulator"
                      ? "text-emerald-900 dark:text-emerald-100"
                      : portalType === "analyst"
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-purple-900 dark:text-purple-100"
                  )}
                >
                  {portalType === "sme"
                    ? "Need help with the guides? Ask me anything about ratios or platform features!"
                    : "I can help you navigate technical documentation or interpret systemic risk metrics."}
                </p>
              </div>

              <div
                className={cn(
                  "absolute -bottom-1 w-3 h-3 rotate-45 z-0",
                  side === "right" ? "right-6" : "left-6",
                  theme.lightBg
                )}
              />
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTooltip();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
              type="button"
              className={cn(
                "absolute -top-2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border flex items-center justify-center transition-colors z-20 shadow-sm",
                side === "right" ? "-right-2" : "-left-2",
                portalType === "regulator"
                  ? "border-emerald-100 dark:border-emerald-900/30 text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200"
                  : portalType === "analyst"
                  ? "border-blue-100 dark:border-blue-900/30 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  : "border-purple-100 dark:border-purple-900/30 text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
              )}
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        )}

        <button
          id="docs-assistant-toggle"
          onClick={(e) => {
            if (!isDragging) {
              toggleChat();
            }
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16 outline-none relative z-10 group"
        >
          <div
            className={cn(
              "relative w-full h-full flex items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105 active:scale-95",
              theme.bg,
              !isOpen && "animate-float"
            )}
          >
            {/* Background Glow */}
            {!isOpen && (
              <div
                className={cn(
                  "absolute inset-0 rounded-full blur-md opacity-40 -z-10",
                  portalType === "regulator"
                    ? "bg-emerald-500"
                    : portalType === "analyst"
                    ? "bg-blue-500"
                    : "bg-purple-500"
                )}
              />
            )}

            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <ThemeIcon className="h-6 w-6 text-white" />
            )}
            {!isOpen && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white border border-white/20 shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
                {MAX_MESSAGES - count}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-[70] flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl transition-all dark:bg-zinc-950 sm:w-[380px] sm:h-[420px]",
            "w-[calc(100vw-3rem)] h-[50vh]",
            "bottom-24",
            side === "right" ? "right-6" : "left-6"
          )}
          style={(() => {
            if (!visualHeight || !initialVisualHeight) return {};
            // Keyboard is open if visual height has shrunk more than 80px
            // from its initial value. 80px threshold avoids triggering on
            // minor browser chrome changes (address bar show/hide).
            const keyboardOpen = initialVisualHeight - visualHeight > 80;
            if (!keyboardOpen) return {};
            return {
              maxHeight: `${visualHeight}px`,
              bottom: "0px",
            };
          })()}
        >
          {/* Header */}
          <div
            className={cn(
              "p-5 pb-4 flex shrink-0 items-center justify-between border-b border-border text-white relative z-10",
              theme.bg
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                <ThemeIcon size={20} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Docs AI
                  </h3>
                  <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetSession}
                className="p-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title="Reset Conversation"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors relative"
                title="Conversation History"
              >
                <History size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-white/80 hover:bg-red-500/20 hover:text-red-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="absolute top-[76px] left-0 right-0 z-20">
              <ConversationHistoryPanel
                portalType={portalType === "sme" ? "sme_docs" : portalType === "regulator" ? "regulator_docs" : "analyst_docs"}
                activeConversationId={conversationId}
                onLoad={handleHistoryLoad}
                onClose={() => setShowHistory(false)}
              />
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
                <Bot className={cn("h-10 w-10 mb-2", theme.text)} />
                <p className="text-sm font-medium">
                  Hello! How can I help you understand FinWatch{" "}
                  {portalType === "sme" ? "" : "Institutional"} features?
                </p>
                <p className="text-xs">
                  {portalType === "sme"
                    ? "Ask about ratios, results, or how to use the platform."
                    : portalType === "regulator"
                    ? "Ask about sector trends, anonymization, or anomaly detection."
                    : "Ask about systemic metrics, policy briefs, or access boundaries."}
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
                      : theme.lightBg + " " + theme.text
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm shadow-sm",
                      msg.role === "user"
                        ? theme.bg + " text-white"
                        : "bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                    )}
                  >
                    <FormattedMessage
                      content={msg.content}
                      className={msg.role === "user" ? "prose-invert" : ""}
                    />
                  </div>
                  {msg.role === "assistant" && msg.source && (
                    <div className="flex items-center gap-1.5 px-2">
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
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    theme.lightBg + " " + theme.text
                  )}
                >
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-4 py-2">
                  <Loader2 className={cn("h-4 w-4 animate-spin", theme.text)} />
                  <span className="text-xs text-muted-foreground italic">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cooldown Timer Alert */}
          {isBlocked && cooldownUntil && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-[10px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Reset at {formatLocalTime(cooldownUntil)}
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium italic">
                Please wait
              </p>
            </div>
          )}

          {/* Capacity Alert */}
          {atCapacity && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-500 font-bold uppercase">
                Capacity Reached (20/20)
              </span>
              <button
                onClick={resetSession}
                className={cn("text-[10px] font-semibold underline hover:opacity-80 transition-opacity", theme.text)}
              >
                Start New
              </button>
            </div>
          )}

          {/* Input Area */}
          <div
            className={cn(
              "border-t border-border p-4 transition-all shrink-0 pb-safe",
              (isBlocked || atCapacity)
                ? "bg-gray-50/50 dark:bg-zinc-900/50 opacity-80"
                : "bg-zinc-50/50 dark:bg-zinc-900/50"
            )}
          >
            <form onSubmit={handleSend} className="relative">
              <input
                type="text"
                placeholder={
                  isBlocked
                    ? "Usage limit reached"
                    : atCapacity
                    ? "Capacity reached. Start new."
                    : "Ask a question..."
                }
                disabled={isLoading || isBlocked || atCapacity}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                className={cn(
                  "w-full rounded-full border border-border bg-white py-2.5 pl-4 pr-12 text-sm focus:outline-none dark:bg-zinc-950",
                  theme.focus
                )}
              />
              <button
                type="submit"
                disabled={!message.trim() || isLoading || isBlocked || atCapacity}
                className={cn(
                  "absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-30",
                  theme.bg
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground">
                {count} of {MAX_MESSAGES} questions used
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
