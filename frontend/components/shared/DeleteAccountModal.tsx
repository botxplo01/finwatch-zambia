"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * DeleteAccountModal Component
 */
export function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "An error occurred during deletion."
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-300">
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between bg-red-50/30 dark:bg-red-900/10">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle size={18} />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              Delete Account
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
            <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
              This action is permanent and irreversible!
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
              Once you confirm, your account and all associated data—including
              companies, financial records, and reports—will be deleted
              immediately and cannot be recovered.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
              Are you absolutely sure you want to proceed?
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              You will be immediately logged out and redirected to the login
              page.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Account"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
