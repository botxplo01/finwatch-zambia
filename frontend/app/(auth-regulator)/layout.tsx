"use client";

/**
 * RegulatorAuthLayout Component
 *
 * Provides a shared architectural frame for the regulator-specific authentication routes.
 * Emerald themed for institutional branding, now with dynamic accent color support.
 */

import Image from "next/image";
import RegulatorFeatureShowcase from "@/components/regulator/RegulatorFeatureShowcase";
import { AuthAccentProvider, useAuthAccent } from "@/context/AuthAccentContext";
import { cn } from "@/lib/utils";

function RegulatorAuthLayoutContent({ children }: { children: React.ReactNode }) {
  const { accent } = useAuthAccent();

  return (
    <div className="flex min-h-screen transition-colors duration-300">
      {/* Section: Form Interaction Area */}
      <section className="flex w-full flex-col items-center bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300 border-r border-gray-50 dark:border-zinc-900">
        <div className="w-full max-w-sm h-screen flex flex-col">{children}</div>
      </section>

      {/* Section: Visual Identity & Brand Showcase - Emerald/Blue themed */}
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
          <div className={cn(
            "absolute top-[-10%] left-[-15%] w-[80%] h-[80%] rounded-full blur-[120px] animate-blob-1 transform-gpu",
            accent === "blue" 
              ? "bg-blue-600/20 dark:bg-blue-600/45" 
              : "bg-emerald-600/20 dark:bg-emerald-600/45"
          )} />

          {/* Bottom Right - Secondary Pop */}
          <div className={cn(
            "absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[100px] animate-blob-2 [animation-delay:2s] transform-gpu",
            accent === "blue" 
              ? "bg-emerald-500/15 dark:bg-emerald-500/40" 
              : "bg-blue-600/15 dark:bg-blue-600/40"
          )} />

          {/* Top Right - Soft Glow */}
          <div className={cn(
            "absolute top-[10%] right-[-5%] w-[60%] h-[60%] rounded-full blur-[110px] animate-blob-3 [animation-delay:4s] transform-gpu",
            accent === "blue" 
              ? "bg-blue-500/15 dark:bg-blue-500/35" 
              : "bg-emerald-500/15 dark:bg-emerald-500/35"
          )} />

          {/* Center - Depth */}
          <div className={cn(
            "absolute top-[30%] left-[10%] w-[50%] h-[50%] rounded-full blur-[130px] animate-blob-1 [animation-delay:6s] transform-gpu",
            accent === "blue" 
              ? "bg-emerald-900/10 dark:bg-emerald-900/40" 
              : "bg-blue-900/10 dark:bg-blue-900/40"
          )} />
        </div>

        {/* Layer 2: Feature Illustration & Content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          <RegulatorFeatureShowcase />

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
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-[0.2em] mt-2 transition-colors duration-500",
              accent === "blue" 
                ? "text-blue-600/60 dark:text-blue-500/50" 
                : "text-emerald-600/60 dark:text-emerald-500/50"
            )}>
              Institutional Command Center
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function RegulatorAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthAccentProvider>
      <RegulatorAuthLayoutContent>{children}</RegulatorAuthLayoutContent>
    </AuthAccentProvider>
  );
}
