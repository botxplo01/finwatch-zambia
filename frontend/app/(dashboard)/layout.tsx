"use client";

/**
 * FinWatch Zambia - SME Dashboard Layout
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { NLPChatModal } from "@/components/dashboard/NLPChatModal";
import { FloatingChatButton } from "@/components/shared/FloatingChatButton";
import { TutorialOverlay } from "@/components/shared/TutorialOverlay";
import { WelcomeModal } from "@/components/shared/WelcomeModal";
import { AtmosphericBackground } from "@/components/shared/AtmosphericBackground";
import { useTutorial, SME_TUTORIAL_CONFIG } from "@/context/TutorialContext";
import { restoreSessionFromNative } from "@/lib/auth";

/**
 * Root layout for the SME owner portal.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, currentStepIndex, config, startTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Sync mobile menu with tutorial steps
  useEffect(() => {
    if (isActive && config?.portal === "sme") {
      const targetId = config.steps[currentStepIndex].targetId;
      if (
        window.innerWidth < 768 &&
        (targetId === "nav-reports" || targetId === "nav-user-profile")
      ) {
        setMobileOpen(true);
      } else {
        setMobileOpen(false);
      }
    } else if (!isActive) {
      setMobileOpen(false);
    }
  }, [isActive, currentStepIndex, config]);

  // 1. Session Readiness & Auth Check (Persistence-Aware)
  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem("token");
      let userRaw = localStorage.getItem("user");

      // On native mobile, try to recover from Capacitor Preferences if LocalStorage is empty
      if (!token || !userRaw) {
        const recovered = await restoreSessionFromNative();
        if (recovered) {
          token = localStorage.getItem("token");
          userRaw = localStorage.getItem("user");
        }
      }

      if (!token || !userRaw) {
        router.replace("/login");
        return;
      }
      setReady(true);
    };

    checkAuth();
  }, [router]);

  const onboardingTriggered = useRef(false);

  // 2. Onboarding & Tutorial Logic
  useEffect(() => {
    if (!ready || isActive || onboardingTriggered.current) return;

    const userRaw = localStorage.getItem("user");
    if (!userRaw) return;
    const user = JSON.parse(userRaw);
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
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true",
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
    startTutorial(SME_TUTORIAL_CONFIG);
  };

  const handleSkipTutorial = () => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true",
      );
    }

    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
  };

  const handleCloseWelcome = () => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      localStorage.setItem(
        `hasSeenWelcomeModal_${user.id || user.email}`,
        "true",
      );
    }
    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
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

  const isMainDashboard = pathname === "/dashboard";

  return (
    <div className="relative h-screen w-full bg-transparent overflow-hidden">
      <AtmosphericBackground portal="sme" isDashboard={isMainDashboard && !showWelcomeModal} />

      <div className="flex h-full w-full bg-transparent">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />

      <div className="flex-1 w-full flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />

        <main id="main-scroll-area" className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

        <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm pointer-events-auto">
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
            </p>
          </div>
        </footer>
      </div>
      </div>

      <MobileBottomNav
        mobileOpen={mobileOpen}
        onMenuToggle={() => setMobileOpen((o) => !o)}
        onMenuClose={() => setMobileOpen(false)}
        onOpenChat={() => setChatOpen(true)}
      />

      <NLPChatModal open={chatOpen} onClose={() => setChatOpen(false)} />

      <FloatingChatButton
        id="ai-assistant-fab"
        onClick={() => setChatOpen(true)}
        variant="purple"
        isPaused={chatOpen}
        showTooltip={showChatTooltip}
        onCloseTooltip={() => setShowChatTooltip(false)}
      />

      <TutorialOverlay />

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        onStartTutorial={handleStartTutorial}
        onSkipTutorial={handleSkipTutorial}
        portalType="sme"
      />
    </div>
  );
}

