"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Monitor,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface QRLoginProps {
  portalType: "sme" | "institutional";
  onSuccess: (token: string) => void;
  accentColor?: "purple" | "emerald" | "blue";
}

/**
 * FinWatch Zambia - Neomorphic QR Login Card
 * Enhanced with a vibrant outer brand glow and subtle tactile shadows.
 * Fully responsive and supports Light/Dark mode.
 */
export default function QRLogin({
  portalType,
  onSuccess,
  accentColor = "purple",
}: QRLoginProps) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "approved" | "expired" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);

  const initiateQR = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await api.post(
        `/api/auth/qr/initiate?portal_type=${portalType}`
      );
      setToken(res.data.token);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError("Failed to generate QR code.");
    }
  };

  useEffect(() => {
    initiateQR();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/auth/qr/status/${token}`);
        if (res.data.status === "approved" && res.data.access_token) {
          clearInterval(interval);
          setStatus("approved");
          onSuccess(res.data.access_token);
        } else if (res.data.status === "expired") {
          clearInterval(interval);
          setStatus("expired");
        }
      } catch (err) {
        console.error("QR status poll failed:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, token]);

  // Accent Colors for Vibrant Glow
  const glowColors = {
    purple: "rgba(139, 92, 246, 0.35)",
    emerald: "rgba(16, 185, 129, 0.35)",
    blue: "rgba(59, 130, 246, 0.35)",
  };

  // Neomorphic style tokens with refined shadows AND vibrant outer glow
  const neomorphicMain = `bg-[#f0f0f3] dark:bg-zinc-900 shadow-[10px_10px_20px_#d1d1d6,-10px_-10px_20px_#ffffff,0_0_40px_${glowColors[accentColor]}] dark:shadow-[8px_8px_16px_#050505,-8px_-8px_16px_#1a1a1f,0_0_50px_${glowColors[accentColor]}]`;
  const neomorphicInset =
    "bg-[#f0f0f3] dark:bg-zinc-950 shadow-[inset_4px_4px_8px_#d1d1d6,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#000000,inset_-4px_-4px_8px_#18181b]";
  const neomorphicButton =
    "bg-[#f0f0f3] dark:bg-zinc-900 shadow-[3px_3px_6px_#bebebe,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#09090b,-3px_-3px_6px_#1c1c21] active:shadow-[inset_2px_2px_4px_#bebebe,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#000000,inset_-2px_-2px_4px_#18181b]";

  const accentText = {
    purple: "text-purple-600 dark:text-purple-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
  };

  const accentTag = {
    purple:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    emerald:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-[40px] w-full max-w-[340px] mx-auto transition-all duration-700",
        neomorphicMain,
        "animate-in fade-in zoom-in-95"
      )}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm",
            accentTag[accentColor]
          )}
        >
          <ShieldCheck size={10} />
          <span>Identity Verification</span>
        </div>
        <h3 className="text-xl font-extrabold text-gray-800 dark:text-zinc-100 tracking-tight">
          Scan to Login
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-2 leading-relaxed px-4">
          Securely synchronize your session with your mobile device.
        </p>
      </div>

      {/* QR Housing */}
      <div
        className={cn(
          "relative w-56 h-56 flex items-center justify-center rounded-[32px] p-6 transition-all duration-300",
          neomorphicInset
        )}
      >
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2
              className={cn("animate-spin", accentText[accentColor])}
              size={32}
            />
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
              Generating
            </span>
          </div>
        )}

        {status === "ready" && token && (
          <div className="p-2 bg-white rounded-2xl shadow-sm animate-in fade-in duration-500">
            <QRCodeSVG
              value={JSON.stringify({
                type: "finwatch_login",
                token,
                portal: portalType,
              })}
              size={160}
              level="H"
              includeMargin={false}
              fgColor="currentColor"
              className="text-zinc-900"
            />
          </div>
        )}

        {(status === "expired" || status === "error") && (
          <div className="flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4 shadow-inner border border-red-100 dark:border-red-900/30">
              <RefreshCw size={24} className="text-red-500/50" />
            </div>
            <p className="text-xs font-bold text-gray-600 dark:text-zinc-400 mb-4">
              {status === "expired" ? "Session Expired" : "Sync Timeout"}
            </p>
            <button
              onClick={initiateQR}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                neomorphicButton,
                "text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white"
              )}
            >
              Refresh Code
            </button>
          </div>
        )}

        {status === "approved" && (
          <div className="absolute inset-0 bg-emerald-500/90 backdrop-blur-sm rounded-[32px] flex flex-col items-center justify-center text-white animate-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4 shadow-xl">
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.3em]">
              Approved
            </p>
          </div>
        )}
      </div>

      {/* Device Info / Footer */}
      <div className="mt-10 flex flex-col items-center w-full">
        <div className="flex items-center justify-between w-full px-6 opacity-40">
          <Smartphone size={16} className="text-gray-400 dark:text-zinc-600" />
          <div className="flex-1 mx-4 h-px border-t-2 border-dotted border-gray-300 dark:border-zinc-800" />
          <Monitor size={16} className="text-gray-400 dark:text-zinc-600" />
        </div>

        <div className="mt-6 flex items-center gap-2 text-gray-400 dark:text-zinc-700">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-widest">
            End-to-End Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
