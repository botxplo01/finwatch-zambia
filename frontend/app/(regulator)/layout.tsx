"use client";

/**
 * FinWatch Zambia - Regulator Layout
 */


import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon, Info, Activity, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { getRegToken, getRegUser } from "@/lib/regulator-auth";
import { RegulatorSidebar } from "@/components/regulator/RegulatorSidebar";
import { RegulatorMobileNav } from "@/components/regulator/RegulatorMobileNav";
import { RegulatorChatModal } from "@/components/regulator/RegulatorChatModal";
import { SystemInfoOverlay } from "@/components/shared/SystemInfoOverlay";
import { FloatingChatButton } from "@/components/shared/FloatingChatButton";
import { TutorialOverlay } from "@/components/shared/TutorialOverlay";
import { WelcomeModal } from "@/components/shared/WelcomeModal";
import { useTutorial, REGULATOR_TUTORIAL_CONFIG } from "@/context/TutorialContext";

interface RegUser {
  id: number;
  full_name: string;
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

function RegulatorTopBar({ 
  onOpenInfo
}: { 
  onOpenInfo: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<RegUser | null>(null);
  const pathname = usePathname();
  const crumbs = BREADCRUMB_MAP[pathname] ?? ["Home"];

  useEffect(() => {
    setMounted(true);
    const u = getRegUser<RegUser>();
    if (u) setUser(u);
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10">
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
                  i === crumbs.length - 1 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
          {getGreeting()}
          {user ? `, ${user.full_name.split(" ")[0]}` : ""}
        </p>
        <p className="hidden sm:block text-[11px] text-gray-400 dark:text-zinc-500 leading-none">
          {today}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        <button
          id="info-trigger"
          onClick={onOpenInfo}
          aria-label="System Information"
          className="relative p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Info size={17} />
        </button>

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl ml-1">
          <Activity
            size={13}
            className="text-emerald-600 dark:text-emerald-400"
          />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Regulator Portal
          </span>
        </div>
      </div>
    </header>
  );
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
  const { isActive, currentStepIndex, config, startTutorial } = useTutorial();
  const [ready, setReady] = useState(false);
  const [userRole, setUserRole] = useState("policy_analyst");
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Sync mobile menu with tutorial steps
  useEffect(() => {
    if (isActive && config?.portal === "regulator") {
      const targetId = config.steps[currentStepIndex].targetId;
      if (window.innerWidth < 768 && (targetId === "nav-reports" || targetId === "nav-settings")) {
        setFlyoutOpen(true);
      } else {
        setFlyoutOpen(false);
      }
    } else if (!isActive) {
      setFlyoutOpen(false);
    }
  }, [isActive, currentStepIndex, config]);

  // 1. Session Readiness & Auth Check
  useEffect(() => {
    const token = getRegToken();
    const user = getRegUser<RegUser>();
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    if (user.role) setUserRole(user.role);
    setReady(true);
  }, [router]);

  const onboardingTriggered = useRef(false);

  // 2. Onboarding & Tutorial Logic
  useEffect(() => {
    if (!ready || isActive || onboardingTriggered.current) return;

    const user = getRegUser<RegUser>();
    if (!user) return;
    const userId = user.id || user.email;

    const isFirstTime = localStorage.getItem("isFirstTimeRegistration") === "true";
    const hasSeenWelcome = localStorage.getItem(`hasSeenWelcomeModal_${userId}`) === "true";
    const sessionSeen = sessionStorage.getItem("hasSeenAITooltipThisSession") === "true";

    // A. Welcome Modal: For NEW users
    if (isFirstTime && !hasSeenWelcome) {
      onboardingTriggered.current = true;
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 3000);
      return;
    }

    // B. AI Tooltip: For EXISTING users
    if (!isFirstTime && !sessionSeen) {
      onboardingTriggered.current = true;
      setTimeout(() => {
        setShowChatTooltip(true);
        sessionStorage.setItem("hasSeenAITooltipThisSession", "true");
        setTimeout(() => setShowChatTooltip(false), 10000);
      }, 3000);
    }
  }, [ready, isActive]);

  const handleStartTutorial = () => {
    const user = getRegUser<RegUser>();
    if (user) {
      localStorage.setItem(`hasSeenWelcomeModal_${user.id || user.email}`, "true");
    }
    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true"); // Prevent tooltip in this session
    startTutorial(REGULATOR_TUTORIAL_CONFIG);
  };

  const handleSkipTutorial = () => {
    const user = getRegUser<RegUser>();
    if (user) {
      localStorage.setItem(`hasSeenWelcomeModal_${user.id || user.email}`, "true");
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
      localStorage.setItem(`hasSeenWelcomeModal_${user.id || user.email}`, "true");
    }
    setShowWelcomeModal(false);
    localStorage.removeItem("isFirstTimeRegistration");
    sessionStorage.setItem("hasSeenAITooltipThisSession", "true"); // Prevent tooltip in this session
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Initialising portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 overflow-hidden">
      <RegulatorSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <RegulatorTopBar 
          onOpenInfo={() => setInfoOpen(true)} 
        />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>

        <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm pointer-events-auto border-gray-100/50">
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
            </p>
          </div>
        </footer>
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

      <FloatingChatButton 
        id="ai-assistant-fab"
        onClick={() => setChatOpen(true)} 
        variant="emerald" 
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
        portalType="regulator"
      />

      <SystemInfoOverlay 
        open={infoOpen} 
        onClose={() => setInfoOpen(false)} 
        type="regulator" 
      />
    </div>
  );
}
