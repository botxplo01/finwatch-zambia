"use client";

/**
 * FinWatch Zambia - Dashboard Top Bar
 * Updated: 2026-05-25 05:30
 */

import { useState, useEffect } from "react";
import {
  Info,
  MessageSquare,
  ChevronRight,
  Sun,
  Moon,
  QrCode,
  PanelLeft,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { SystemInfoOverlay } from "../shared/SystemInfoOverlay";
import QRScanner from "../shared/QRScanner";
import PermissionOnboarding from "../shared/PermissionOnboarding";
import {
  cn,
  formatProfessionalName,
  getCameraPermissionState,
} from "@/lib/utils";
import { Capacitor } from "@capacitor/core";

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/sme": ["Home"],
  "/sme/companies": ["Home", "Companies"],
  "/sme/predict": ["Home", "Predict"],
  "/sme/history": ["Home", "History"],
  "/sme/reports": ["Home", "Reports"],
  "/sme/settings": ["Home", "Settings"],
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userTitle, setUserTitle] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const crumbs = BREADCRUMB_MAP[pathname] ?? ["Home"];
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserName(parsed.full_name ?? "");
        setUserTitle(parsed.title ?? null);
      }
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollArea = document.getElementById("main-scroll-area");
      const scrollY = scrollArea?.scrollTop || 0;
      setScrolled(scrollY > 5);
    };
    const scrollArea = document.getElementById("main-scroll-area");
    scrollArea?.addEventListener("scroll", handleScroll);
    return () => scrollArea?.removeEventListener("scroll", handleScroll);
  }, []);

  const handleQRClick = async () => {
    // On native platforms, navigator.permissions.query is unreliable in
    // Android WebView (often returns "prompt" even when granted). The
    // QRScanner component has its own robust getUserMedia permission
    // negotiation, so bypass the onboarding modal entirely on native.
    if (Capacitor.isNativePlatform()) {
      setIsScannerOpen(true);
      return;
    }
    const state = await getCameraPermissionState();
    if (state === "granted") {
      setIsScannerOpen(true);
    } else {
      setIsPermissionModalOpen(true);
    }
  };

  return (
    <>
      <header
        className={cn(
          "h-16 flex items-center justify-between px-4 md:px-6 z-30 transition-all duration-500 absolute top-0 left-0 right-0",
          scrolled
            ? "bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-xl border-b border-gray-100/50 dark:border-zinc-800/50 shadow-sm"
            : "bg-transparent border-b border-transparent"
        )}
      >
        {/* Left - breadcrumb + greeting */}
        <div className="flex items-center flex-1 min-w-0">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="md:hidden mr-3 p-2 rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-colors flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 mb-0.5">
              {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight
                      size={10}
                      className="text-gray-300 dark:text-zinc-600"
                    />
                  )}
                  <span
                    className={
                      i === crumbs.length - 1
                        ? "text-purple-600 dark:text-purple-400 font-bold"
                        : ""
                    }
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
              {getGreeting()}
              {userName ? `, ${formatProfessionalName(userName, userTitle)}` : ""}
            </p>
          </div>
        </div>

        {/* Right - actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 px-1.5 py-1 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full shadow-sm">
            {/* QR Sync Button (Mobile Only) */}
            {Capacitor.isNativePlatform() && (
              <button
                onClick={handleQRClick}
                aria-label="Sync to Web"
                className="p-1.5 rounded-full text-purple-600 dark:text-purple-400 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
              >
                <QrCode size={15} />
              </button>
            )}

            {Capacitor.isNativePlatform() && (
              <div className="w-[1px] h-3 bg-gray-200 dark:bg-zinc-800 mx-0.5" />
            )}

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="p-1.5 rounded-full text-gray-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}

            <div className="w-[1px] h-3 bg-gray-200 dark:bg-zinc-800 mx-0.5" />

            {/* System Info */}
            <button
              id="info-trigger"
              onClick={() => setInfoOpen(true)}
              aria-label="System Information"
              className="p-1.5 rounded-full text-gray-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
            >
              <Info size={15} />
            </button>
          </div>
        </div>
      </header>

      <SystemInfoOverlay
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        type="sme"
      />

      <PermissionOnboarding
        portalType="sme"
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onGranted={() => {
          setIsPermissionModalOpen(false);
          setIsScannerOpen(true);
        }}
      />

      {isScannerOpen && (
        <QRScanner portalType="sme" onClose={() => setIsScannerOpen(false)} />
      )}
    </>
  );
}
