"use client";

/**
 * FinWatch Zambia - Regulator Layout
 *
 * Layout for regulator portal with sidebar, top bar, mobile nav,
 * AI chat modal, and system info overlay. Includes role-based access control.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon, Menu, Info, Activity, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { getRegToken, getRegUser } from "@/lib/regulator-auth";
import { RegulatorSidebar } from "@/components/regulator/RegulatorSidebar";
import { RegulatorMobileNav } from "@/components/regulator/RegulatorMobileNav";
import { RegulatorChatModal } from "@/components/regulator/RegulatorChatModal";
import { SystemInfoOverlay } from "@/components/shared/SystemInfoOverlay";

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

function RegulatorTopBar({ onOpenInfo }: { onOpenInfo: () => void }) {
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
      {/* Left - breadcrumb + greeting */}
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

      {/* Right - actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        {/* System Info */}
        <button
          onClick={onOpenInfo}
          aria-label="System Information"
          className="relative p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Info size={17} />
        </button>

        {/* Portal badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
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

export default function RegulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userRole, setUserRole] = useState("policy_analyst");
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    const token = getRegToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const user = getRegUser<{ role: string }>();
    if (user?.role) setUserRole(user.role);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Loading portal…</p>
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
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <RegulatorTopBar onOpenInfo={() => setInfoOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">{children}</main>

        {/* Fixed Footer with blurred glass effect - desktop only */}
        <footer className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center pointer-events-none z-20">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm pointer-events-auto">
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

      <SystemInfoOverlay 
        open={infoOpen} 
        onClose={() => setInfoOpen(false)} 
        type="regulator" 
      />
    </div>
  );
}
