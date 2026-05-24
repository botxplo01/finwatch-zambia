"use client";

/**
 * FinWatch Zambia - Regulator Layout
 * Updated: 2026-05-15 03:20
 */

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon, Info, Activity, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatProfessionalName } from "@/lib/utils";
import {
  getRegToken,
  getRegUser,
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
}

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/regulator": ["Home"],
  "/regulator/trends": ["Home", "Sector Trends"],
  "/regulator/insights": ["Home", "Data Insights"],
  "/regulator/anomalies": ["Home", "Anomaly Detection"],
  "/regulator/reports": ["Home", "Reports"],
  "/regulator/settings": ["Home", "Settings"],
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
        const scrollY =
          document.getElementById("main-scroll-area-reg")?.scrollTop || 0;
        setScrolled(scrollY > 10);
      };
      const scrollArea = document.getElementById("main-scroll-area-reg");
      scrollArea?.addEventListener("scroll", handleScroll);
      return () => scrollArea?.removeEventListener("scroll", handleScroll);
    }, []);

    const isAnalyst = role === "policy_analyst";
    const accentText = isAnalyst
      ? "text-blue-600 dark:text-blue-400 font-bold"
      : "text-emerald-600 dark:text-emerald-400 font-bold";

    return (
      <header
        className={cn(
          "h-16 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 transition-all duration-300",
          scrolled
            ? "bg-white/60 dark:bg-black/60 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm"
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
        await restoreRegSessionFromNative();
      }

      let token = getRegToken();
      let user = getRegUser<RegUser>();

      if (!token || !user) {
        router.replace("/regulator/auth/login");
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
    const sessionSeen =
      sessionStorage.getItem("hasSeenAITooltipThisSession") === "true";

    // A. Welcome Modal: For NEW users
    if (isFirstTime && !hasSeenWelcome) {
      onboardingTriggered.current = true;
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 3500); // Increased slightly for better native transition
      return () => clearTimeout(timer);
    }

    // B. AI Tooltip: For EXISTING users
    if (!isFirstTime && !sessionSeen) {
      onboardingTriggered.current = true;
      const timer = setTimeout(() => {
        setShowChatTooltip(true);
        sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
        // Auto-hide tooltip after 10s
        setTimeout(() => setShowChatTooltip(false), 10000);
      }, 3000);
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
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true"); // Prevent tooltip in this session

    // Determine platform-specific tutorial order
    const isMobile = window.innerWidth < 768;

    if (user?.role === "policy_analyst") {
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
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true"); // Prevent tooltip in this session

    // Note: AI Tooltip is not shown here for new users.
    // It will appear on their next login session as an 'existing user'.
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
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true"); // Prevent tooltip in this session
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black relative overflow-hidden">
        <AtmosphericBackground
          portal={userRole === "policy_analyst" ? "analyst" : "regulator"}
        />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div
            className={cn(
              "w-8 h-8 rounded-full border-2 border-t-transparent animate-spin",
              userRole === "policy_analyst"
                ? "border-blue-600"
                : "border-emerald-500"
            )}
          />
          <p className="text-sm text-gray-400 font-medium">
            Initialising portal…
          </p>
        </div>
      </div>
    );
  }

  const isMainDashboard = pathname === "/regulator";

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
            className="flex-1 overflow-y-auto pb-20 md:pb-6"
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
            onClick={() => setChatOpen(true)}
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
        variant={userRole === "policy_analyst" ? "blue" : "emerald"}
        isSidebarCollapsed={collapsed}
      />

      <TutorialOverlay />
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        onStartTutorial={handleStartTutorial}
        onSkipTutorial={handleSkipTutorial}
        portalType={userRole === "policy_analyst" ? "analyst" : "regulator"}
      />

      <SystemInfoOverlay
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        type={userRole === "policy_analyst" ? "analyst" : "regulator"}
      />
    </div>
  );
}
