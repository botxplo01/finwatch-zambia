"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  History,
  Menu,
} from "lucide-react";

// Primary nav items — 4 items + 1 center action
const LEFT_ITEMS = [
  { href: "/dashboard",           icon: LayoutDashboard, label: "Home"      },
  { href: "/dashboard/companies", icon: Building2,       label: "Companies" },
];

const RIGHT_ITEMS = [
  { href: "/dashboard/history", icon: History, label: "History" },
];

interface Props {
  onMenuOpen: () => void;
}

export function MobileBottomNav({ onMenuOpen }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-end justify-around
      bg-white dark:bg-zinc-900
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
              className={active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span
              className={`text-[10px] font-medium leading-none ${
                active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}

      {/* ── Centre raised action button — New Prediction ── */}
      <div className="flex flex-col items-center flex-1 relative" style={{ marginTop: "-20px" }}>
        <Link
          href="/dashboard/predict"
          aria-label="New Prediction"
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg
            transition-all duration-200 active:scale-95
            ${isActive("/dashboard/predict")
              ? "bg-purple-700 dark:bg-purple-600 shadow-purple-300/50 dark:shadow-purple-900/50"
              : "bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-400 shadow-purple-200/50 dark:shadow-purple-900/50"
            }`}
        >
          <TrendingUp size={22} className="text-white" strokeWidth={2} />
        </Link>
        <span
          className={`text-[10px] font-medium leading-none mt-1.5 ${
            isActive("/dashboard/predict") ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
          }`}
        >
          Predict
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
              className={active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span
              className={`text-[10px] font-medium leading-none ${
                active ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-zinc-500"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}

      {/* ── Hamburger — opens slide drawer for Reports, Settings, etc. ── */}
      <button
        onClick={onMenuOpen}
        aria-label="More options"
        className="flex flex-col items-center gap-1 pt-3 pb-1 px-3 min-w-[56px] flex-1"
      >
        <Menu
          size={22}
          className="text-gray-400 dark:text-zinc-500"
          strokeWidth={1.8}
        />
        <span className="text-[10px] font-medium leading-none text-gray-400 dark:text-zinc-500">
          Menu
        </span>
      </button>
    </nav>
  );
}
