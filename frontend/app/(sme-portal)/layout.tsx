"use client";

/**
 * FinWatch Zambia - SME Dashboard Layout
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTutorial, getSmeTutorialConfig } from "@/context/TutorialContext";
import {
  getToken,
  getUser,
  restoreSessionFromNative,
  clearToken,
} from "@/lib/auth";
import { isTokenExpired } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent } from "@/components/sme/Sidebar";
import { TopBar } from "@/components/sme/TopBar";
import { GlossaryButton } from "@/components/shared/GlossaryButton";
import { FloatingChatButton } from "@/components/shared/FloatingChatButton";
import { TutorialOverlay } from "@/components/shared/TutorialOverlay";
import { WelcomeModal } from "@/components/shared/WelcomeModal";
import { AtmosphericBackground } from "@/components/shared/AtmosphericBackground";
import { Capacitor } from "@capacitor/core";
import api from "@/lib/api";
import { NLPChatModal } from "@/components/sme/NLPChatModal";

interface UserResponse {
  id: number;
  full_name: string;
  email: string;
  role: string;
  portal_type: string;
  onboarding_complete: boolean;
  business_scale?: "small_scale" | "medium_scale";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMainDashboard = pathname === "/sme";
  const isOnboarding = pathname === "/sme/onboarding";
  const { isActive, currentStepIndex, config, startTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserResponse | null>(null);
  const [aiUsageCount, setAiUsageCount] = useState<number | null>(null);

  useEffect(() => {
    const handleLoadConversation = (e: any) => {
      const { conversationId, portalType } = e.detail || {};
      if (portalType === "sme" && conversationId) {
        setActiveConversationId(conversationId);
        setChatOpen(true);
      }
    };
    window.addEventListener("load-conversation", handleLoadConversation);
    return () =>
      window.removeEventListener("load-conversation", handleLoadConversation);
  }, []);

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
      const res = await api.get("/api/chat/status");
      const { is_blocked, current_count } = res.data;
      setAiUsageCount(is_blocked ? 0 : Math.max(0, 10 - (current_count ?? 0)));
    } catch (err) {
      console.error("Failed to fetch AI status:", err);
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

  // Heartbeat check to validate session and propagate user changes
  const runHeartbeat = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/me");
      const updatedUser = res.data;
      if (updatedUser) {
        const currentCached = localStorage.getItem("user");
        if (currentCached !== JSON.stringify(updatedUser)) {
          localStorage.setItem("user", JSON.stringify(updatedUser));
          window.dispatchEvent(new Event("profile-updated"));
        }
      }
    } catch (err) {
      console.warn("Heartbeat check failed:", err);
    }
  }, []);

  useEffect(() => {
    if (ready) {
      runHeartbeat();
      const interval = setInterval(runHeartbeat, 30000);
      return () => clearInterval(interval);
    }
  }, [ready, runHeartbeat]);

  // Load user profile for scale-aware components
  useEffect(() => {
    const u = getUser<UserResponse>();
    if (u) setUserProfile(u);

    const handleProfileUpdate = () => {
      const updated = getUser<UserResponse>();
      if (updated) setUserProfile(updated);
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    return () =>
      window.removeEventListener("profile-updated", handleProfileUpdate);
  }, []);

  // Sync mobile menu and desktop sidebar expansion with tutorial steps
  useEffect(() => {
    if (isActive && config?.portal === "sme") {
      const targetId = config.steps[currentStepIndex].targetId;
      const isSidebarItem = targetId.startsWith("nav-");
      
      if (window.innerWidth < 768) {
        if (isSidebarItem) {
          setMobileOpen(true);
        } else {
          setMobileOpen(false);
        }
      } else {
        if (isSidebarItem) {
          setCollapsed(false);
        }
      }
    } else if (!isActive) {
      setMobileOpen(false);
    }
  }, [isActive, currentStepIndex, config]);

  // 1. Session Readiness & Auth Check (Persistence-Aware)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Give Capacitor a tiny moment to stabilize bridge if needed
        if (Capacitor.isNativePlatform()) {
          /* Allow native platforms (Capacitor bridge) a brief window to initialize system-level keystores before requesting session restoration. */
          await new Promise((resolve) => setTimeout(resolve, 300));
          await restoreSessionFromNative();
        }

        const token = getToken();
        const user = getUser<UserResponse>();

        if (!token || !user) {
          router.replace("/sme/auth/login");
          return;
        }

        if (isTokenExpired(token)) {
          /* Enforce token validity verification to block requests with expired JWTs before rendering secure page contents. */
          await clearToken();
          router.replace("/sme/auth/login");
          return;
        }

        if (user.portal_type !== "sme") {
          router.replace("/unauthorized");
          return;
        }

        if (user.role === "sme_owner" && !user.onboarding_complete) {
          if (pathname !== "/sme/onboarding") {
            router.replace("/sme/onboarding");
            return;
          }
        }

        setReady(true);
      } catch (err) {
        console.error("Critical error in SME Portal auth validation:", err);
        await clearToken();
        router.replace("/sme/auth/login");
      }
    };

    checkAuth();
  }, [router, pathname]);

  const onboardingTriggered = useRef(false);

  // 2. Onboarding & Tutorial Logic
  useEffect(() => {
    if (!ready || isActive || onboardingTriggered.current) return;

    const user = getUser<UserResponse>();
    if (!user) return;
    const userId = user.id || user.email;

    const isFirstTime =
      localStorage.getItem("isFirstTimeRegistration") === "true";
    const justFinishedOnboarding =
      sessionStorage.getItem("justFinishedOnboarding") === "true";
    const hasSeenWelcome =
      localStorage.getItem(`hasSeenWelcomeModal_${userId}`) === "true";
    const sessionSeen =
      sessionStorage.getItem("hasSeenAITooltipThisSession") === "true";

    // A. Welcome Modal: Show to anyone who hasn't seen it yet
    if (!hasSeenWelcome) {
      onboardingTriggered.current = true;
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1500); // Faster reveal after onboarding redirect
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
  }, [ready, isActive, isOnboarding]);

  const handleStartTutorial = () => {
    const user = getUser<UserResponse>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.removeItem("justFinishedOnboarding");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true");

    // Determine platform-specific tutorial order
    const isMobile = window.innerWidth < 768;
    startTutorial(getSmeTutorialConfig(isMobile));
  };

  const handleSkipTutorial = () => {
    const user = getUser<UserResponse>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.removeItem("justFinishedOnboarding");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
  };

  const handleCloseWelcome = () => {
    const user = getUser<UserResponse>();
    if (user) {
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true"
      );
    }
    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.removeItem("justFinishedOnboarding");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black relative overflow-hidden">
        <AtmosphericBackground portal="sme" />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400 font-medium">
            Initialising session…
          </p>
        </div>
      </div>
    );
  }

  if (isOnboarding) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-screen w-full bg-transparent overflow-hidden">
      <AtmosphericBackground
        portal="sme"
        isDashboard={isMainDashboard && !showWelcomeModal}
      />

      <div className="flex h-full w-full bg-transparent">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />

        <div className="flex-1 w-full flex flex-col min-w-0 overflow-hidden relative">
          <TopBar onMenuToggle={() => setMobileOpen(!mobileOpen)} />

          <main
            id="main-scroll-area"
            className="flex-1 overflow-y-auto pt-16 pb-0"
          >
            {children}
          </main>

          <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm pointer-events-auto">
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
                FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
              </p>
            </div>
          </footer>

          <GlossaryButton businessScale={userProfile?.business_scale} />

          <FloatingChatButton
            id="ai-assistant-fab"
            onClick={() => setChatOpen(!chatOpen)}
            variant="purple"
            isPaused={chatOpen}
            showTooltip={showChatTooltip}
            onCloseTooltip={() => setShowChatTooltip(false)}
            messageCount={aiUsageCount}
          />
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[100] md:hidden flex pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer container pane */}
          <div
            className="absolute top-0 bottom-0 left-0 w-72 max-w-[80vw] bg-white dark:bg-zinc-950 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300 ease-out pointer-events-auto"
          >
            <div className="flex-1 overflow-y-auto" onClick={() => setMobileOpen(false)}>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <NLPChatModal
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setActiveConversationId(null);
        }}
        sidebarCollapsed={collapsed}
        initialConversationId={activeConversationId}
      />

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        onStartTutorial={handleStartTutorial}
        onSkipTutorial={handleSkipTutorial}
        portalType="sme"
        businessScale={userProfile?.business_scale}
      />

      <TutorialOverlay />
    </div>
  );
}
