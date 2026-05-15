"use client";

/**
 * FinWatch Zambia - Regulator Mobile Navigation
 */

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
  Loader2,
} from "lucide-react";
import { clearRegToken } from "@/lib/regulator-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const LEFT_ITEMS = [
  { href: "/regulator", icon: LayoutDashboard, label: "Home", id: "mobile-nav-overview" },
  { href: "/regulator/trends", icon: TrendingUp, label: "Trends", id: "mobile-nav-trends" },
];

const RIGHT_ITEMS = [
  { href: "/regulator/anomalies", icon: AlertTriangle, label: "Anomalies", id: "mobile-nav-anomalies" },
];

const FLYOUT_ITEMS = [
  { href: "/regulator/reports", icon: FileText, label: "Reports", id: "mobile-nav-reports" },
  { href: "/regulator/settings", icon: Settings, label: "Settings", id: "mobile-nav-settings" },
];

interface Props {
  mobileOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  userRole: string;
  onOpenChat: () => void;
}

export function RegulatorMobileNav({
  mobileOpen,
  onMenuToggle,
  onMenuClose,
  userRole,
  onOpenChat,
}: Props) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("reg_user");
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch (e) {
        /* no-op */
      }
    }
    // Refresh from API
    api.get("/api/auth/me").then((res) => {
      setProfile(res.data);
      localStorage.setItem("reg_user", JSON.stringify(res.data));
    }).catch(() => {});
  }, []);

  function isActive(href: string) {
    return pathname === href;
  }

  function handleSignOut() {
    clearRegToken();
    window.location.href = "/regulator/auth/login";
  }

  const isAnalyst = userRole === "policy_analyst";
  const accentBase = isAnalyst ? "bg-blue-600" : "bg-emerald-600";
  const accentText = isAnalyst ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400";
  const accentBg = isAnalyst ? "bg-blue-50 dark:bg-blue-900/20" : "bg-emerald-50 dark:bg-emerald-900/20";
  const accentActive = isAnalyst ? "bg-blue-700 dark:bg-blue-600" : "bg-emerald-700 dark:bg-emerald-600";
  const accentHover = isAnalyst ? "bg-blue-600 dark:bg-blue-500" : "bg-emerald-600 dark:bg-emerald-500";

  // Filter items based on role permissions and UI priority
  const visibleFlyoutItems = isAnalyst
    ? FLYOUT_ITEMS.filter((item) => item.id !== "mobile-nav-reports")
    : FLYOUT_ITEMS;

  const visibleRightItems = isAnalyst
    ? [
        {
          href: "/regulator/reports",
          icon: FileText,
          label: "Reports",
          id: "mobile-nav-reports",
        },
      ]
    : RIGHT_ITEMS;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
          onClick={onMenuClose}
        />
      )}

      <div
        className={`fixed bottom-20 right-4 z-50 w-52 bg-white dark:bg-zinc-900
          rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl
          overflow-hidden transition-all duration-300 origin-bottom-right
          ${
            mobileOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
          }`}
      >
        <div className="p-2 space-y-1">
          {visibleFlyoutItems.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                onClick={onMenuClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150
                  ${
                    active
                      ? `${accentBg} ${isAnalyst ? "text-blue-700 dark:text-blue-400" : "text-emerald-700 dark:text-emerald-400"}`
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
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-end justify-between
          bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg
          border-t border-gray-200 dark:border-zinc-800
          shadow-[0_-4px_24px_rgba(0,0,0,0.06)]
          px-4 pb-safe"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {LEFT_ITEMS.map(({ href, icon: Icon, label, id }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              id={id}
              className="flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
            >
              <Icon
                size={22}
                className={
                  active
                    ? isAnalyst ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none truncate w-full text-center ${active ? accentText : "text-gray-400 dark:text-zinc-500"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <div
          className="flex flex-col items-center flex-1 relative z-10"
          style={{ marginTop: "-18px" }}
        >
          <Link
            href="/regulator/insights"
            id="mobile-nav-insights"
            aria-label="Overview Insights"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95
              ${
                isActive("/regulator/insights")
                  ? `${accentActive} shadow-blue-300/50`
                  : `${accentHover} hover:${accentActive} shadow-blue-200/50`
              }`}
          >
            <BarChart3 size={24} className="text-white" strokeWidth={2.5} />
          </Link>
          <span
            className={`text-[10px] font-bold leading-none mt-2 ${isActive("/regulator/insights") ? accentText : "text-gray-400 dark:text-zinc-500"}`}
          >
            Insights
          </span>
        </div>

        {visibleRightItems.map(({ href, icon: Icon, label, id }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              id={id}
              className="flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
            >
              <Icon
                size={22}
                className={
                  active
                    ? isAnalyst ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none truncate w-full text-center ${active ? accentText : "text-gray-400 dark:text-zinc-500"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={onMenuToggle}
          aria-label="User profile menu"
          className="flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
        >
          {mobileOpen ? (
            <X
              size={22}
              className={isAnalyst ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}
              strokeWidth={2.2}
            />
          ) : (
            <div className="relative">
              <Avatar className="h-7 w-7 border border-gray-100 dark:border-zinc-700 shadow-sm">
                {profile?.profile_picture_url && (
                  <AvatarImage 
                    src={profile.profile_picture_url.startsWith("http") ? profile.profile_picture_url : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${profile.profile_picture_url}`} 
                  />
                )}
                <AvatarFallback className={cn("text-[10px] font-bold text-white", accentBase)}>
                  {profile?.full_name ? profile.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : <Loader2 size={12} className="animate-spin" />}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <span
            className={`text-[10px] font-medium leading-none truncate w-full text-center ${mobileOpen ? accentText : "text-gray-400 dark:text-zinc-500"}`}
          >
            {mobileOpen ? "Close" : "Profile"}
          </span>
        </button>
      </nav>
    </>
  );
}
