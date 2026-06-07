"use client";

/**
 * FinWatch Zambia - Institutional Mobile Navigation
 *
 * Enforced dark-mode variant regardless of global theme.
 * Matches SME interaction patterns, GPU-accelerated animations, and layout exactly.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  X,
  FileText,
  Settings,
  LogOut,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { clearInstitutionalToken } from "@/lib/institutional-auth";

interface InstitutionalMobileNavProps {
  mobileOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  userRole: string;
  onOpenChat: () => void;
  onExportOpen?: () => void;
}

export function InstitutionalMobileNav({
  mobileOpen,
  onMenuToggle,
  onMenuClose,
  userRole,
  onOpenChat,
}: InstitutionalMobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  const isAnalyst = userRole === "policy_analyst";
  const prefix = isAnalyst ? "/analyst" : "/regulator";

  useEffect(() => {
    const raw = localStorage.getItem("inst_user");
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch (e) {}
    }
    api
      .get("/api/auth/me")
      .then((res) => {
        setProfile(res.data);
        localStorage.setItem("inst_user", JSON.stringify(res.data));
      })
      .catch(() => {});
  }, []);

  function isActive(href: string) {
    return pathname === href;
  }

  async function handleSignOut() {
    await clearInstitutionalToken();
    router.replace("/institutional/auth/login");
  }

  // Institutional Dark Mode Theme Tokens (Hardcoded for both themes)
  const accentBase = isAnalyst ? "bg-blue-600" : "bg-emerald-600";
  const accentText = isAnalyst ? "text-blue-400" : "text-emerald-400";
  const accentBg = isAnalyst ? "bg-blue-900/40" : "bg-emerald-900/40";
  const activeIconShadow = isAnalyst 
    ? "shadow-[0_8px_20px_rgba(37,99,235,0.4)]" 
    : "shadow-[0_8px_20px_rgba(5,150,105,0.4)]";

  const LEFT_ITEMS = [
    { href: prefix, icon: Home, label: "Home", id: "mobile-nav-overview" },
    {
      href: `${prefix}/trends`,
      icon: TrendingUp,
      label: "Trends",
      id: "mobile-nav-trends",
    },
  ];

  const RIGHT_ITEMS = isAnalyst 
    ? [
        {
          href: `${prefix}/reports`,
          icon: FileText,
          label: "Reports",
          id: "mobile-nav-reports",
        },
      ]
    : [
        {
          href: `${prefix}/anomalies`,
          icon: AlertTriangle,
          label: "Anomalies",
          id: "mobile-nav-anomalies",
        },
      ];

  const FLYOUT_ITEMS = isAnalyst
    ? [
        {
          href: `${prefix}/insights`,
          icon: BarChart3,
          label: "Data Insights",
          id: "mobile-nav-insights",
        },
        {
          href: "/analyst/docs",
          icon: BookOpen,
          label: "Documentation",
          id: "mobile-nav-docs",
        },
        {
          href: `${prefix}/settings`,
          icon: Settings,
          label: "Settings",
          id: "mobile-nav-settings",
        },
      ]
    : [
        {
          href: `${prefix}/reports`,
          icon: FileText,
          label: "Reports",
          id: "mobile-nav-reports",
        },
        {
          href: "/regulator/docs",
          icon: BookOpen,
          label: "Documentation",
          id: "mobile-nav-docs",
        },
        {
          href: `${prefix}/settings`,
          icon: Settings,
          label: "Settings",
          id: "mobile-nav-settings",
        },
      ];

  const isProfileActive = isAnalyst
    ? pathname === `${prefix}/settings`
    : pathname === `${prefix}/settings` || pathname === `${prefix}/reports`;

  return (
    <>
      {/* Tap-anywhere to close overlay - Transparent */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={onMenuClose}
        />
      )}

      {/* Profile Flyout - Matches SME Slide & Animation */}
      <div
        className={cn(
          "fixed right-4 z-50 w-52 bg-zinc-950/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-500 ease-out origin-bottom",
          mobileOpen
            ? "bottom-[72px] opacity-100 translate-y-0"
            : "bottom-[52px] opacity-0 translate-y-8 pointer-events-none"
        )}
      >
        <div className="p-2 space-y-1">
          {FLYOUT_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                onClick={onMenuClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150",
                  active
                    ? `${accentBg} text-white`
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={18} />
                <span className={cn("text-sm", active ? "font-bold" : "font-medium")}>
                  {label}
                </span>
              </Link>
            );
          })}

          <div className="h-px bg-white/10 my-1 mx-2" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-400 hover:bg-red-900/20 hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Docked Navbar - Permanent Institutional Dark Aesthetic */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30
      bg-zinc-950/90 backdrop-blur-2xl
      border-t border-white/10
      shadow-[0_-8px_30px_rgba(0,0,0,0.3)]
      rounded-t-[2rem] pb-safe"
      >
        <nav className="flex items-center justify-between px-3 h-16">
          {LEFT_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                className="group relative flex flex-col items-center justify-center flex-1 min-w-0 h-full"
              >
                <div
                  className={cn(
                    "relative z-20 flex items-center justify-center transition-all duration-300 ease-institutional transform-gpu will-change-transform",
                    active
                      ? cn("w-10 h-10 rounded-full bg-white -translate-y-4 scale-110", activeIconShadow)
                      : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      active
                        ? (isAnalyst ? "text-blue-600" : "text-emerald-600")
                        : "text-zinc-500"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap",
                    active
                      ? "text-white opacity-100 translate-y-0"
                      : "text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Central Action: Insights - Elevated Circle */}
          <Link
            href={`${prefix}/insights`}
            id="mobile-nav-insights"
            aria-label="Overview Insights"
            className="group relative flex flex-col items-center justify-center flex-1 min-w-0 h-full"
          >
            <div
              className={cn(
                "relative z-20 flex items-center justify-center transition-all duration-300 ease-institutional transform-gpu will-change-transform",
                isActive(`${prefix}/insights`)
                  ? cn("w-10 h-10 rounded-full bg-white -translate-y-4 scale-110", activeIconShadow)
                  : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
              )}
            >
              <BarChart3
                size={20}
                className={cn(
                  isActive(`${prefix}/insights`)
                    ? (isAnalyst ? "text-blue-600" : "text-emerald-600")
                    : "text-zinc-500"
                )}
                strokeWidth={isActive(`${prefix}/insights`) ? 2.5 : 2}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-bold transition-all duration-300 absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap",
                isActive(`${prefix}/insights`)
                  ? "text-white opacity-100 translate-y-0"
                  : "text-zinc-500 opacity-0 translate-y-2"
              )}
            >
              Insights
            </span>
          </Link>

          {RIGHT_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                className="group relative flex flex-col items-center justify-center flex-1 min-w-0 h-full"
              >
                <div
                  className={cn(
                    "relative z-20 flex items-center justify-center transition-all duration-300 ease-institutional transform-gpu will-change-transform",
                    active
                      ? cn("w-10 h-10 rounded-full bg-white -translate-y-4 scale-110", activeIconShadow)
                      : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      active
                        ? (isAnalyst ? "text-blue-600" : "text-emerald-600")
                        : "text-zinc-500"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap",
                    active
                      ? "text-white opacity-100 translate-y-0"
                      : "text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Profile Trigger - Ringed when active */}
          <button
            onClick={onMenuToggle}
            id="mobile-nav-user-profile"
            aria-label="User profile menu"
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full relative"
          >
            <div
              className={cn(
                "w-11 h-11 flex items-center justify-center transition-transform duration-300",
                (mobileOpen || isProfileActive) && "-translate-y-1.5"
              )}
            >
              {mobileOpen ? (
                <X
                  size={22}
                  className={accentText}
                  strokeWidth={2.2}
                />
              ) : (
                <div
                  className={cn(
                    "relative rounded-full transition-all duration-300",
                    isProfileActive &&
                      "ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]"
                  )}
                >
                  <Avatar className="h-7 w-7 border border-white/10 shadow-sm">
                    {profile?.profile_picture_url && (
                      <AvatarImage
                        src={
                          profile.profile_picture_url.startsWith("http")
                            ? profile.profile_picture_url
                            : `${
                                process.env.NEXT_PUBLIC_API_URL ||
                                "https://finwatch-backend.onrender.com"
                              }${profile.profile_picture_url}`
                        }
                      />
                    )}
                    <AvatarFallback className={cn("text-[10px] font-bold text-white", accentBase)}>
                      {profile?.full_name ? (
                        profile.full_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .substring(0, 2)
                      ) : (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium leading-none truncate w-full text-center absolute bottom-1.5 left-1/2 -translate-x-1/2 transition-all duration-300",
                mobileOpen || isProfileActive
                  ? "text-white opacity-100 translate-y-0"
                  : "text-zinc-500 opacity-0 translate-y-2"
              )}
            >
              {mobileOpen
                ? "Close"
                : pathname === `${prefix}/settings`
                ? "Settings"
                : pathname === `${prefix}/reports`
                ? "Reports"
                : "Profile"}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
