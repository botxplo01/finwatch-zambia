"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sun, Moon, Menu, Bell, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import { getRegToken, getRegUser } from "@/lib/regulator-auth";
import { RegulatorSidebar } from "@/components/regulator/RegulatorSidebar";
import { RegulatorMobileNav } from "@/components/regulator/RegulatorMobileNav";

interface RegUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

function RegulatorTopBar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<RegUser | null>(null);

  useEffect(() => {
    setMounted(true);
    const u = getRegUser<RegUser>();
    if (u) setUser(u);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
            {user
              ? `Welcome, ${user.full_name.split(" ")[0]}`
              : "Regulator Portal"}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {user?.role === "regulator" ? "Full Access" : "Read-Only Access"}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button className="relative p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
          <Bell size={17} />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

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
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <RegulatorTopBar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">{children}</main>
      </div>

      <RegulatorMobileNav
        mobileOpen={flyoutOpen}
        onMenuToggle={() => setFlyoutOpen((o) => !o)}
        onMenuClose={() => setFlyoutOpen(false)}
        userRole={userRole}
      />

      {/* Fixed Footer with blurred glass effect — visible on desktop & mobile (above bottom nav) */}
      <footer className="fixed bottom-6 left-0 right-0 md:left-64 flex justify-center pointer-events-none z-20">
        <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 dark:border-zinc-800/40 shadow-sm">
          <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
            FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
          </p>
        </div>
      </footer>
    </div>
  );
}
