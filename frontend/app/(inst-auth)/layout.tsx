"use client";

/**
 * InstitutionalAuthLayout Component
 *
 * Provides a shared architectural frame for the institutional authentication routes.
 * Now with dynamic accent color support for Regulator (Emerald) and Analyst (Blue).
 */

import Image from "next/image";
import { usePathname } from "next/navigation";
import InstitutionalFeatureShowcase from "@/components/institutional/InstitutionalFeatureShowcase";
import { AuthAccentProvider, useAuthAccent } from "@/context/AuthAccentContext";
import { cn } from "@/lib/utils";

function InstitutionalAuthLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accent } = useAuthAccent();
  const pathname = usePathname();
  const isLoginPage = pathname === "/institutional/auth/login";

  return (
    <div className="flex min-h-screen transition-colors duration-300">
      {/* Section: Form Interaction Area */}
      <section className="flex w-full flex-col items-center bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300 border-r border-gray-50 dark:border-zinc-900">
        <div className="w-full max-w-sm h-screen flex flex-col">{children}</div>
      </section>

      {/* Section: Visual Identity & Brand Showcase - Dynamic themed */}
      <aside
        className={cn(
          "relative hidden md:flex md:w-1/2 flex-col items-center justify-center overflow-hidden transition-colors duration-500",
          accent === "blue"
            ? "bg-blue-50/30 dark:bg-[#00060a]"
            : "bg-emerald-50/30 dark:bg-[#000a06]"
        )}
        aria-hidden="true"
      >
        {/* Layer 1: Generative Background Mesh - Dynamic Colors */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Top Left - Primary Burst */}
          <div
            className={cn(
              "absolute top-[-10%] left-[-15%] w-[80%] h-[80%] rounded-full blur-[120px] animate-blob-1 duration-[18s] transform-gpu",
              isLoginPage
                ? "bg-black/40 dark:bg-white/20"
                : accent === "blue"
                ? "bg-blue-600/30 dark:bg-blue-600/45"
                : "bg-emerald-600/25 dark:bg-emerald-600/45"
            )}
          />

          {/* Bottom Right - Secondary Pop */}
          <div
            className={cn(
              "absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[100px] animate-blob-2 duration-[22s] [animation-delay:3s] transform-gpu",
              isLoginPage
                ? "bg-zinc-700/25 dark:bg-zinc-300/20"
                : accent === "blue"
                ? "bg-emerald-500/20 dark:bg-emerald-500/40"
                : "bg-blue-600/25 dark:bg-blue-600/40"
            )}
          />

          {/* Top Right - Soft Glow */}
          <div
            className={cn(
              "absolute top-[10%] right-[-5%] w-[60%] h-[60%] rounded-full blur-[110px] animate-blob-3 duration-[25s] [animation-delay:7s] transform-gpu",
              isLoginPage
                ? "bg-zinc-500/20 dark:bg-zinc-200/20"
                : accent === "blue"
                ? "bg-blue-500/25 dark:bg-blue-500/35"
                : "bg-emerald-500/20 dark:bg-emerald-500/35"
            )}
          />

          {/* Center - Depth */}
          <div
            className={cn(
              "absolute top-[30%] left-[10%] w-[50%] h-[50%] rounded-full blur-[130px] animate-blob-1 duration-[30s] [animation-delay:11s] transform-gpu",
              isLoginPage
                ? "bg-zinc-800/15 dark:bg-zinc-400/20"
                : accent === "blue"
                ? "bg-emerald-900/15 dark:bg-emerald-900/40"
                : "bg-blue-900/15 dark:bg-blue-900/40"
            )}
          />
        </div>

        {/* Layer 2: Feature Illustration & Content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          <InstitutionalFeatureShowcase />

          {/* Persistent Brand Footer */}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-1 text-center px-4">
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch Zambia Logo"
              width={260}
              height={52}
              priority
              className="hidden dark:block opacity-80"
            />
            <Image
              src="/brand/light_mode/FinWatch_Logo_Main_light_mode.svg"
              alt="FinWatch Zambia Logo"
              width={260}
              height={52}
              priority
              className="block dark:hidden opacity-80"
            />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 transition-colors duration-500 text-gray-500 dark:text-zinc-500"
            >
              Institutional Command Center
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function InstitutionalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthAccentProvider>
      <InstitutionalAuthLayoutContent>{children}</InstitutionalAuthLayoutContent>
    </AuthAccentProvider>
  );
}
