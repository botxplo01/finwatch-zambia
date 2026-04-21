"use client";

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
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/companies", icon: Building2, label: "Companies" },
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
  mobileOpen: boolean;
  onMobileClose: () => void;
}

// ── Shared nav content (used for both desktop + mobile drawer) ───────────────
function SidebarContent({
  collapsed = false,
  isMobile = false,
  onToggleCollapse,
  onMobileClose,
}: {
  collapsed?: boolean;
  isMobile?: boolean;
  onToggleCollapse?: () => void;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  // Mobile drawer is always expanded; desktop respects collapsed state
  const isExpanded = isMobile || !collapsed;

  function handleSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return (
    <div className="relative flex flex-col h-full bg-gray-100 border-r border-gray-200">
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 ${
          !isExpanded ? "justify-center" : ""
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Activity size={16} className="text-white" />
        </div>

        {isExpanded && (
          <div className="overflow-hidden flex-1">
            <p className="text-gray-900 font-bold text-sm leading-tight tracking-wide">
              FinWatch
            </p>
            <p className="text-gray-500 text-[10px] leading-tight">
              Zambia SME Monitor
            </p>
          </div>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
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
              onClick={isMobile ? onMobileClose : undefined}
              title={!isExpanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!isExpanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
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
                    ? "text-purple-600"
                    : "text-gray-500 group-hover:text-gray-700"
                }`}
              />
              {isExpanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Nav ── */}
      <div className="px-2 py-2 border-t border-gray-200 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? onMobileClose : undefined}
              title={!isExpanded ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${!isExpanded ? "justify-center" : ""}
                ${
                  active
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                }`}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 ${
                  active
                    ? "text-purple-600"
                    : "text-gray-500 group-hover:text-gray-700"
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
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600
            hover:bg-red-50 hover:text-red-600 transition-all duration-150 group
            ${!isExpanded ? "justify-center" : ""}`}
        >
          <LogOut
            size={17}
            className="flex-shrink-0 text-gray-500 group-hover:text-red-500"
          />
          {isExpanded && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* ── Desktop collapse toggle ── */}
      {!isMobile && (
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors z-20 shadow-sm"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}
    </div>
  );
}

// ── Exported Sidebar ─────────────────────────────────────────────────────────
export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop — hidden on mobile */}
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

      {/* Mobile — full-screen overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden shadow-xl">
            <SidebarContent isMobile onMobileClose={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
}
