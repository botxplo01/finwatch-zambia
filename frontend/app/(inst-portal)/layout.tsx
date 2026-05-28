"use client";

/**
 * FinWatch Zambia - Regulator Layout
 * Updated: 2026-05-15 03:20
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sun,
  Moon,
  Info,
  Activity,
  ChevronRight,
  QrCode,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatProfessionalName } from "@/lib/utils";
import {
  getRegToken,
  getRegUser,
  getRegAuthHeader,
  restoreRegSessionFromNative,
} from "@/lib/regulator-auth";
import { RegulatorSidebar } from "@/components/regulator/RegulatorSidebar";
import { RegulatorMobileNav } from "@/components/regulator/RegulatorMobileNav";
import { RegulatorChatModal } from "@/components/regulator/RegulatorChatModal";
import { SystemInfoOverlay } from "@/components/shared/SystemInfoOverlay";
import { FloatingChatButton } from "@/components/shared/FloatingChatButton";
import { GlossaryButton } from "@/components/shared/GlossaryButton";
import { TutorialOverlay } from "@/components/shared/TutorialOverlay";
import { WelcomeModal } from "@/components/shared/WelcomeModal";
import { AtmosphericBackground } from "@/components/shared/AtmosphericBackground";
import QRScanner from "@/components/shared/QRScanner";
import {
  useTutorial,
  getRegTutorialConfig,
  getAnalystTutorialConfig,
} from "@/context/TutorialContext";
import api from "@/lib/api";
import { Capacitor } from "@capacitor/core";

interface RegUser {
  id: number;
  full_name: string;
  title?: string | null;
  email: string;
  role: string;
  portal_type: string;
}

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/institutional": ["Home"],
  "/institutional/trends": ["Home", "Sector Trends"],
  "/institutional/insights": ["Home", "Data Insights"],
  "/institutional/anomalies": ["Home", "Anomaly Detection"],
  "/institutional/reports": ["Home", "Reports"],
  "/institutional/settings": ["Home", "Settings"],
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Root layout for the regulator portal.
 */
