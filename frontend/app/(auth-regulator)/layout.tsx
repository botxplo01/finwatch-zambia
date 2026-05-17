/**
 * RegulatorAuthLayout Component
 *
 * Provides a shared architectural frame for the regulator-specific authentication routes.
 * Emerald themed for institutional branding.
 */

import type { Metadata } from "next";
import Image from "next/image";
import RegulatorFeatureShowcase from "@/components/regulator/RegulatorFeatureShowcase";

export const metadata: Metadata = {
  title: "FinWatch Zambia — Institutional Access",
  description:
    "Secure access to the FinWatch Zambia regulator and policy analyst portal.",
};

export default function RegulatorAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen transition-colors duration-300">
      {/* Section: Form Interaction Area */}
      <section className="flex w-full flex-col items-center justify-start pt-10 md:pt-32 bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300 border-r border-gray-50 dark:border-zinc-900">
        <div className="w-full max-w-sm">{children}</div>
      </section>

      {/* Section: Visual Identity & Brand Showcase - Emerald/Blue themed */}
      <aside
        className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center bg-emerald-50/30 dark:bg-[#000a06] overflow-hidden transition-colors duration-300"
        aria-hidden="true"
      >
        {/* Layer 1: Generative Background Mesh - Emerald/Blue focused */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Top Left - Emerald Burst */}
          <div className="absolute top-[-10%] left-[-15%] w-[85%] h-[85%] rounded-full bg-emerald-600/10 dark:bg-emerald-600/45 blur-[120px] animate-blob-erratic-1" />

          {/* Bottom Right - Blue Pop */}
          <div className="absolute bottom-[-15%] right-[-10%] w-[75%] h-[75%] rounded-full bg-blue-600/10 dark:bg-blue-600/40 blur-[100px] animate-blob-erratic-2 [animation-delay:2s]" />

          {/* Top Right - Soft Emerald Glow */}
          <div className="absolute top-[10%] right-[-5%] w-[65%] h-[65%] rounded-full bg-emerald-500/10 dark:bg-emerald-500/35 blur-[110px] animate-blob-erratic-3 [animation-delay:4s]" />

          {/* Center - Blue Depth */}
          <div className="absolute top-[30%] left-[10%] w-[55%] h-[55%] rounded-full bg-blue-900/10 dark:bg-blue-900/40 blur-[130px] animate-blob-erratic-1 [animation-delay:6s]" />
        </div>

        {/* Layer 2: Feature Illustration & Content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          <RegulatorFeatureShowcase />

          {/* Persistent Brand Footer */}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-1 text-center">
            <Image
              src="/brand/dark_mode/FinWatch_Logo_Main_dark_mode.svg"
              alt="FinWatch Zambia Logo"
              width={260}
              height={52}
              priority
              className="opacity-80"
            />
            <p className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-[0.2em] mt-2">
              Institutional Command Center
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
