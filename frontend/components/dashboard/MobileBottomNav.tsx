"use client";

/**
 * FinWatch Zambia - Dashboard Mobile Bottom Navigation
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  TrendingUp,
  History,
  Menu,
  X,
  FileText,
  Settings,
  LogOut,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const LEFT_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home", id: "mobile-nav-overview" },
  { href: "/dashboard/companies", icon: Building2, label: "Companies", id: "mobile-nav-companies" },
];

const RIGHT_ITEMS = [
  { href: "/dashboard/history", icon: History, label: "History", id: "mobile-nav-history" },
];

const FLYOUT_ITEMS = [
  { href: "/dashboard/reports", icon: FileText, label: "Reports", id: "mobile-nav-reports" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings", id: "mobile-nav-settings" },
];

interface Props {
  mobileOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onOpenChat: () => void;
}

export function MobileBottomNav({ mobileOpen, onMenuToggle, onMenuClose, onOpenChat }: Props) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
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
      localStorage.setItem("user", JSON.stringify(res.data));
    }).catch(() => {});
  }, []);

  function isActive(href: string) {
    return pathname === href;
  }

  function handleSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  const isProfileActive = pathname === "/dashboard/settings" || pathname === "/dashboard/reports";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
          onClick={onMenuClose}
        />
      )}

      <div
        className={`fixed bottom-20 right-4 z-50 w-52 bg-white/90 dark:bg-zinc-950/90 
          backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-zinc-800 shadow-2xl 
          overflow-hidden transition-all duration-300 origin-bottom-right
          ${
            mobileOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
          }`}
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
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150
                  ${
                    active
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
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

      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30 
      bg-white/80 dark:bg-black/80 backdrop-blur-xl
      border-t border-gray-200/50 dark:border-zinc-800/50
      shadow-[0_-8px_32px_rgba(0,0,0,0.1)]
      pb-safe"
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
                    ? "w-10 h-10 rounded-full bg-purple-600 dark:bg-purple-500 -translate-y-4 shadow-[0_8px_20px_rgba(109,40,217,0.3)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.5)] scale-110" 
                    : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                )}>
                  <Icon
                    size={20}
                    className={active ? "text-white" : "text-gray-400 dark:text-zinc-500"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                    active
                      ? "text-purple-600 dark:text-purple-400 opacity-100 translate-y-0"
                      : "text-gray-400 dark:text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <div className="flex flex-col items-center justify-center flex-1 relative z-10 h-full">
            <Link
              href="/dashboard/predict"
              id="mobile-nav-predict"
              aria-label="New Prediction"
              className="group relative flex flex-col items-center justify-center w-full h-full"
            >
              <div className={cn(
                "relative z-20 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform",
                isActive("/dashboard/predict")
                  ? "w-10 h-10 rounded-full bg-purple-600 dark:bg-purple-500 -translate-y-4 shadow-[0_8px_20px_rgba(109,40,217,0.3)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.5)] scale-110" 
                  : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
              )}>
                <TrendingUp
                  size={20}
                  className={isActive("/dashboard/predict") ? "text-white" : "text-gray-400 dark:text-zinc-500"}
                  strokeWidth={isActive("/dashboard/predict") ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                  isActive("/dashboard/predict")
                    ? "text-purple-600 dark:text-purple-400 opacity-100 translate-y-0"
                    : "text-gray-400 dark:text-zinc-500 opacity-0 translate-y-2"
                )}
              >
                Predict
              </span>
            </Link>
          </div>

          {RIGHT_ITEMS.map(({ href, icon: Icon, label, id }) => {
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
                    ? "w-10 h-10 rounded-full bg-purple-600 dark:bg-purple-500 -translate-y-4 shadow-[0_8px_20px_rgba(109,40,217,0.3)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.5)] scale-110" 
                    : "w-10 h-10 rounded-full bg-transparent translate-y-0 scale-100"
                )}>
                  <Icon
                    size={20}
                    className={active ? "text-white" : "text-gray-400 dark:text-zinc-500"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight transition-all duration-300 absolute bottom-1.5",
                    active
                      ? "text-purple-600 dark:text-purple-400 opacity-100 translate-y-0"
                      : "text-gray-400 dark:text-zinc-500 opacity-0 translate-y-2"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={onMenuToggle}
            id="mobile-nav-user-profile"
            aria-label="User profile menu"
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              {mobileOpen ? (
                <X size={22} className="text-purple-600 dark:text-purple-400" strokeWidth={2.2} />
              ) : (
                <div className={cn(
                  "relative rounded-full transition-all duration-300",
                  isProfileActive && "ring-2 ring-purple-600 dark:ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
                )}>
                  <Avatar className="h-7 w-7 border border-gray-100 dark:border-zinc-700 shadow-sm">
                    {profile?.profile_picture_url && (
                      <AvatarImage 
                        src={profile.profile_picture_url.startsWith("http") ? profile.profile_picture_url : `${process.env.NEXT_PUBLIC_API_URL || "https://finwatch-backend.onrender.com"}${profile.profile_picture_url}`} 
                      />
                    )}
                    <AvatarFallback className="bg-purple-50 dark:bg-purple-900/20 text-[10px] font-bold text-purple-600 dark:text-purple-300">
                      {profile?.full_name ? profile.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : <Loader2 size={12} className="animate-spin" />}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium leading-none truncate w-full text-center absolute bottom-1.5 transition-all duration-300",
                (mobileOpen || isProfileActive)
                  ? "text-purple-600 dark:text-purple-400 opacity-100 translate-y-0"
                  : "text-gray-400 dark:text-zinc-500 opacity-0 translate-y-2"
              )}
            >
              {mobileOpen 
                ? "Close" 
                : pathname === "/dashboard/settings" 
                  ? "Settings" 
                  : pathname === "/dashboard/reports" 
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
