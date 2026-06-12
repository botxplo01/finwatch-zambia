"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2,
  Pencil,
  Trash2,
  ExternalLink,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { getInstitutionalAuthHeader } from "@/lib/institutional-auth";

interface ConversationListItem {
  id: number;
  title: string;
  preview: string;
  updated_at: string;
  user_message_count: number;
  ai_response_count: number;
  at_capacity: boolean;
}

interface ConversationHistoryPanelProps {
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

export function ConversationHistoryPanel({
  portalType,
  activeConversationId,
  onLoad,
  onClose,
}: ConversationHistoryPanelProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Actions states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  const isSme = portalType === "sme" || portalType === "sme_docs";
  const isAnalyst = portalType === "analyst_docs";

  const accentText = isSme 
    ? "text-purple-600 dark:text-purple-400" 
    : isAnalyst 
    ? "text-blue-600 dark:text-blue-400" 
    : "text-emerald-600 dark:text-emerald-400";
  const accentBg = isSme 
    ? "bg-purple-600" 
    : isAnalyst 
    ? "bg-blue-600" 
    : "bg-emerald-600";
  const accentBorder = isSme 
    ? "border-purple-600 dark:border-purple-500" 
    : isAnalyst 
    ? "border-blue-600 dark:border-blue-500" 
    : "border-emerald-600 dark:border-emerald-500";
  const accentHoverBg = isSme 
    ? "hover:bg-purple-50 dark:hover:bg-purple-950/20" 
    : isAnalyst 
    ? "hover:bg-blue-50 dark:hover:bg-blue-950/20" 
    : "hover:bg-emerald-50 dark:hover:bg-emerald-950/20";
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
      const res = await api.get<ConversationListItem[]>(
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

  const handleStartRename = (id: number, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = async (id: number) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await api.put(
        `/api/conversations/${id}`,
        { title: editTitle.trim() },
        getRequestHeaders()
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: res.data.title } : c))
      );
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`, getRequestHeaders());
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        // If we deleted the active conversation, trigger reload/reset locally
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

  return (
    <div
      ref={panelRef}
      className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-xl w-full p-4 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-zinc-900 mb-2">
        <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <MessageSquare size={13} />
          Conversations
        </span>

        {conversations.length > 0 && (
          <div>
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-500 font-semibold uppercase">Sure?</span>
                <button
                  onClick={handleDeleteAll}
                  className="text-[10px] font-bold text-red-600 hover:text-red-700 underline"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-500 underline"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                Delete all
              </button>
            )}
          </div>
        )}
      </div>

      {/* List Container */}
      <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900">
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
            No saved conversations yet.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isDeleting = deletingId === conv.id;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                className={cn(
                  "p-2.5 rounded-2xl border border-transparent transition-all flex flex-col gap-1.5 relative group/item",
                  isActive ? cn(activeItemBg, "border-l-4", accentBorder) : "hover:bg-gray-50 dark:hover:bg-zinc-900/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Title or Editor */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(conv.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="w-full text-xs font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 border border-purple-400 rounded px-1.5 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 block truncate leading-tight">
                        {conv.title || "Untitled Conversation"}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 whitespace-nowrap pt-0.5">
                    {timeAgo(conv.updated_at)}
                  </span>
                </div>

                {/* Preview */}
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate leading-normal pr-16">
                  {conv.preview || "No message preview available."}
                </p>

                {/* Actions overlay */}
                <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-transparent">
                  {isDeleting ? (
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 px-1 py-0.5 rounded border border-gray-100 dark:border-zinc-800 shadow-sm">
                      <span className="text-[9px] text-red-500 font-bold uppercase mr-1">Delete?</span>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="p-0.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        title="Confirm"
                      >
                        <Check size={10} />
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="p-0.5 rounded text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900"
                        title="Cancel"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartRename(conv.id, conv.title)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Rename"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => setDeletingId(conv.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                      <button
                        onClick={() => onLoad(conv.id)}
                        className={cn(
                          "p-1 rounded transition-colors",
                          accentText,
                          accentHoverBg
                        )}
                        title="Load Conversation"
                      >
                        <ExternalLink size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
