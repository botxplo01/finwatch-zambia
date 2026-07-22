"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  Monitor,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface QRLoginProps {
  portalType: "sme" | "institutional";
  onSuccess: (token: string) => void;
  accentColor?: "purple" | "emerald" | "blue" | "institutional";
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

  const initiateQR = useCallback(async () => {
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
  }, [portalType]);

  useEffect(() => {
    initiateQR();
  }, [initiateQR]);

  useEffect(() => {
    if (status !== "ready" || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/auth/qr/status/${token}`);
        const { status: currentStatus, access_token } = res.data;

        if (
          (currentStatus === "approved" || currentStatus === "consumed") &&
          access_token
        ) {
          clearInterval(interval);
          setStatus("approved");
          onSuccess(access_token);
        } else if (currentStatus === "expired") {
          clearInterval(interval);
          setStatus("expired");
        }
      } catch (err) {
        console.error("QR status poll failed:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, token, onSuccess]);

  // Neomorphic style tokens with refined shadows AND vibrant outer glow
  const neomorphicInset =
    "bg-[#f0f0f3] dark:bg-zinc-950 shadow-[inset_4px_4px_8px_#d1d1d6,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#000000,inset_-4px_-4px_8px_#18181b]";
  const neomorphicButton =
    "bg-[#f0f0f3] dark:bg-zinc-900 shadow-[3px_3px_6px_#bebebe,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#09090b,-3px_-3px_6px_#1c1c21] active:shadow-[inset_2px_2px_4px_#bebebe,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#000000,inset_-2px_-2px_4px_#18181b]";

  const accentText = {
    purple: "text-purple-600 dark:text-purple-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    institutional: "text-[#60738f] dark:text-[#9fb3cc]",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center pt-0 px-8 pb-8 rounded-[40px] w-full max-w-[340px] mx-auto transition-all duration-700",
        "animate-in fade-in zoom-in-95"
      )}
    >
      <div className="mb-4 text-center px-4">
        <p className="text-[12px] text-gray-600 dark:text-zinc-400 leading-relaxed font-medium">
          <span className="font-bold text-gray-900 dark:text-zinc-100">
            Use the FinWatch app
          </span>{" "}
          QR scanner on your mobile device to sync your session
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
