/**
 * AuthLayout Component
 *
 * Provides a shared architectural frame for the authentication routes (Login and Registration).
 *
 */

import type { Metadata } from "next";
import Image from "next/image";
import AuthFeatureShowcase from "@/components/shared/AuthFeatureShowcase";

export const metadata: Metadata = {
  title: "FinWatch Zambia — Authenticate",
  description:
    "Secure access to the FinWatch Zambia financial monitoring platform.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen transition-colors duration-300">
      <section className="flex w-full flex-col items-center bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300 border-r border-gray-50 dark:border-zinc-900">
        <div className="w-full max-w-sm h-screen flex flex-col">{children}</div>
      </section>
      <aside
        className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center bg-zinc-50 dark:bg-[#070010] overflow-hidden transition-colors duration-300"
        aria-hidden="true"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Top Left - Primary Burst */}
          <div className="absolute top-[-10%] left-[-15%] w-[80%] h-[80%] rounded-full bg-purple-600/25 dark:bg-primary/45 blur-[120px] animate-blob-1 [animation-duration:18s] transform-gpu" />

          {/* Bottom Right - Emerald Pop */}
          <div className="absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] rounded-full bg-emerald-500/20 dark:bg-emerald-500/40 blur-[100px] animate-blob-2 [animation-delay:3s] [animation-duration:22s] transform-gpu" />

          {/* Top Right - Indigo Glow */}
          <div className="absolute top-[10%] right-[-5%] w-[60%] h-[60%] rounded-full bg-indigo-600/25 dark:bg-indigo-600/35 blur-[110px] animate-blob-3 [animation-delay:7s] [animation-duration:25s] transform-gpu" />

          {/* Middle Center - Deep Purple Contrast */}
          <div className="absolute top-[30%] left-[10%] w-[50%] h-[50%] rounded-full bg-purple-900/15 dark:bg-purple-900/30 blur-[130px] animate-blob-1 [animation-delay:11s] [animation-duration:30s] transform-gpu" />
        </div>
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          <AuthFeatureShowcase />

          {/* Persistent Brand Footer - Positioned Lower */}
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
          </div>
        </div>
      </aside>
    </div>
  );
}