export default function RegulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, currentStepIndex, config, startTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [userRole, setUserRole] = useState("policy_analyst");
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState<number | null>(10);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const handleUsageUpdate = (e: any) => {
      if (e.detail?.count !== undefined) {
        setAiUsageCount(Math.max(0, 10 - e.detail.count));
      }
    };
    window.addEventListener("ai-usage-update", handleUsageUpdate);
    return () =>
      window.removeEventListener("ai-usage-update", handleUsageUpdate);
  }, []);

  // Fetch AI usage status for the floating badge
  const fetchAIStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/regulator/chat/status", {
        headers: getRegAuthHeader(),
      });
      const { is_blocked, current_count } = res.data;
      setAiUsageCount(is_blocked ? 0 : Math.max(0, 10 - (current_count ?? 0)));
    } catch (err) {
      console.error("Failed to fetch regulator AI status:", err);
    }
  }, []);

  useEffect(() => {
    if (ready) {
      fetchAIStatus();
      // Refresh every 30 seconds to keep badge sync
      const interval = setInterval(fetchAIStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [ready, fetchAIStatus]);

  // Nested TopBar to ensure scope
  function RegulatorTopBar({
    onOpenInfo,
    role,
  }: {
    onOpenInfo: () => void;
    role: string;
  }) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<RegUser | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();
    const crumbs = BREADCRUMB_MAP[pathname] ?? ["Home"];

    useEffect(() => {
      setMounted(true);
      const u = getRegUser<RegUser>();
      if (u) setUser(u);
    }, []);

    useEffect(() => {
      const handleScroll = () => {
        const scrollArea = document.getElementById("main-scroll-area-reg");
        const scrollY = scrollArea?.scrollTop || 0;
        setScrolled(scrollY > 5);
      };
      const scrollArea = document.getElementById("main-scroll-area-reg");
      scrollArea?.addEventListener("scroll", handleScroll);
      return () => scrollArea?.removeEventListener("scroll", handleScroll);
    }, []);

    const isAnalyst = role === "policy_analyst";
    const accentText = isAnalyst
      ? "text-blue-600 dark:text-blue-400 font-bold"
      : "text-emerald-600 dark:text-emerald-400 font-bold";
    const accentIcon = isAnalyst
      ? "text-blue-600 dark:text-blue-400"
      : "text-emerald-600 dark:text-emerald-400";

    return (
      <header
        className={cn(
          "h-16 flex items-center justify-between px-4 md:px-6 z-30 transition-all duration-500 absolute top-0 left-0 right-0",
          scrolled
            ? "bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-xl border-b border-white/10 dark:border-white/5 shadow-sm"
            : "bg-transparent border-b border-transparent"
        )}
      >
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
                <span className={cn(i === crumbs.length - 1 ? accentText : "")}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
            {getGreeting()}
            {user
              ? `, ${formatProfessionalName(user.full_name, user.title)}`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 px-1.5 py-1 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full shadow-sm">
            {/* QR Sync Button (Mobile Only) */}
            {Capacitor.isNativePlatform() && (
              <button
                onClick={() => setIsScannerOpen(true)}
                aria-label="Sync to Web"
                className={cn(
                  "p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors",
                  accentIcon
                )}
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
              onClick={onOpenInfo}
              aria-label="System Information"
              className="p-1.5 rounded-full text-gray-500 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
            >
              <Info size={15} />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Sync mobile menu with tutorial steps
  useEffect(() => {
    if (
      isActive &&
      (config?.portal === "regulator" || config?.portal === "analyst")
    ) {
      const targetId = config.steps[currentStepIndex].targetId;
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        if (config.portal === "analyst") {
          // Analyst: Settings and Docs (if using flyout)
          setFlyoutOpen(
            targetId === "nav-user-profile" || targetId === "nav-docs"
          );
        } else {
          // Regulator: Reports, Docs and Settings are in flyout
          setFlyoutOpen(
            targetId === "nav-reports" ||
              targetId === "nav-docs" ||
              targetId === "nav-user-profile"
          );
        }
      } else {
        setFlyoutOpen(false);
      }
    } else if (!isActive) {
      setFlyoutOpen(false);
    }
  }, [isActive, currentStepIndex, config]);

  // 1. Session Readiness & Auth Check (Persistence-Aware)
  useEffect(() => {
    const checkAuth = async () => {
      // 1. Give Capacitor a tiny moment to stabilize bridge
      if (Capacitor.isNativePlatform()) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // 2. Dual-Layer Restoration
      const token = await restoreRegSessionFromNative();
      const user = getRegUser<RegUser>();

      if (!token || !user) {
        router.replace("/institutional/auth/login");
        return;
      }

      if (user.portal_type !== "institutional") {
        router.replace("/unauthorized");
        return;
      }

      if (user.role) setUserRole(user.role);
      setReady(true);
    };

    checkAuth();
  }, [router]);

  const onboardingTriggered = useRef(false);

  // 2. Onboarding & Tutorial Logic
  useEffect(() => {
    if (!ready || isActive || onboardingTriggered.current) return;

    const user = getRegUser<RegUser>();
    if (!user) return;
    const userId = user.id || user.email;

    const isFirstTime =
      localStorage.getItem("isFirstTimeRegistration") === "true";
    const hasSeenWelcome =
      localStorage.getItem(`hasSeenWelcomeModal_${userId}`) === "true";

    // A. Welcome Modal: For NEW users
    if (isFirstTime && !hasSeenWelcome) {
      onboardingTriggered.current = true;
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ready, isActive]);

  const handleStartTutorial = () => {
    const user = getRegUser<RegUser>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");

    // Determine platform-specific tutorial order
    const isMobile = window.innerWidth < 768;
    if (userRole === "policy_analyst") {
      startTutorial(getAnalystTutorialConfig(isMobile));
    } else {
      startTutorial(getRegTutorialConfig(isMobile));
    }
  };

  const handleSkipTutorial = () => {
    const user = getRegUser<RegUser>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
  };

  const handleCloseWelcome = () => {
    const user = getRegUser<RegUser>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }
    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020d0a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-gray-400 font-medium">
            Initialising portal…
          </p>
        </div>
      </div>
    );
  }

  const isMainDashboard = pathname === "/institutional";

  return (
    <div className="relative h-screen w-full bg-transparent overflow-hidden">
      <AtmosphericBackground
        portal={userRole === "policy_analyst" ? "analyst" : "regulator"}
        isDashboard={isMainDashboard && !showWelcomeModal}
      />

      <div className="flex h-full w-full bg-transparent">
        <RegulatorSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          userRole={userRole}
        />

        <div className="flex-1 w-full flex flex-col min-w-0 overflow-hidden relative">
          <RegulatorTopBar
            onOpenInfo={() => setInfoOpen(true)}
            role={userRole}
          />
          <main
            id="main-scroll-area-reg"
            className="flex-1 overflow-y-auto pt-16 pb-20 md:pb-6"
          >
            {children}
          </main>

          <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
            <div
              className={cn(
                "backdrop-blur-md px-6 py-2 rounded-full border shadow-sm pointer-events-auto transition-all duration-300",
                "bg-white/40 border-gray-100", // Light mode
                userRole === "policy_analyst"
                  ? "dark:bg-[#050b1a]/40 dark:border-blue-900/20"
                  : "dark:bg-[#020d0a]/40 dark:border-emerald-900/20" // Dark mode
              )}
            >
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
                FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
              </p>
            </div>
          </footer>

          <FloatingChatButton
            id="ai-assistant-fab"
            onClick={() => setChatOpen(!chatOpen)}
            variant={userRole === "policy_analyst" ? "blue" : "emerald"}
            isPaused={chatOpen}
            showTooltip={showChatTooltip}
            onCloseTooltip={() => setShowChatTooltip(false)}
            messageCount={aiUsageCount}
          />
        </div>
      </div>

      <RegulatorMobileNav
        mobileOpen={flyoutOpen}
        onMenuToggle={() => setFlyoutOpen((o) => !o)}
        onMenuClose={() => setFlyoutOpen(false)}
        userRole={userRole}
        onOpenChat={() => setChatOpen(true)}
      />

      <RegulatorChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        userRole={userRole}
      />

      <GlossaryButton
        id="glossary-fab"
        variant={userRole === "policy_analyst" ? "blue" : "emerald"}
      />

      <SystemInfoOverlay
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        type={userRole === "policy_analyst" ? "analyst" : "regulator"}
      />

      <TutorialOverlay />

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        onStartTutorial={handleStartTutorial}
        onSkipTutorial={handleSkipTutorial}
        portalType={userRole === "policy_analyst" ? "analyst" : "regulator"}
      />

      {isScannerOpen && (
        <QRScanner
          portalType="institutional"
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
