"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Loader2,
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Camera,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRegToken } from "@/lib/regulator-auth";
import { cn } from "@/lib/utils";

interface AndroidSettingsPlugin {
  openAppSettings(): Promise<void>;
}

const AndroidSettings = registerPlugin<AndroidSettingsPlugin>("AndroidSettings");

interface QRScannerProps {
  onClose: () => void;
  portalType: "sme" | "institutional";
}

type ScannerStatus =
  | "requesting_permission"
  | "permission_denied"
  | "scanning"
  | "approving"
  | "success"
  | "error";

export default function QRScanner({ onClose, portalType }: QRScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("requesting_permission");
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

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

  const handleOpenSettings = useCallback(async () => {
    try {
      await AndroidSettings.openAppSettings();
      setShowManual(true);
    } catch (err) {
      setError("Unable to launch system settings automatically.");
      setShowManual(true);
    }
  }, []);

  const requestCameraPermission = useCallback(async () => {
    setStatus("requesting_permission");
    setError(null);

    // 1. Local Onboarding Hydration Fast-Path: Skip getUserMedia checks entirely if globally authorized
    const hasSeenOnboarding = localStorage.getItem("hasSeenCameraPermissionOnboarding") === "true";
    if (hasSeenOnboarding) {
      // Short delay to allow modal layout and UI mounting animations to stabilize
      setTimeout(() => {
        setStatus("scanning");
      }, 300);
      return;
    }

    // 2. Proactive Query Check (Avoid getUserMedia stream/hardware toggling if already granted)
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const queryResult = await navigator.permissions.query({ name: "camera" as any });
        if (queryResult.state === "granted") {
          localStorage.setItem("hasSeenCameraPermissionOnboarding", "true");
          setStatus("scanning");
          return;
        } else if (queryResult.state === "denied") {
          setStatus("permission_denied");
          setError("Camera access was denied. You can restore access securely in Settings or try again.");
          return;
        }
      }
    } catch (e) {
      console.warn("Permission query unavailable on this WebView context, falling back to prompt.", e);
    }

    // 3. Negotiate Permission via Standard getUserMedia Call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      
      localStorage.setItem("hasSeenCameraPermissionOnboarding", "true");
      // Delay scanner mount by 1500ms to guarantee Android media server releases hardware lock completely
      setTimeout(() => {
        setStatus("scanning");
      }, 1500);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("permission_denied");
        setError(
          "Camera access was denied. You can restore access securely in Settings or try again."
        );
      } else if (name === "NotFoundError") {
        setStatus("permission_denied");
        setError(
          "No camera was found on this device. A camera is required to scan QR codes."
        );
      } else if (name === "NotReadableError") {
        setStatus("permission_denied");
        setError(
          "Camera is currently in use by another application. Please close other camera apps and try again."
        );
      } else {
        setStatus("permission_denied");
        setError(
          `Camera initialisation failed: ${err?.message || "Unknown error"}. Please check your device settings.`
        );
      }
    }
  }, []);

  useEffect(() => {
    requestCameraPermission();
  }, [requestCameraPermission]);

  const handleApprove = useCallback(async (token: string) => {
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
  }, [portalType, onClose]);

  // Main scanner lifecycle and rear camera auto-prioritisation
  useEffect(() => {
    if (status !== "scanning") return;

    let isMounted = true;
    const scanner = new Html5Qrcode("qr-reader");
    html5QrcodeRef.current = scanner;

    const startScanning = async () => {
      // 1. Enforce a 300ms delay to allow WebView layouts and Android media server hardware to stabilize
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!isMounted) return;

      try {
        const enumeratedCameras = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!enumeratedCameras || enumeratedCameras.length === 0) {
          setStatus("permission_denied");
          setError("No cameras found on your device or access was blocked.");
          return;
        }

        setCameras(enumeratedCameras);

        // Advanced rear camera selection: Prioritise primary sensor over auxiliary lenses (ultra-wide/macro)
        const rearCameras = enumeratedCameras.filter((c) => {
          const l = (c.label || "").toLowerCase();
          return (
            l.includes("back") ||
            l.includes("rear") ||
            l.includes("environment")
          );
        });

        let preferredCamId = enumeratedCameras[0].id;
        if (rearCameras.length > 0) {
          // Priority 1: Search for a rear camera that is NOT an auxiliary/specialized lens
          const mainRear = rearCameras.find((c) => {
            const l = (c.label || "").toLowerCase();
            return (
              !l.includes("wide") &&
              !l.includes("ultra") &&
              !l.includes("macro") &&
              !l.includes("tele")
            );
          });
          // Priority 2: Use the main rear sensor if found, otherwise fall back to the first rear camera
          preferredCamId = mainRear ? mainRear.id : rearCameras[0].id;
        }

        setSelectedCameraId(preferredCamId);

        const onScanSuccess = async (decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            if (
              data.type === "finwatch_login" &&
              data.token &&
              data.portal === portalType
            ) {
              if (html5QrcodeRef.current?.isScanning) {
                await html5QrcodeRef.current.stop();
              }
              handleApprove(data.token);
            } else if (data.portal !== portalType) {
              setError(`Please scan a QR code for the ${portalType} portal.`);
            }
          } catch {
            // Not a valid JSON payload - ignore and continue scanning
          }
        };

        await scanner.start(
          preferredCamId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          undefined
        );
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Scanner startup failed:", err);
        const errMsg = err?.message || "";
        const name = err?.name || "";
        
        if (
          name === "NotAllowedError" || 
          name === "PermissionDeniedError" ||
          errMsg.toLowerCase().includes("permission") ||
          errMsg.toLowerCase().includes("allowed") ||
          errMsg.toLowerCase().includes("denied")
        ) {
          setStatus("permission_denied");
          setError("Camera access was denied. You can restore access securely in Settings or try again.");
        } else {
          setStatus("permission_denied");
          setError(errMsg || "Could not start video source. Camera hardware may be locked.");
        }
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      if (scanner.isScanning) {
        scanner
          .stop()
          .catch((err) => console.error("Cleanup stop error:", err));
      }
    };
  }, [status, portalType, handleApprove]);

  const switchCamera = useCallback(async (cameraId: string) => {
    if (!html5QrcodeRef.current || !html5QrcodeRef.current.isScanning) return;
    try {
      setSelectedCameraId(cameraId);
      await html5QrcodeRef.current.stop();
      
      const onScanSuccess = async (decodedText: string) => {
        try {
          const data = JSON.parse(decodedText);
          if (
            data.type === "finwatch_login" &&
            data.token &&
            data.portal === portalType
          ) {
            if (html5QrcodeRef.current?.isScanning) {
              await html5QrcodeRef.current.stop();
            }
            handleApprove(data.token);
          } else if (data.portal !== portalType) {
            setError(`Please scan a QR code for the ${portalType} portal.`);
          }
        } catch {
          // ignore
        }
      };

      await html5QrcodeRef.current.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        undefined
      );
    } catch (err: any) {
      setError(`Failed to switch camera: ${err?.message || "Unknown error"}`);
    }
  }, [portalType, handleApprove]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center",
                accent.bgLight
              )}
            >
              <QrCode className={accent.primary} size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                Secure Auth Sync
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                Camera-based QR verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Permission Requesting State */}
          {status === "requesting_permission" && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-5",
                  accent.bgLight
                )}
              >
                <Camera
                  className={cn("animate-pulse", accent.primary)}
                  size={28}
                />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                Requesting Camera Access
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 px-6 leading-relaxed">
                Please allow camera access when prompted to enable QR scanning.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Loader2
                  className={cn("animate-spin", accent.primary)}
                  size={14}
                />
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-bold">
                  Awaiting permission
                </span>
              </div>
            </div>
          )}

          {/* Permission Denied State */}
          {status === "permission_denied" && (
            <div className="py-6 flex flex-col items-center justify-center text-center max-h-[75vh] overflow-y-auto pr-1">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center mb-5 flex-shrink-0">
                <ShieldAlert
                  size={28}
                  className="text-amber-600 dark:text-amber-400"
                />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm flex-shrink-0">
                Camera Access Required
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 px-4 leading-relaxed flex-shrink-0">
                {error || "Camera access was denied. You can restore access securely in Settings or try again."}
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5 w-full px-4 justify-center flex-shrink-0">
                {Capacitor.isNativePlatform() && (
                  <button
                    onClick={handleOpenSettings}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-bold text-gray-700 dark:text-zinc-200 border border-gray-250 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-zinc-850 active:scale-95 shadow-sm"
                  >
                    Open Settings
                  </button>
                )}
                <button
                  onClick={requestCameraPermission}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-bold text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-lg bg-gradient-to-r",
                    accent.gradient
                  )}
                >
                  <RefreshCw size={14} />
                  Retry Access
                </button>
              </div>

              {/* Manual guided instructions as robust fallback */}
              {showManual && (
                <div className="mt-5 w-full bg-zinc-50 dark:bg-zinc-950/40 border border-gray-150 dark:border-zinc-805 rounded-2xl p-4 text-left animate-in slide-in-from-bottom-3 duration-300 flex-shrink-0">
                  <h4 className="text-[11px] font-bold text-gray-900 dark:text-zinc-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <ShieldAlert size={13} className={accent.primary} />
                    Manual Enable Guide
                  </h4>
                  <ol className="text-[10px] text-gray-550 dark:text-zinc-400 space-y-1.5 list-decimal list-inside pl-0.5 leading-relaxed">
                    <li>Go to home screen and <span className="font-bold text-gray-800 dark:text-zinc-300">long-press</span> FinWatch icon.</li>
                    <li>Tap on <span className="font-bold text-gray-800 dark:text-zinc-300">App Info</span> or the info icon.</li>
                    <li>Select <span className="font-bold text-gray-800 dark:text-zinc-300">Permissions</span>, then tap <span className="font-bold text-gray-800 dark:text-zinc-300">Camera</span>.</li>
                    <li>Change setting to <span className="font-bold text-emerald-600 dark:text-emerald-450">Allow</span>.</li>
                    <li>Close the application, reopen/relaunch the app, then return to Secure Auth Sync afterward.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Scanning State */}
          {status === "scanning" && (
            <div className="space-y-4">
              <div
                id="qr-reader"
                className={cn(
                  "w-full rounded-2xl overflow-hidden border-2",
                  "border-gray-100 dark:border-zinc-800"
                )}
              />
              
              {/* Premium Glassmorphic Custom Camera Selector */}
              {cameras.length > 1 && (
                <div className="flex flex-col gap-1.5 px-1 animate-in fade-in duration-200 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    Select Device Camera
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCameraId || ""}
                      onChange={(e) => switchCamera(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800/40 border border-gray-150 dark:border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-gray-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-emerald-500/20 appearance-none font-medium cursor-pointer transition-all pr-8"
                    >
                      {cameras.map((cam) => (
                        <option key={cam.id} value={cam.id} className="dark:bg-zinc-900">
                          {cam.label || `Camera ${cam.id.slice(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approving State */}
          {status === "approving" && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-5",
                  accent.bgLight
                )}
              >
                <Loader2
                  className={cn("animate-spin", accent.primary)}
                  size={28}
                />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                Approving Login
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 px-8 leading-relaxed">
                Synchronizing your session with the web browser.
              </p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-5">
                <CheckCircle2
                  size={32}
                  className="text-emerald-500 dark:text-emerald-400"
                />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-lg">
                Login Approved!
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
                Your web browser will refresh instantly.
              </p>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                Sync Failed
              </p>
              <p className="text-xs text-red-500 mt-2 px-6 bg-red-50 dark:bg-red-900/10 py-2.5 rounded-xl border border-red-100 dark:border-red-900/30 leading-relaxed">
                {error}
              </p>
              <button
                onClick={() => setStatus("scanning")}
                className={cn(
                  "mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-lg bg-gradient-to-r",
                  accent.gradient
                )}
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "scanning" && (
          <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 text-center border-t border-gray-100 dark:border-zinc-800">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1">
              Instruction
            </p>
            <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
              Point your camera at the QR code displayed on the FinWatch login
              page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
