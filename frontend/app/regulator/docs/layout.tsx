"use client";

/**
 * FinWatch Zambia - Regulator Documentation Layout
 *
 * Provides a minimal shell for the institutional documentation system with Regulator auth protection.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { getRegToken, getRegUser } from "@/lib/regulator-auth";
import { DocsAIAssistant } from "@/components/docs/DocsAIAssistant";

export default function RegulatorDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getRegToken();
    const user: any = getRegUser();

    if (!token || !user) {
      router.replace("/regulator/auth/login");
      return;
    }

    if (user.role !== "regulator") {
      if (user.role === "sme_owner") {
        router.replace("/dashboard");
      } else if (user.role === "policy_analyst") {
        router.replace("/regulator"); // Analyst portal shares base route
      } else {
        router.replace("/regulator/auth/login");
      }
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] text-foreground selection:bg-emerald-100 dark:selection:bg-emerald-900/30">
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-[#fafafa]/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md px-4 sm:px-6">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/regulator/docs" className="flex items-center gap-3">
            <Image
              src={
                theme === "dark"
                  ? "/brand/dark_mode/FinWatch_Logo_Icon_dark_mode.svg"
                  : "/brand/light_mode/FinWatch_Logo_Icon_light_mode.svg"
              }
              alt="FinWatch Icon"
              width={32}
              height={32}
              priority
              className="object-contain"
            />
            <span className="text-xl font-normal tracking-tighter text-zinc-900 dark:text-zinc-100 uppercase">
              Docs
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 ml-1">
              Institutional
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/50 dark:bg-zinc-900/50 text-muted-foreground transition-all hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1">{children}</main>

      {/* Regulator Documentation AI Assistant (Emerald Variant) */}
      <DocsAIAssistant portalType="regulator" />

      {/* Minimal Footer */}
      <footer className="border-t border-border py-6 bg-white dark:bg-zinc-950/50 mt-6">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-8">
              <Link
                href="/regulator"
                className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <ArrowLeft
                  size={14}
                  className="opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0"
                />
                Back to Regulator Portal
              </Link>
              <Link
                href="/regulator/docs/faq"
                className="text-sm font-medium text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                FAQ
              </Link>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-bold tracking-tight">
              FinWatch &copy; 2026 &middot; Developed by David &amp; Denise
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
