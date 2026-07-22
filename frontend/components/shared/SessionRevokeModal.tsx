"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut,
  ShieldAlert,
  Loader2,
  X,
  Smartphone,
  Laptop,
  Monitor,
} from "lucide-react";

interface SessionRevokeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  session: {
    jti: string;
    device_name: string;
    device_type: string;
    platform: string;
    is_primary: boolean;
    is_current: boolean;
  } | null;
  portalType: "sme" | "institutional";
}

/**
 * SessionRevokeModal Component
 *
 * Custom confirmation modal for session revocation with device details,
 * primary warning, loading state, and error feedback.
 */
export function SessionRevokeModal({
  isOpen,
  onClose,
  onConfirm,
  session,
  portalType,
}: SessionRevokeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(false);
      setError(null);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    },
    [onClose, loading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !session) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to sign out this device. Please try again."
      );
      setLoading(false);
    }
  };

  const isPrimary = session.is_primary;
  const isCurrent = session.is_current;

  const DeviceIcon =
    session.device_type === "Mobile"
      ? Smartphone
      : session.platform === "Windows" ||
          session.platform === "macOS" ||
          session.platform === "Linux"
        ? Laptop
        : Monitor;

  const HeaderIcon = isPrimary ? ShieldAlert : LogOut;
  const headerIconContainer = isPrimary
    ? "bg-amber-50 dark:bg-amber-900/20"
    : "bg-gray-50 dark:bg-zinc-800";
  const headerIconText = isPrimary
    ? "text-amber-600 dark:text-amber-400"
    : "text-gray-600 dark:text-zinc-300";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-revoke-title"
    >
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-300">
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${headerIconContainer}`}
          >
            <HeaderIcon size={24} className={headerIconText} />
          </div>
          <h3
            id="session-revoke-title"
            className="text-base font-bold text-gray-900 dark:text-zinc-100"
          >
            {isPrimary ? "Sign Out Primary Device" : "Sign Out Device"}
          </h3>
        </div>

        <div className="px-6 pb-4 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
            <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 flex-shrink-0">
              <DeviceIcon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 truncate">
                {session.device_name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400">
                  {session.platform}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400">
                  {session.device_type}
                </span>
              </div>
            </div>
          </div>

          {isPrimary && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30">
              <ShieldAlert
                size={14}
                className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                This is your primary session. Signing it out will promote
                another active session to primary, or leave no primary session
                if this is the only one.
              </p>
            </div>
          )}

          {isCurrent && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/30">
              <LogOut
                size={14}
                className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                This is your current session. Signing out will immediately end
                your session and redirect you to the login page.
              </p>
            </div>
          )}

          <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed text-center">
            This action will immediately sign out this device and release its
            slot from your active device allocation.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
              <span className="flex-1 text-xs">{error}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
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
                Signing Out…
              </>
            ) : (
              "Sign Out Device"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
