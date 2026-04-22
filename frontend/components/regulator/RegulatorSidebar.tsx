"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Activity,
} from "lucide-react";
import { clearRegToken } from "@/lib/regulator-auth";

const NAV_ITEMS = [
  { href: "/regulator", icon: LayoutDashboard, label: "Overview" },
  { href: "/regulator/insights", icon: BarChart3, label: "Sector Insights" },
  { href: "/regulator/trends", icon: TrendingUp, label: "Trends" },
  { href: "/regulator/anomalies", icon: ShieldCheck, label: "Anomalies" },
  { href: "/regulator/reports", icon: FileBarChart, label: "Reports" },
];

const BOTTOM_ITEMS = [
  { href: "/regulator/settings", icon: Settings, label: "Settings" },
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
  const expanded = !collapsed;

  function handleSignOut() {
    clearRegToken();
    window.location.href = "/login";
  }

  const roleBadge =
    userRole === "regulator"
      ? { label: "Regulator", bg: "bg-emerald-600" }
      : { label: "Policy Analyst", bg: "bg-blue-600" };

  return (
    <div className="relative flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800 ${!expanded ? "justify-center" : ""}`}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Activity size={16} className="text-white" />
        </div>

        {expanded && (
          <div className="overflow-hidden flex-1">
            <p className="text-white font-bold text-sm leading-tight tracking-wide">
              FinWatch
            </p>
            <p className="text-gray-400 text-[10px] leading-tight">
              Regulator Portal
            </p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {expanded && (
        <div className="px-4 py-3 border-b border-gray-800">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white ${roleBadge.bg}`}
          >
            <ShieldCheck size={10} />
            {roleBadge.label}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={!expanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!expanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-emerald-900/40 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-500 rounded-r-full" />
              )}
              <Icon
                size={17}
                className={`flex-shrink-0 ${active ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300"}`}
              />
              {expanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-2 border-t border-gray-800 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={!expanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!expanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-emerald-900/40 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 ${active ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300"}`}
              />
              {expanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}

        <button
          onClick={handleSignOut}
          title={!expanded ? "Sign Out" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-all group ${!expanded ? "justify-center" : ""}`}
        >
          <LogOut
            size={17}
            className="flex-shrink-0 text-gray-500 group-hover:text-red-400"
          />
          {expanded && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors z-20 shadow-sm"
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
}: Props) {
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
