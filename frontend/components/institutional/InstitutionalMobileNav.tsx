"use client";

/**
 * FinWatch Zambia - Institutional Mobile Navigation
 *
 * Floating, institutional black frosted glass design.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  AlertTriangle,
  FileText,
  Settings,
  MoreHorizontal,
  ChevronRight,
  MessageSquare,
  FileDown,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { clearInstitutionalToken } from "@/lib/institutional-auth";
import Image from "next/image";

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
  onExportOpen,
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

  const accentBase = isAnalyst ? "bg-blue-600" : "bg-emerald-600";
  const accentText = "text-white";
  const accentBg = isAnalyst ? "bg-blue-900/40" : "bg-emerald-900/40";

  const flyoutItems = [
    {
      id: "mobile-nav-trends",
      label: "Sector Trends",
      href: `${prefix}/trends`,
      icon: <TrendingUp size={18} />,
    },
    {
      id: "mobile-nav-insights",
      label: "Data Insights",
      href: `${prefix}/insights`,
      icon: <Activity size={18} />,
    },
    {
      id: "mobile-nav-anomalies",
      label: "Anomaly Detection",
      href: `${prefix}/anomalies`,
      icon: <AlertTriangle size={18} />,
    },
    {
      id: "mobile-nav-reports",
      label: "Reports",
      href: `${prefix}/reports`,
      icon: <FileText size={18} />,
    },
    {
      id: "mobile-nav-docs",
      label: "Documentation",
      href: isAnalyst
        ? "/institutional/docs/analyst"
        : "/institutional/docs/regulator",
      icon: <BookOpen size={18} />,
    },
  ];

  // Filter items based on role permissions
  const visibleFlyoutItems = flyoutItems.filter((item) => {
    if (isAnalyst && (item.id === "mobile-nav-anomalies" || item.id === "mobile-nav-reports")) return false;
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
          onClick={onMenuClose}
        />
      )}

      {/* Flyout Menu */}
      <div
        className={cn(
          "fixed left-4 right-4 bottom-28 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] z-[60] md:hidden transition-all duration-500 origin-bottom",
          mobileOpen
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-10 opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg",
                accentBase,
                accentText
              )}
            >
              {profile?.full_name?.[0] || (isAnalyst ? "A" : "R")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {profile?.full_name || (isAnalyst ? "Policy Analyst" : "Regulator")}
              </p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {isAnalyst ? "Policy Analyst" : "Regulator"}
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="grid grid-cols-1 gap-2">
            {visibleFlyoutItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onMenuClose}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl transition-all duration-300",
                    active
                      ? `${accentBg} border border-white/10`
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "transition-colors",
                        active ? (isAnalyst ? "text-blue-400" : "text-emerald-400") : "text-zinc-500"
                      )}
                    >
                      {item.icon}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold",
                        active ? "text-white" : "text-zinc-400"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  {active && (
                    <div className={isAnalyst ? "text-blue-400" : "text-emerald-400"}>
                      <ChevronRight size={16} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <Link
              href={`${prefix}/settings`}
              onClick={onMenuClose}
              className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              <Settings size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">
                Settings
              </span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <span className="text-xs font-bold uppercase tracking-widest">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-[65] md:hidden">
        <nav className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-2 flex items-center justify-around shadow-2xl">
          {/* Home / Dashboard */}
          <Link
            href={prefix}
            className={cn(
              "relative flex flex-col items-center gap-1 p-3 rounded-full transition-all duration-300",
              isActive(prefix) ? "flex-[1.5]" : "flex-1"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                isActive(prefix)
                  ? "bg-white text-emerald-600 scale-110"
                  : "text-zinc-500"
              )}
            >
              <LayoutDashboard size={20} />
            </div>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                isActive(prefix) ? "text-white opacity-100" : "opacity-0 h-0"
              )}
            >
              Home
            </span>
          </Link>

          {/* AI Assistant */}
          <button
            onClick={onOpenChat}
            className="flex-1 flex flex-col items-center gap-1 p-3 text-zinc-500 hover:text-zinc-300 transition-all"
          >
            <div className="p-2 rounded-full">
              <MessageSquare size={20} />
            </div>
          </button>

          {/* Export (Quick Action) */}
          {!isAnalyst && onExportOpen && (
            <button
              onClick={onExportOpen}
              className="flex-1 flex flex-col items-center gap-1 p-3 text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <div className="p-2 rounded-full">
                <FileDown size={20} />
              </div>
            </button>
          )}

          {/* Flyout Toggle */}
          <button
            onClick={onMenuToggle}
            className={cn(
              "relative flex flex-col items-center gap-1 p-3 rounded-full transition-all duration-300",
              mobileOpen ? "flex-[1.5]" : "flex-1"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                mobileOpen
                  ? "bg-white text-emerald-600 scale-110"
                  : "text-zinc-500"
              )}
            >
              <MoreHorizontal size={20} />
            </div>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                mobileOpen ? "text-white opacity-100" : "opacity-0 h-0"
              )}
            >
              {pathname === `${prefix}/settings`
                ? "Settings"
                : pathname === `${prefix}/reports`
                ? "Reports"
                : "Menu"}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
