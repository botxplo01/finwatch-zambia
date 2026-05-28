"use client";

import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Loader2, X, QrCode, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRegToken } from "@/lib/regulator-auth";

interface QRScannerProps {
  onClose: () => void;
  portalType: "sme" | "institutional";
}

export default function QRScanner({ onClose, portalType }: QRScannerProps) {
  const [status, setStatus] = useState<
    "idle" | "scanning" | "approving" | "success" | "error"
  >("scanning");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = async (decodedText: string) => {
      try {
        const data = JSON.parse(decodedText);
        if (
          data.type === "finwatch_login" &&
          data.token &&
          data.portal === portalType
        ) {
          scanner.clear();
          handleApprove(data.token);
        } else if (data.portal !== portalType) {
          setError(`Please scan a QR code for the ${portalType} portal.`);
        }
      } catch (err) {
        // Not a valid FinWatch JSON, ignore and keep scanning
      }
    };

    scanner.render(onScanSuccess, undefined);

    return () => {
      scanner
        .clear()
        .catch((err) => console.error("Scanner clear failed:", err));
    };
  }, []);

  const handleApprove = async (token: string) => {
    setStatus("approving");
    setError(null);
    try {
      const authToken = portalType === "sme" ? getToken() : getRegToken();
      await api.post(
        "/api/auth/qr/approve",
        { token },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setStatus("success");
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setStatus("error");
      setError(err?.response?.data?.detail || "Approval failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <QrCode
              className={
                portalType === "sme" ? "text-purple-600" : "text-emerald-600"
              }
              size={20}
            />
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-widest text-xs">
              Secure Auth Sync
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {status === "scanning" && (
            <div
              id="qr-reader"
              className="w-full rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-zinc-800"
            />
          )}

          {status === "approving" && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="animate-spin text-primary mb-4" size={48} />
              <p className="font-bold text-gray-900 dark:text-zinc-100">
                Approving Login...
              </p>
              <p className="text-xs text-gray-500 mt-1 px-8">
                Synchronizing your session with the web browser.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
              <CheckCircle2 className="text-emerald-500 mb-4" size={64} />
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-lg">
                Login Approved!
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Your web browser will refresh instantly.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <AlertCircle className="text-red-500 mb-4" size={48} />
              <p className="font-bold text-gray-900 dark:text-zinc-100">
                Sync Failed
              </p>
              <p className="text-xs text-red-500 mt-2 px-8 bg-red-50 dark:bg-red-900/10 py-2 rounded-xl border border-red-100 dark:border-red-900/30">
                {error}
              </p>
              <Button
                onClick={() => setStatus("scanning")}
                variant="outline"
                className="mt-6 rounded-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {status === "scanning" && (
          <div className="p-6 bg-gray-50 dark:bg-zinc-800/50 text-center">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">
              Instruction
            </p>
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              Point your camera at the QR code displayed on the FinWatch login
              page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
