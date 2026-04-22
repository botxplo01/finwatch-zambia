"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Menu,
  X,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { clearRegToken } from "@/lib/regulator-auth";

// Primary nav items for regulators
const LEFT_ITEMS = [
  { href: "/regulator", icon: LayoutDashboard, label: "Home" },
  { href: "/regulator/trends", icon: TrendingUp, label: "Trends" },
];

const RIGHT_ITEMS = [
  { href: "/regulator/anomalies", icon: AlertTriangle, label: "Anomalies" },
];

// Items for the fly-out menu
const FLYOUT_ITEMS = [
  { href: "/regulator/reports", icon: FileText, label: "Reports" },
  { href: "/regulator/settings", icon: Settings, label: "Settings" },
];

interface Props {
  mobileOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  userRole: string;
}

export function RegulatorMobileNav({ mobileOpen, onMenuToggle, onMenuClose, userRole }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href;
  }

  function handleSignOut() {
    clearRegToken();
    window.location.href = "/login";
  }

  return (
    <>
      {/* ── Fly-out Menu Backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
          onClick={onMenuClose}
        />
      )}

      {/* ── Fly-out Menu ── */}
      <div
        className={`fixed bottom-20 right-4 z-50 w-48 bg-white dark:bg-zinc-900 
          rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl 
          overflow-hidden transition-all duration-300 origin-bottom-right
          ${
            mobileOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
          }`}
      >
        <div className="p-2 space-y-1">
          {FLYOUT_ITEMS.filter(item => !item.roles || item.roles.includes(userRole)).map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMenuClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150
                  ${
                    active
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            );
          })}

          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1 mx-2" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-600 dark:text-zinc-400
              hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-end justify-around
      bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg
      border-t border-gray-200 dark:border-zinc-800
      shadow-[0_-4px_24px_rgba(0,0,0,0.06)]
      px-2 pb-safe"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* ── Left items ── */}
        {LEFT_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 pt-3 pb-1 px-3 min-w-[56px] flex-1"
            >
              <Icon
                size={22}
                className={
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* ── Centre raised action button ── */}
        <div className="flex flex-col items-center flex-1 relative" style={{ marginTop: "-20px" }}>
          <Link
            href="/regulator/insights"
            aria-label="Overview Insights"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg
            transition-all duration-200 active:scale-95
            ${
              isActive("/regulator/insights")
                ? "bg-emerald-700 dark:bg-emerald-600 shadow-emerald-300/50 dark:shadow-emerald-900/50"
                : "bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-400 shadow-emerald-200/50 dark:shadow-emerald-900/50"
            }`}
          >
            <BarChart3 size={22} className="text-white" strokeWidth={2} />
          </Link>
          <span
            className={`text-[10px] font-medium leading-none mt-1.5 ${
              isActive("/regulator/insights")
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400 dark:text-zinc-500"
            }`}
          >
            Insights
          </span>
        </div>

        {/* ── Right items ── */}
        {RIGHT_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 pt-3 pb-1 px-3 min-w-[56px] flex-1"
            >
              <Icon
                size={22}
                className={
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* ── Hamburger — opens fly-out ── */}
        <button
          onClick={onMenuToggle}
          aria-label="More options"
          className="flex flex-col items-center gap-1 pt-3 pb-1 px-3 min-w-[56px] flex-1"
        >
          {mobileOpen ? (
            <X size={22} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          ) : (
            <Menu size={22} className="text-gray-400 dark:text-zinc-500" strokeWidth={1.8} />
          )}
          <span
            className={`text-[10px] font-medium leading-none ${
              mobileOpen ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-500"
            }`}
          >
            {mobileOpen ? "Close" : "Menu"}
          </span>
        </button>
      </nav>
    </>
  );
}
