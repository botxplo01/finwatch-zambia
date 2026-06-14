"use client";

/**
 * FinWatch Zambia - Dashboard Sidebar
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  History,
  FileBarChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { UserNav } from "@/components/shared/UserNav";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/sme",
    icon: LayoutDashboard,
    label: "Overview",
    id: "nav-overview",
  },
  {
    href: "/sme/companies",
    icon: Building2,
    label: "Companies",
    id: "nav-companies",
  },
  {
    href: "/sme/predict",
    icon: TrendingUp,
    label: "Predictions",
    id: "nav-predict",
  },
  {
    href: "/sme/history",
    icon: History,
    label: "History",
    id: "nav-history",
  },
  {
    href: "/sme/reports",
    icon: FileBarChart,
    label: "Reports",
    id: "nav-reports",
  },
];

function SidebarContent({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const expanded = !collapsed;
  const docsActive = pathname.startsWith("/sme/docs");

  return (
    <div className="relative flex h-full flex-col bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-r border-gray-100/50 dark:border-zinc-800/50 transition-all duration-300 shadow-sm">
      <div
        className={`flex flex-col items-start px-5 py-5 mb-2 border-b border-gray-50 dark:border-zinc-800/50 ${
          !expanded ? "items-center px-2" : ""
        }`}
      >
        <Link href="/sme" className="flex flex-col items-start gap-0">
          <Image
            src={
              theme === "dark"
                ? expanded
                  ? "/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
                  : "/brand/dark_mode/FinWatch_Logo_Icon_dark_mode.svg"
                : expanded
                ? "/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
                : "/brand/light_mode/FinWatch_Logo_Icon_light_mode.svg"
            }
            alt="FinWatch Logo"
            width={expanded ? 270 : 100}
            height={expanded ? 150 : 100}
            priority
            className="object-contain"
          />
          {expanded && (
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-widest -mt-2 ml-0.5">
              SME Portal
            </p>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={id}
              title={!expanded ? label : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? "bg-zinc-100 dark:bg-purple-900/20 text-zinc-900 dark:text-white font-bold"
                  : "text-gray-500 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
              } ${!expanded ? "justify-center" : ""}`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-zinc-900 dark:bg-purple-600 rounded-r-full" />
              )}
              <Icon
                size={active ? 20 : 18}
                className={`flex-shrink-0 transition-colors ${
                  active
                    ? "text-zinc-900 dark:text-white"
                    : "group-hover:text-gray-900 dark:group-hover:text-white"
                }`}
              />
              {expanded && <span className="text-sm truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-2 border-t border-gray-50 dark:border-zinc-800/50">
        <Link
          href="/sme/docs"
          id="nav-docs"
          title={!expanded ? "Documentation" : undefined}
          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
            docsActive
              ? "bg-zinc-100 dark:bg-purple-900/20 text-zinc-900 dark:text-purple-300 font-semibold"
              : "text-gray-500 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
          } ${!expanded ? "justify-center" : ""}`}
        >
          {docsActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-zinc-900 dark:bg-purple-600 rounded-r-full" />
          )}
          <BookOpen
            size={18}
            className={`flex-shrink-0 transition-colors ${
              docsActive
                ? "text-zinc-900 dark:text-purple-300"
                : "group-hover:text-gray-900 dark:group-hover:text-white"
            }`}
          />
          {expanded && <span className="text-sm truncate">Documentation</span>}
        </Link>
      </div>

      <UserNav collapsed={collapsed} portal="sme" />

      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-sm transition-all z-[40]"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
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
      />
    </aside>
  );
}
