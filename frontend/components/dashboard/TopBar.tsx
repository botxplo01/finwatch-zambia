"use client";

import { useState, useEffect } from "react";
import { Bell, MessageSquare, ChevronRight, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { NLPChatModal } from "./NLPChatModal";

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/dashboard": ["Home"],
  "/dashboard/companies": ["Home", "Companies"],
  "/dashboard/predict": ["Home", "New Prediction"],
  "/dashboard/history": ["Home", "History"],
  "/dashboard/reports": ["Home", "Reports"],
  "/dashboard/settings": ["Home", "Settings"],
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TopBar() {
  const [chatOpen, setChatOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const crumbs = BREADCRUMB_MAP[pathname] ?? ["Home"];
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserName(parsed.full_name?.split(" ")[0] ?? "");
      }
    } catch {
      /* no-op */
    }
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10">
        {/* Left — breadcrumb + greeting */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 mb-0.5">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    size={10}
                    className="text-gray-300 dark:text-zinc-600"
                  />
                )}
                <span
                  className={
                    i === crumbs.length - 1 ? "text-purple-600 font-medium" : ""
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
            {getGreeting()}
            {userName ? `, ${userName}` : ""}
          </p>
          <p className="hidden sm:block text-[11px] text-gray-400 dark:text-zinc-500 leading-none">
            {today}
          </p>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}

          {/* Notification bell */}
          <button
            aria-label="Notifications"
            className="relative p-2 rounded-xl text-gray-400 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
          >
            <Bell size={17} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-purple-600 rounded-full" />
          </button>

          {/* AI Assistant — icon-only on mobile, icon+label on desktop */}
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Open AI Assistant"
            className="flex items-center gap-2 text-white rounded-xl transition-all duration-200 hover:opacity-90 active:scale-95 shadow-sm p-2 md:px-3.5 md:py-2"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
          >
            <MessageSquare size={15} />
            <span className="hidden md:block text-sm font-medium">
              AI Assistant
            </span>
          </button>
        </div>
      </header>

      <NLPChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
