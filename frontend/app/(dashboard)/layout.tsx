"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { NLPChatModal } from "@/components/dashboard/NLPChatModal";
import { FloatingChatButton } from "@/components/shared/FloatingChatButton";
import { TutorialOverlay } from "@/components/shared/TutorialOverlay";
import { useTutorial, SME_TUTORIAL_CONFIG } from "@/context/TutorialContext";

/**
 * Root layout for the SME owner portal.
 * Manages core navigation state, authentication, and the guided onboarding system.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isActive, currentStepIndex, config, startTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);

  // Sync mobile menu with tutorial steps
  useEffect(() => {
    if (isActive && config?.portal === "sme") {
      const targetId = config.steps[currentStepIndex].targetId;
      // Auto-open mobile menu for items hidden inside it
      if (window.innerWidth < 768 && (targetId === "nav-reports" || targetId === "nav-settings")) {
        setMobileOpen(true);
      } else {
        setMobileOpen(false);
      }
    } else if (!isActive) {
      setMobileOpen(false);
    }
  }, [isActive, currentStepIndex, config]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);

    const isFirstTime = localStorage.getItem("isFirstTimeRegistration") === "true";
    const sessionSeen = sessionStorage.getItem("hasSeenAITooltipThisSession") === "true";

    /**
     * AI Tooltip Logic:
     * Only show once per session, and NOT for new registrations (tutorial covers it).
     * Added check to prevent it showing if a manually triggered tutorial is already active.
     */
    if (!isFirstTime && !sessionSeen && !isActive) {
      const tooltipTimer = setTimeout(() => {
        // Re-check isActive just before showing to ensure no race condition
        if (!isActive) {
          setShowChatTooltip(true);
          sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
          const hideTimer = setTimeout(() => setShowChatTooltip(false), 10000);
          return () => clearTimeout(hideTimer);
        }
      }, 3000);
      return () => clearTimeout(tooltipTimer);
    }

    // Auto-trigger tour for new registrations
    const hasSeenPermanent = localStorage.getItem("hasCompletedTutorial_sme");
    if (isFirstTime && !hasSeenPermanent) {
      const tourTimer = setTimeout(() => {
        startTutorial(SME_TUTORIAL_CONFIG);
        localStorage.removeItem("isFirstTimeRegistration");
      }, 1500);
      return () => {
        clearTimeout(tourTimer);
      };
    }
  }, [router, startTutorial, isActive]); // Depend on isActive to suppress tooltip if tour starts early

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Initialising session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm pointer-events-auto">
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
            </p>
          </div>
        </footer>
      </div>

      <MobileBottomNav
        mobileOpen={mobileOpen}
        onMenuToggle={() => setMobileOpen((o) => !o)}
        onMenuClose={() => setMobileOpen(false)}
        onOpenChat={() => setChatOpen(true)}
      />

      <NLPChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      <FloatingChatButton 
        id="ai-assistant-fab"
        onClick={() => setChatOpen(true)} 
        variant="purple" 
        isPaused={chatOpen}
        showTooltip={showChatTooltip}
        onCloseTooltip={() => setShowChatTooltip(false)}
      />

      <TutorialOverlay />
    </div>
  );
}
