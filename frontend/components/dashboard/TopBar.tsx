"use client";

import { useState, useEffect } from "react";
import { Bell, MessageSquare, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { NLPChatModal } from "./NLPChatModal";

// Map pathnames to human-readable breadcrumbs
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
  const pathname = usePathname();
  const crumbs = BREADCRUMB_MAP[pathname] ?? ["Home"];

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserName(parsed.full_name?.split(" ")[0] ?? "");
      }
    } catch {
      // no-op
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
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 z-10">
        {/* Left — breadcrumb + greeting */}
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} className="text-gray-300" />}
                <span
                  className={
                    i === crumbs.length - 1
                      ? "text-purple-600 font-medium"
                      : "text-gray-400"
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          {/* Greeting */}
          <p className="text-sm font-semibold text-gray-800">
            {getGreeting()}
            {userName ? `, ${userName}` : ""}
          </p>
          <p className="text-[11px] text-gray-400 leading-none">{today}</p>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            aria-label="Notifications"
            className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-purple-600 rounded-full" />
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white rounded-xl transition-all duration-200 hover:opacity-90 active:scale-95 shadow-sm"
            style={{
              background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
            }}
          >
            <MessageSquare size={14} />
            <span>AI Assistant</span>
          </button>
        </div>
      </header>

      <NLPChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
