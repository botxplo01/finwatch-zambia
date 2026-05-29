"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, isTokenExpired, restoreSessionFromNative } from "@/lib/auth";
import { getRegToken, getRegUser, restoreRegSessionFromNative } from "@/lib/regulator-auth";
import { Capacitor } from "@capacitor/core";

/**
 * Root page serving as the platform router.
 * Inspects local and native storage for valid, unexpired sessions
 * and routes users directly to their respective portals (SME or Institutional)
 * with a premium glassmorphic loading experience during verification.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const checkRedirect = async () => {
      try {
        // 1. Restore native session if running inside native shell
        if (Capacitor.isNativePlatform()) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await restoreSessionFromNative();
          await restoreRegSessionFromNative();
        }

        if (!active) return;

        // 2. Route based on active, unexpired SME session
        const smeToken = getToken();
        const smeUser = getUser<any>();
        if (smeToken && smeUser && !isTokenExpired(smeToken) && smeUser.portal_type === "sme") {
          router.replace("/sme");
          return;
        }

        // 3. Route based on active, unexpired Regulator/Analyst session
        const regToken = getRegToken();
        const regUser = getRegUser<any>();
        if (regToken && regUser && !isTokenExpired(regToken) && regUser.portal_type === "institutional") {
          router.replace("/institutional");
          return;
        }

        // 4. Default to SME Login if no active session is found
        router.replace("/sme/auth/login");
      } catch (err) {
        console.error("Critical error in RootPage session router:", err);
        if (active) {
          router.replace("/sme/auth/login");
        }
      }
    };

    checkRedirect();

    // 5. Fallback timer - ensures we never get stuck on "Securing session..." under any condition
    const fallbackTimer = setTimeout(() => {
      if (active) {
        console.warn("Root redirect process timed out. Routing to fallback login.");
        router.replace("/sme/auth/login");
      }
    }, 3500);

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
      {/* Decorative premium dark ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/10 dark:bg-purple-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-900/10 dark:bg-emerald-950/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Loading state indicator */}
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400 font-medium tracking-wide">
          Securing session…
        </p>
      </div>
    </div>
  );
}
