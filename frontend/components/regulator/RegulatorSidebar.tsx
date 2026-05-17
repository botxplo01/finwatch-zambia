"use client";

/**
 * FinWatch Zambia - Regulator Sidebar
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  FileBarChart,
  ShieldCheck,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { UserNav } from "@/components/shared/UserNav";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const NAV_ITEMS = [
  {
    href: "/regulator",
    icon: LayoutDashboard,
    label: "Overview",
    id: "nav-overview",
  },
  {
    href: "/regulator/trends",
    icon: TrendingUp,
    label: "Trends",
    id: "nav-trends",
  },
  {
    href: "/regulator/insights",
    icon: BarChart3,
    label: "Sector Insights",
    id: "nav-insights",
  },
  {
    href: "/regulator/anomalies",
    icon: ShieldCheck,
    label: "Anomalies",
    id: "nav-anomalies",
  },
  {
    href: "/regulator/reports",
    icon: FileBarChart,
    label: "Reports",
    id: "nav-reports",
  },
];

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string;
}

function NavContent({
  collapsed = false,
  onToggleCollapse,
  userRole,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userRole: string;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const expanded = !collapsed;

  const isAnalyst = userRole === "policy_analyst";
  const activeBg = isAnalyst 
    ? "bg-blue-50 dark:bg-blue-900/40" 
    : "bg-emerald-50 dark:bg-emerald-900/40";
  const activeText = isAnalyst 
    ? "text-blue-600 dark:text-blue-400" 
    : "text-emerald-600 dark:text-emerald-400";
  const activeBorder = isAnalyst ? "bg-blue-500" : "bg-emerald-500";

  // Filter nav items based on role
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (isAnalyst && item.id === "nav-anomalies") {
      return false;
    }
    return true;
  });

  return (
    <div className="relative flex flex-col h-full bg-white/70 dark:bg-[#0f0f1c]/80 backdrop-blur-xl border-r border-gray-100 dark:border-white/10 transition-colors duration-300">
      {/* Logo */}
      <div
        className={`flex flex-col items-start px-5 py-5 border-b border-gray-50 dark:border-white/10 ${
          !expanded ? "items-center px-2" : ""
        }`}
      >
        <Link href="/regulator" className="flex flex-col items-start gap-1">
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
            width={expanded ? 200 : 32}
            height={expanded ? 80 : 32}
            priority
            className="object-contain opacity-90"
          />
          {expanded && (
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-[0.2em] ml-0.5 leading-none",
              activeText
            )}>
              {isAnalyst ? "Policy Analyst Portal" : "Regulator Portal"}
            </p>
          )}
        </Link>
      </div>

      {/* Nav */}

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              title={!expanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!expanded ? "justify-center" : ""}
                ${
                  active
                    ? `${activeBg} ${activeText}`
                    : "text-gray-500 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
                }`}
            >
              {active && (
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 ${activeBorder} rounded-r-full`}
                />
              )}
              <Icon
                size={17}
                className={`flex-shrink-0 ${active ? activeText : "text-gray-400 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white"}`}
              />
              {expanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <UserNav collapsed={collapsed} portal="regulator" />

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white dark:bg-[#0f0f1c] border border-gray-100 dark:border-white/10 rounded-full flex items-center justify-center text-gray-400 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white transition-colors z-20 shadow-md"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  );
}

export function RegulatorSidebar({
  collapsed,
  onToggleCollapse,
  userRole,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string;
}) {
  return (
    <aside
      className={`hidden md:flex flex-col h-full flex-shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}
    >
      <NavContent
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        userRole={userRole}
      />
    </aside>
  );
}
