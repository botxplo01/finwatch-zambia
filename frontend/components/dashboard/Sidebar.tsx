"use client";

/**
 * FinWatch Zambia - Dashboard Sidebar
 *
 * Collapsible navigation sidebar for the SME dashboard.
 * Includes logo, primary navigation items, settings, and sign out.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  History,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/companies", icon: Building2, label: "Companies" },
  { href: "/dashboard/predict", icon: TrendingUp, label: "New Prediction" },
  { href: "/dashboard/history", icon: History, label: "History" },
  { href: "/dashboard/reports", icon: FileText, label: "Reports" },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// Shared nav content (used for desktop)
function SidebarContent({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  // Desktop respects collapsed state
  const isExpanded = !collapsed;

  function handleSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return (
    <div className="relative flex flex-col h-full bg-gray-100 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-zinc-800 ${
          !isExpanded ? "justify-center" : ""
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Activity size={16} className="text-white" />
        </div>

        {isExpanded && (
          <div className="overflow-hidden flex-1">
            <p className="text-gray-900 dark:text-gray-100 font-bold text-sm leading-tight tracking-wide">
              FinWatch
            </p>
            <p className="text-gray-500 dark:text-zinc-500 text-[10px] leading-tight">
              Zambia SME Monitor
            </p>
          </div>
        )}
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={!isExpanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!isExpanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
            >
              {/* Active left indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-600 rounded-r-full" />
              )}
              <Icon
                size={17}
                className={`flex-shrink-0 ${
                  active
                    ? "text-purple-600 dark:text-purple-500"
                    : "text-gray-500 dark:text-zinc-500 group-hover:text-gray-700 dark:group-hover:text-zinc-300"
                }`}
              />
              {isExpanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="px-2 py-2 border-t border-gray-200 dark:border-zinc-800 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={!isExpanded ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!isExpanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 ${
                  active
                    ? "text-purple-600 dark:text-purple-500"
                    : "text-gray-500 dark:text-zinc-500 group-hover:text-gray-700 dark:group-hover:text-zinc-300"
                }`}
              />
              {isExpanded && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </Link>
          );
        })}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          title={!isExpanded ? "Sign Out" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-zinc-400
            hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 group
            ${!isExpanded ? "justify-center" : ""}`}
        >
          <LogOut
            size={17}
            className="flex-shrink-0 text-gray-500 dark:text-zinc-500 group-hover:text-red-500 dark:group-hover:text-red-400"
          />
          {isExpanded && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* Desktop collapse toggle */}
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors z-20 shadow-sm"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  );
}

// Exported Sidebar
export function Sidebar({
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
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
