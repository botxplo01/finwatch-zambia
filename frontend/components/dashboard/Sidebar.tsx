"use client";

/**
 * FinWatch Zambia - Dashboard Sidebar
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  History,
  FileBarChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { clearToken } from "@/lib/auth";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Overview",
    id: "nav-overview",
  },
  {
    href: "/dashboard/companies",
    icon: Briefcase,
    label: "Companies",
    id: "nav-companies",
  },
  {
    href: "/dashboard/predict",
    icon: TrendingUp,
    label: "Predictions",
    id: "nav-predict",
  },
  {
    href: "/dashboard/history",
    icon: History,
    label: "History",
    id: "nav-history",
  },
  {
    href: "/dashboard/reports",
    icon: FileBarChart,
    label: "Reports",
    id: "nav-reports",
  },
];

const BOTTOM_ITEMS = [
  {
    href: "/dashboard/settings",
    icon: Settings,
    label: "Settings",
    id: "nav-settings",
  },
];

function SidebarContent({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const expanded = !collapsed;

  function handleSignOut() {
    clearToken();
    window.location.href = "/login";
  }

  return (
    <div className="relative flex h-full flex-col bg-white dark:bg-zinc-950 border-r border-gray-100 dark:border-zinc-900 transition-all duration-300 shadow-sm">
      <div
        className={`flex flex-col items-start px-5 py-5 mb-2 ${
          !expanded ? "items-center px-2" : ""
        }`}
      >
        <Link href="/dashboard" className="flex flex-col items-start gap-2">
          <Image
            src={
              theme === "dark"
                ? expanded
                  ? "/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
                  : "/brand/dark_mode/FinWatch_Logo_Icon_dark_mode.svg"
                : expanded
                  ? "/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
                  : "/brand/light_mode/FinWatch_Logo_Icon_light_mode.svg"
            }
            alt="FinWatch Logo"
            width={expanded ? 270 : 100}
            height={expanded ? 150 : 100}
            priority
            className="object-contain"
          />
          {expanded && (
            <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5 ml-0.5">
              SME Portal
            </p>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              title={!expanded ? label : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 font-semibold"
                  : "text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-zinc-100"
              } ${!expanded ? "justify-center" : ""}`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-600 rounded-r-full" />
              )}
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${
                  active
                    ? "text-purple-600 dark:text-purple-400"
                    : "group-hover:text-gray-900 dark:group-hover:text-zinc-100"
                }`}
              />
              {expanded && <span className="text-sm truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-50 dark:border-zinc-900 space-y-1">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              title={!expanded ? label : undefined}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 font-semibold"
                  : "text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-zinc-100"
              } ${!expanded ? "justify-center" : ""}`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${
                  active
                    ? "text-purple-600 dark:text-purple-400"
                    : "group-hover:text-gray-900 dark:group-hover:text-zinc-100"
                }`}
              />
              {expanded && <span className="text-sm truncate">{label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleSignOut}
          title={!expanded ? "Sign Out" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 w-full ${
            !expanded ? "justify-center" : ""
          }`}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {expanded && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-zinc-100 shadow-sm transition-all z-20"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside
      className={`hidden md:flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </aside>
  );
}
