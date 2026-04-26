/**
 * AuthLayout Component
 * 
 * Provides a shared architectural frame for the authentication routes (Login and Registration).
 * 
 * Design Pattern: Split-Panel Layout
 * - Left Panel: Primary interaction area for user authentication forms.
 * - Right Panel: Immersive brand showcase with dynamic mesh gradients and feature highlights.
 * 
 * Responsive Strategy:
 * - Desktop (md+): Balanced 50/50 split ensuring high visual impact.
 * - Mobile (<md): Context-aware collapse where the brand panel is hidden to prioritize form usability.
 */

import type { Metadata } from "next";
import AuthFeatureShowcase from "@/components/shared/AuthFeatureShowcase";

export const metadata: Metadata = {
  title: "FinWatch Zambia — Authenticate",
  description: "Secure access to the FinWatch Zambia financial monitoring platform.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen transition-colors duration-300">
      
      {/* ── Section: Form Interaction Area ──────────────────────────────── */}
      <section className="flex w-full flex-col items-center justify-center bg-white dark:bg-zinc-950 px-8 md:w-1/2 md:px-16 transition-colors duration-300 border-r border-gray-50 dark:border-zinc-900">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </section>

      {/* ── Section: Visual Identity & Brand Showcase ────────────────────── */}
      <aside
        className="relative hidden md:flex md:w-1/2 flex-col items-center justify-center bg-[#070010] overflow-hidden"
        aria-hidden="true"
      >
        {/* Layer 1: Generative Background Mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Brand Accents — using high-radius blurs to create depth without affecting performance */}
          <div 
            className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-primary/30 blur-[120px] animate-blob" 
          />
          
          <div 
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/25 blur-[100px] animate-blob [animation-delay:2s]" 
          />

          <div 
            className="absolute top-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[110px] animate-blob [animation-delay:4s]" 
          />
        </div>

        {/* Layer 2: Feature Illustration & Content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          {/* Centered feature carousel/illustration */}
          <div className="flex-1 flex items-center justify-center">
            <AuthFeatureShowcase />
          </div>

          {/* Persistent Brand Footer */}
          <div className="flex flex-col items-center gap-1 text-center pb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              FinWatch Zambia
            </h2>
            <p className="text-sm font-normal text-white/40 uppercase tracking-widest">
              Financial Risk Intelligence
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
