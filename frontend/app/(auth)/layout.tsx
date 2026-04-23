/**
 * (auth)/layout.tsx
 *
 * Shared layout for all routes inside the (auth) route group
 * (i.e. /login and /register).
 *
 * Structure:
 *   ┌──────────────────────┬──────────────────────┐
 *   │   Form panel (white) │   Brand panel        │
 *   │   Left-aligned form  │   Diagonal gradient  │
 *   │   content via        │   near-black → purple│
 *   │   {children}         │   "FinWatch Zambia"  │
 *   │                      │   pinned to bottom   │
 *   └──────────────────────┴──────────────────────┘
 *
 * Responsive behaviour:
 *   - md+ : 50 / 50 split, both panels visible, full viewport height
 *   - <md  : right brand panel hidden; form panel fills the full screen
 */

import type { Metadata } from "next";
import AuthFeatureShowcase from "@/components/shared/AuthFeatureShowcase";

export const metadata: Metadata = {
  title: "FinWatch Zambia — Auth",
  description: "Sign in or create your FinWatch Zambia account.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen transition-colors duration-300">
      {/* ── Left — Form panel ───────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300">
        {children}
      </div>

      {/* ── Right — Brand panel ─────────────────────────────────────────── */}
      <div
        className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center bg-[#070010] overflow-hidden"
        aria-hidden="true"
      >
        {/* Background Mesh Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Primary Purple Blob */}
          <div 
            className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-primary/30 blur-[120px] animate-blob" 
          />
          
          {/* Emerald Green Blob — ensuring it's prominent */}
          <div 
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/25 blur-[100px] animate-blob [animation-delay:2s]" 
          />

          {/* Indigo/Blue Accent Blob */}
          <div 
            className="absolute top-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[110px] animate-blob [animation-delay:4s]" 
          />
        </div>

        {/* Content remains centered above blobs */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          {/* Main showcase animation */}
          <div className="flex-1 flex items-center justify-center">
            <AuthFeatureShowcase />
          </div>

          {/* Brand footer pinned to bottom */}
          <div className="flex flex-col items-center gap-1 text-center pb-16">
            <span className="text-3xl font-bold tracking-tight text-white">
              FinWatch Zambia
            </span>
            <span className="text-sm font-normal text-white/40">
              Professional Financial Monitoring
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
