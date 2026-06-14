"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Loader2,
  Trash2,
  Check,
  X,
  MessageSquare,
  Settings,
  Minus,
} from "lucide-react";
import api from "@/lib/api";
import { cn, stripMarkdown } from "@/lib/utils";
import { getInstitutionalAuthHeader } from "@/lib/institutional-auth";

interface ChatListItem {
  id: number;
  title: string;
  preview: string;
  updated_at: string;
  user_message_count: number;
  ai_response_count: number;
  at_capacity: boolean;
}

interface ChatHistoryPanelProps {
  portalType: "sme" | "institutional" | "sme_docs" | "regulator_docs" | "analyst_docs";
  activeConversationId: number | null;
  onLoad: (conversationId: number) => void;
  onClose: () => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function ChatHistoryPanel({
  portalType,
  activeConversationId,
  onLoad,
  onClose,
}: ChatHistoryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Actions states
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  const isSme = portalType === "sme" || portalType === "sme_docs";
  const isAnalyst = portalType === "analyst_docs" || pathname.includes("/analyst");

  const accentText = isSme 
    ? "text-purple-600 dark:text-purple-400" 
    : isAnalyst 
    ? "text-blue-600 dark:text-blue-400" 
    : "text-emerald-600 dark:text-emerald-400";
  const accentBorder = isSme 
    ? "border-purple-600 dark:border-purple-500" 
    : isAnalyst 
    ? "border-blue-600 dark:border-blue-500" 
    : "border-emerald-600 dark:border-emerald-500";
  const activeItemBg = isSme 
    ? "bg-purple-50/40 dark:bg-purple-900/10" 
    : isAnalyst 
    ? "bg-blue-50/40 dark:bg-blue-900/10" 
    : "bg-emerald-50/40 dark:bg-emerald-900/10";

  const getRequestHeaders = useCallback(() => {
    return isSme ? {} : { headers: getInstitutionalAuthHeader() };
  }, [isSme]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ChatListItem[]>(
        `/api/conversations/?portal_type=${portalType}`,
        getRequestHeaders()
      );
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [portalType, getRequestHeaders]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle outside click to close panel
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [onClose]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`, getRequestHeaders());
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        onLoad(-1); // special signal to reset/clear
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await api.delete(`/api/conversations/?portal_type=${portalType}`, getRequestHeaders());
      setConversations([]);
      onLoad(-1); // Reset
    } catch (err) {
      console.error("Failed to delete all conversations:", err);
    } finally {
      setConfirmDeleteAll(false);
    }
  };

  const handleSettingsNavigate = () => {
    let basePath = "/sme";
    if (pathname.includes("/regulator")) basePath = "/regulator";
    if (pathname.includes("/analyst")) basePath = "/analyst";
    router.push(`${basePath}/settings?tab=account`);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 w-full p-5 flex flex-col animate-in slide-in-from-top-1 duration-200 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-zinc-900 mb-2">
        <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <MessageSquare size={13} />
          Chat History
        </span>

        <div className="flex items-center gap-1">
          {conversations.length > 0 && (
            <div className="flex items-center mr-1">
              {confirmDeleteAll ? (
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30 animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Clear all?</span>
                  <button
                    onClick={handleDeleteAll}
                    className="p-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="p-1 rounded-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Delete all chats"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleSettingsNavigate}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            title="Open AI settings"
          >
            <Settings size={16} />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            title="Minimize"
          >
            <Minus size={16} />
          </button>
        </div>
      </div>

      {/* List Container */}
      <div className="max-h-[220px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 size={18} className={cn("animate-spin", accentText)} />
            <span className="text-xs italic">Loading history...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-xs text-red-500 font-medium">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 dark:text-zinc-500 font-medium italic">
            No saved chats yet.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isDeleting = deletingId === conv.id;

            return (
              <div
                key={conv.id}
                onClick={() => !isDeleting && onLoad(conv.id)}
                className={cn(
                  "p-3 rounded-2xl border border-transparent transition-all flex flex-col gap-1 relative group/item cursor-pointer overflow-hidden",
                  isActive ? cn(activeItemBg, "border-l-4", accentBorder) : "hover:bg-gray-50 dark:hover:bg-zinc-900/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 block truncate leading-tight">
                      {conv.title || "Untitled Chat"}
                    </span>
                  </div>

                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 whitespace-nowrap pt-0.5">
                    {timeAgo(conv.updated_at)}
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate leading-normal pr-8">
                  {stripMarkdown(conv.preview) || "No message preview available."}
                </p>

                {/* Actions overlay */}
                <div 
                  className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setDeletingId(conv.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shadow-sm bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Confirm Delete overlay (Harmonized with Settings) */}
                {isDeleting && (
                  <div 
                    className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-center gap-4 animate-in fade-in duration-200 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-red-500 font-bold uppercase">Delete this chat?</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
