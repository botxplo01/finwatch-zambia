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
    <div className="flex min-h-screen">
      {/* ── Left — Form panel ───────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-8 md:w-1/2 md:px-16">
        {children}
      </div>

      {/* ── Right — Brand panel ─────────────────────────────────────────── */}
      <div
        className={[
          "relative hidden md:flex md:w-1/2",
          "flex-col items-center justify-center",
          "bg-gradient-to-tr from-[#070010] via-[#3d0d9a] to-[#8b5cf6]",
        ].join(" ")}
        aria-hidden="true"
      >
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
  );
}
