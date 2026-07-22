"use client";

import React, { useState, useEffect } from "react";
import { Camera, ShieldAlert } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { AndroidSettings } from "@/lib/capacitor-plugins";
import { cn } from "@/lib/utils";

interface PermissionOnboardingProps {
  portalType: "sme" | "institutional";
  isOpen: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export default function PermissionOnboarding({
  portalType,
  isOpen,
  onClose,
  onGranted,
}: PermissionOnboardingProps) {
  const [permissionState, setPermissionState] = useState<
    "prompt" | "denied" | "granted"
  >("prompt");
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const accent =
    portalType === "sme"
      ? {
          primary: "text-purple-600 dark:text-purple-400",
          bg: "bg-purple-600",
          bgLight: "bg-purple-50 dark:bg-purple-900/20",
          border: "border-purple-200 dark:border-purple-800",
          ring: "ring-purple-500/20",
          gradient: "from-purple-600 to-violet-700",
        }
      : {
          primary: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-600",
          bgLight: "bg-emerald-50 dark:bg-emerald-900/20",
          border: "border-emerald-200 dark:border-emerald-800",
          ring: "ring-emerald-500/20",
          gradient: "from-emerald-600 to-teal-700",
        };

  useEffect(() => {
    if (!isOpen) return;

    const checkPermissionStatus = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const res = await navigator.permissions.query({
            name: "camera" as any,
          });

          if (res.state === "granted") {
            setPermissionState("granted");
            onGranted();
            return;
          } else if (res.state === "denied") {
            setPermissionState("denied");
            return;
          }
        }
        setPermissionState("prompt");
      } catch {
        setPermissionState("prompt");
      }
    };

    checkPermissionStatus();
  }, [isOpen, onGranted]);

  const requestPermission = async () => {
    setError(null);
    try {
      // PROBE: Triggers OS dialog
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // CRITICAL: Immediately release hardware
      stream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });

      setPermissionState("granted");
      localStorage.setItem("hasSeenCameraPermissionOnboarding", "true");

      // Brief success state before switching to scanner
      setTimeout(() => {
        onGranted();
      }, 800);
    } catch (err: any) {
      const name = err?.name || "";
      const message = err?.message || "";

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermissionState("denied");
        setError(
          "Camera permission was denied. Please enable it in Settings to synchronise securely."
        );
      } else if (
        message.includes("busy") ||
        message.includes("locked") ||
        name === "NotReadableError"
      ) {
        setPermissionState("denied");
        setError(
          "Camera is currently in use by another app. Please close it and try again."
        );
      } else {
        setPermissionState("denied");
        setError(`Camera initialisation failed: ${message || "Unknown error"}`);
      }
    }
  };

  const handleOpenSettings = async () => {
    try {
      await AndroidSettings.openAppSettings();
      setShowManual(true);
    } catch (err: any) {
      setError("Unable to launch system settings automatically.");
      setShowManual(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800/80 animate-in zoom-in-95 duration-300 flex flex-col">
        {/* Header */}
        <div className="p-6 flex justify-center border-b border-gray-50 dark:border-zinc-800/50">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              accent.bgLight
            )}
          >
            <Camera className={accent.primary} size={28} />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 text-center flex flex-col items-center">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-zinc-100 tracking-tight">
            {permissionState === "denied"
              ? "Camera Access Required"
              : "Enable Secure Auth Sync"}
          </h3>

          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-3 leading-relaxed px-4">
            {permissionState === "denied"
              ? "FinWatch needs camera access to synchronise securely. Android has blocked access; you can restore it directly in Settings."
              : "FinWatch Zambia uses camera-based QR verification to instantly synchronise and authorise secure login sessions on your web browser."}
          </p>

          {error && (
            <div className="mt-4 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-2 text-left w-full flex-shrink-0">
              <ShieldAlert
                className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                size={14}
              />
              <p className="text-[11px] text-amber-700 dark:text-amber-450 font-medium leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {showManual && (
            <div className="mt-4 w-full bg-zinc-50 dark:bg-zinc-950/40 border border-gray-150 dark:border-zinc-800/60 rounded-2xl p-4 text-left animate-in slide-in-from-bottom-3 duration-300 flex-shrink-0">
              <h4 className="text-[11px] font-bold text-gray-900 dark:text-zinc-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShieldAlert size={13} className={accent.primary} />
                Manual Enable Guide
              </h4>
              <ol className="text-[10px] text-gray-550 dark:text-zinc-400 space-y-1.5 list-decimal list-inside pl-0.5 leading-relaxed">
                <li>
                  Go to home screen and{" "}
                  <span className="font-bold text-gray-800 dark:text-zinc-300">
                    long-press
                  </span>{" "}
                  FinWatch icon.
                </li>
                <li>
                  Tap on{" "}
                  <span className="font-bold text-gray-800 dark:text-zinc-300">
                    App Info
                  </span>{" "}
                  or the info icon.
                </li>
                <li>
                  Select{" "}
                  <span className="font-bold text-gray-800 dark:text-zinc-300">
                    Permissions
                  </span>
                  , then tap{" "}
                  <span className="font-bold text-gray-800 dark:text-zinc-300">
                    Camera
                  </span>
                  .
                </li>
                <li>
                  Change setting to{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-450">
                    Allow
                  </span>
                  .
                </li>
                <li>
                  Close the application, reopen/relaunch the app, then return to
                  Secure Auth Sync afterward.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50/50 dark:bg-zinc-900/40 flex flex-col gap-2.5 border-t border-gray-100 dark:border-zinc-800/50">
          {permissionState === "denied" ? (
            <button
              onClick={handleOpenSettings}
              className={cn(
                "w-full py-3.5 rounded-xl text-white text-xs uppercase tracking-wider font-bold shadow-md transition-all active:scale-[0.98] hover:opacity-95 bg-gradient-to-r",
                accent.gradient
              )}
            >
              Open App Settings
            </button>
          ) : (
            <button
              onClick={requestPermission}
              className={cn(
                "w-full py-3.5 rounded-xl text-white text-xs uppercase tracking-wider font-bold shadow-md transition-all active:scale-[0.98] hover:opacity-95 bg-gradient-to-r",
                accent.gradient
              )}
            >
              Grant Permission
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-500 dark:text-zinc-400 text-xs font-bold transition-all hover:bg-gray-100 dark:hover:bg-zinc-900"
          >
            Set Up Later
          </button>
        </div>
      </div>
    </div>
  );
}
