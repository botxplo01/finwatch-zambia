"use client";

/**
 * FinWatch Zambia - Regulator Mobile Navigation
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
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
  { href: "/regulator", icon: Home, label: "Home", id: "mobile-nav-overview" },
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
  const accentText = isAnalyst ? "text-blue-400" : "text-emerald-400";
  const accentBg = isAnalyst ? "bg-blue-900/20" : "bg-emerald-900/20";
  const accentActive = isAnalyst ? "bg-blue-800 dark:bg-blue-700" : "bg-emerald-800 dark:bg-emerald-700";
  const accentHover = isAnalyst ? "bg-blue-700 dark:bg-blue-600" : "bg-emerald-700 dark:bg-emerald-600";
  const accentGlow = isAnalyst ? "shadow-blue-900/50" : "shadow-emerald-900/50";
  
  const navBg = isAnalyst ? "bg-[#050b1a]" : "bg-[#020d0a]";
  const navBorder = isAnalyst ? "border-blue-900/20" : "border-emerald-900/20";

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

  const isProfileActive = pathname === "/regulator/settings" || pathname === "/regulator/reports";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
          onClick={onMenuClose}
        />
      )}

      <div
        className={cn(
          "fixed bottom-20 right-4 z-50 w-52 backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right",
          navBg,
          navBorder,
          mobileOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none"
        )}
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
                      ? `${accentBg} ${accentText}`
                      : "text-zinc-100 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            );
          })}

          <div className="h-px bg-white/10 my-1 mx-2" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-100 hover:bg-red-900/20 hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t shadow-[0_-8px_32px_rgba(0,0,0,0.5)] pb-safe",
          `${navBg}/90`,
          navBorder
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <nav className="flex items-center justify-between px-2 h-16">
          {LEFT_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                className="group relative flex flex-col items-center justify-center flex-1 min-w-0 h-full"
              >
                <div className={cn(
                  "relative z-20 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform",
                  active 
                    ? cn("w-10 h-10 rounded-full -translate-y-4 scale-110", 
                         isAnalyst ? "bg-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.4)]" : "bg-emerald-600 shadow-[0_8px_20px_rgba(5,150,105,0.4)]")
                    : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                )}>
                  <Icon
                    size={20}
                    className={active ? "text-white" : "text-zinc-500"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                    active ? accentText + " opacity-100 translate-y-0" : "text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <div className="flex flex-col items-center justify-center flex-1 relative z-10 h-full">
            <Link
              href="/regulator/insights"
              id="mobile-nav-insights"
              aria-label="Overview Insights"
              className="group relative flex flex-col items-center justify-center w-full h-full"
            >
              <div className={cn(
                "relative z-20 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform",
                isActive("/regulator/insights")
                  ? cn("w-10 h-10 rounded-full -translate-y-4 scale-110", 
                       isAnalyst ? "bg-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.4)]" : "bg-emerald-600 shadow-[0_8px_20px_rgba(5,150,105,0.4)]")
                  : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
              )}>
                <BarChart3
                  size={20}
                  className={isActive("/regulator/insights") ? "text-white" : "text-zinc-500"}
                  strokeWidth={isActive("/regulator/insights") ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                  isActive("/regulator/insights") ? accentText + " opacity-100 translate-y-0" : "text-zinc-500 opacity-0 translate-y-2"
                )}
              >
                Insights
              </span>
            </Link>
          </div>

          {visibleRightItems.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                className="group relative flex flex-col items-center justify-center flex-1 min-w-0 h-full"
              >
                <div className={cn(
                  "relative z-20 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform",
                  active 
                    ? cn("w-10 h-10 rounded-full -translate-y-4 scale-110", 
                         isAnalyst ? "bg-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.4)]" : "bg-emerald-600 shadow-[0_8px_20px_rgba(5,150,105,0.4)]")
                    : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                )}>
                  <Icon
                    size={20}
                    className={active ? "text-white" : "text-zinc-500"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                    active ? accentText + " opacity-100 translate-y-0" : "text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={onMenuToggle}
            aria-label="User profile menu"
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              {mobileOpen ? (
                <X size={22} className={accentText} strokeWidth={2.2} />
              ) : (
                <div className={cn(
                  "relative rounded-full transition-all duration-300",
                  isProfileActive && (isAnalyst 
                    ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-[#041a14]" 
                    : "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#041a14]")
                )}>
                  <Avatar className="h-7 w-7 border border-white/10 shadow-sm">
                    {profile?.profile_picture_url && (
                      <AvatarImage 
                        src={profile.profile_picture_url.startsWith("http") ? profile.profile_picture_url : `${process.env.NEXT_PUBLIC_API_URL || "https://finwatch-backend.onrender.com"}${profile.profile_picture_url}`} 
                      />
                    )}
                    <AvatarFallback className={cn("text-[10px] font-bold text-white", accentBase)}>
                      {profile?.full_name ? profile.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : <Loader2 size={12} className="animate-spin" />}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium leading-none truncate w-full text-center absolute bottom-1.5 transition-all duration-300",
                (mobileOpen || isProfileActive) ? accentText + " opacity-100 translate-y-0" : "text-zinc-500 opacity-0 translate-y-2"
              )}
            >
              {mobileOpen 
                ? "Close" 
                : pathname === "/regulator/settings" 
                  ? "Settings" 
                  : pathname === "/regulator/reports" 
                    ? "Reports" 
                    : "Profile"
              }
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
