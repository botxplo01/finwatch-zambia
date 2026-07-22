"use client";

/**
 * FinWatch Zambia - Institutional Sidebar
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
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
  BookOpen,
  PanelLeft,
  Cpu,
} from "lucide-react";
import { UserNav } from "@/components/shared/UserNav";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string;
}

export function SidebarContent({
  collapsed = false,
  onToggleCollapse,
  userRole,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  userRole: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const expanded = !collapsed;

  const isAnalyst = userRole === "policy_analyst";
  const activeBg = isAnalyst ? "bg-blue-900/40" : "bg-emerald-900/40";
  const activeText = isAnalyst ? "text-blue-400" : "text-emerald-400";
  const navActiveText = "text-white";
  const activeBorder = isAnalyst ? "bg-blue-500" : "bg-emerald-500";

  const sidebarBg = isAnalyst ? "bg-[#050b1a]/90" : "bg-[#020d0a]/90";
  const sidebarBorder = isAnalyst
    ? "border-blue-900/20"
    : "border-emerald-900/20";

  const prefix = isAnalyst ? "/analyst" : "/regulator";
  const docsHref = isAnalyst
    ? "/analyst/docs"
    : "/regulator/docs";
  const docsActive = pathname === docsHref;

  const navItems = [
    {
      href: `${prefix}`,
      icon: LayoutDashboard,
      label: "Overview",
      id: "nav-overview",
    },
    {
      href: `${prefix}/trends`,
      icon: TrendingUp,
      label: "Trends",
      id: "nav-trends",
    },
    {
      href: `${prefix}/insights`,
      icon: BarChart3,
      label: "Sector Insights",
      id: "nav-insights",
    },
    {
      href: `${prefix}/anomalies`,
      icon: ShieldCheck,
      label: "Anomalies",
      id: "nav-anomalies",
    },
    {
      href: `${prefix}/model-analytics`,
      icon: Cpu,
      label: "Model Analytics",
      id: "nav-model-analytics",
    },
    {
      href: `${prefix}/reports`,
      icon: FileBarChart,
      label: "Reports",
      id: "nav-reports",
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (isAnalyst && item.id === "nav-anomalies") return false;
    return true;
  });

  return (
    <div
      className={cn(
        "relative flex flex-col h-full backdrop-blur-xl border-r transition-all duration-300 shadow-sm",
        sidebarBg,
        sidebarBorder
      )}
    >
      {/* Logo Section */}
      <div
        className={cn(
          "flex flex-col items-start px-5 py-5 mb-2 border-b",
          isAnalyst ? "border-blue-900/10" : "border-emerald-900/10",
          !expanded ? "items-center px-2" : ""
        )}
      >
        <Link href={prefix} className="flex flex-col items-start gap-0">
          <Image
            src={
              expanded
                ? "/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
                : "/brand/dark_mode/FinWatch_Logo_Icon_dark_mode.svg"
            }
            alt="FinWatch Logo"
            width={expanded ? 270 : 32}
            height={expanded ? 150 : 32}
            priority
            className="object-contain opacity-90"
          />
          {expanded && (
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em] -mt-2 ml-0.5 leading-none",
                activeText
              )}
            >
              {isAnalyst ? "Policy Analyst Portal" : "Regulator Portal"}
            </p>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              title={!expanded ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${!expanded ? "justify-center" : ""}
                ${
                  active
                    ? `${activeBg} ${navActiveText} font-bold`
                    : "text-zinc-100 hover:bg-white/10 hover:text-white"
                }`}
            >
              {active && (
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${activeBorder} rounded-r-full`}
                />
              )}
              <Icon
                size={active ? 20 : 18}
                className={`flex-shrink-0 transition-colors ${
                  active ? navActiveText : "text-zinc-300 group-hover:text-white"
                }`}
              />
              {expanded && <span className="text-sm truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "px-3 py-2 border-t",
          isAnalyst ? "border-blue-900/10" : "border-emerald-900/10"
        )}
      >
        <Link
          href={docsHref}
          id="nav-docs"
          title={!expanded ? "Documentation" : undefined}
          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${!expanded ? "justify-center" : ""}
                ${
                  docsActive
                    ? `${activeBg} ${activeText} font-semibold`
                    : "text-zinc-100 hover:bg-white/10 hover:text-white"
                }`}
        >
          {docsActive && (
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${activeBorder} rounded-r-full`}
            />
          )}
          <BookOpen
            size={18}
            className={`flex-shrink-0 transition-colors ${
              docsActive ? activeText : "text-zinc-300 group-hover:text-white"
            }`}
          />
          {expanded && <span className="text-sm truncate">Documentation</span>}
        </Link>
      </div>

      {/* User Info Section */}
      <UserNav collapsed={collapsed} portal="institutional" onNavigate={onNavigate} />

      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className={cn(
            "absolute -right-3 top-8 w-6 h-6 rounded-full border transition-all z-[40] shadow-md flex items-center justify-center text-zinc-300 hover:text-white",
            isAnalyst
              ? "bg-[#050b1a] border-blue-900/30"
              : "bg-[#020d0a] border-emerald-900/30"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={12} className={cn("transition-transform duration-300 ease-in-out", collapsed && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

export function InstitutionalSidebar({
  collapsed,
  onToggleCollapse,
  userRole,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string;
}) {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out relative z-[45]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        userRole={userRole}
      />
    </aside>
  );
}
