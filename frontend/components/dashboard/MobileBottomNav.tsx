"use client";

/**
 * FinWatch Zambia - Dashboard Mobile Bottom Navigation
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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
  { href: "/dashboard", icon: LayoutDashboard, label: "Home", id: "mobile-nav-overview" },
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

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-end justify-between
      bg-white/80 dark:bg-black/80 backdrop-blur-xl
      border-t border-gray-200/50 dark:border-zinc-800/50
      shadow-[0_-8px_32px_rgba(0,0,0,0.1)]
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
              className="group relative flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
            >
              <Icon
                size={22}
                className={
                  active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none truncate w-full text-center ${
                  active
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-400 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full origin-center animate-[expand-horizontal_0.4s_ease-out]" />
              )}
            </Link>
          );
        })}

        <div className="flex flex-col items-center flex-1 relative z-10" style={{ marginTop: "-18px" }}>
          <Link
            href="/dashboard/predict"
            id="mobile-nav-predict"
            aria-label="New Prediction"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg
            transition-all duration-200 active:scale-95
            ${
              isActive("/dashboard/predict")
                ? "bg-purple-800 dark:bg-purple-700 shadow-purple-300/50 dark:shadow-purple-950/50"
                : "bg-purple-700 dark:bg-purple-600 hover:bg-purple-800 dark:hover:bg-purple-500 shadow-purple-200/50 dark:shadow-purple-950/50"
            }`}
          >
            <TrendingUp size={24} className="text-white" strokeWidth={2.5} />
          </Link>
          <span
            className={`text-[10px] font-bold leading-none mt-2 ${
              isActive("/dashboard/predict")
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-400 dark:text-zinc-500"
            }`}
          >
            Predict
          </span>
        </div>

        {RIGHT_ITEMS.map(({ href, icon: Icon, label, id }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              id={id}
              className="group relative flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
            >
              <Icon
                size={22}
                className={
                  active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium leading-none truncate w-full text-center ${
                  active
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-400 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full origin-center animate-[expand-horizontal_0.4s_ease-out]" />
              )}
            </Link>
          );
        })}

        <button
          onClick={onMenuToggle}
          id="mobile-nav-user-profile"
          aria-label="User profile menu"
          className="flex flex-col items-center gap-1.5 pt-3 pb-1 flex-1 min-w-0"
        >
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
          <span
            className={`text-[10px] font-medium leading-none truncate w-full text-center ${
              mobileOpen ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
            }`}
          >
            {mobileOpen ? "Close" : "Profile"}
          </span>
        </button>
      </nav>
    </>
  );
}
