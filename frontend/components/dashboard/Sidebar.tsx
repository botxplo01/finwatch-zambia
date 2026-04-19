"use client";

import { useState } from "react";
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

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function handleSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return (
    <aside
      className={`relative flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
      style={{
        background:
          "linear-gradient(160deg, #1e1b4b 0%, #3b0764 40%, #6d28d9 100%)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 transition-all duration-300 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight tracking-wide">
              FinWatch
            </p>
            <p className="text-purple-300 text-[10px] leading-tight">
              Zambia SME Monitor
            </p>
          </div>
        )}
      </div>

      {/* ── Primary Nav ── */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-purple-200/80 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />
              )}
              <Icon
                size={17}
                className={`flex-shrink-0 transition-transform duration-200 ${
                  !collapsed && "group-hover:scale-110"
                }`}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Nav ── */}
      <div className="px-2 py-2 border-t border-white/10 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${
                  active
                    ? "bg-white/20 text-white"
                    : "text-purple-200/80 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </Link>
          );
        })}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          title={collapsed ? "Sign Out" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-purple-200/80 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 group ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut
            size={17}
            className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
          />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* ── Collapse Toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-purple-700 border border-purple-500 rounded-full flex items-center justify-center text-white hover:bg-purple-600 transition-colors z-20 shadow-md"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
