"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Home, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtmosphericBackground } from "@/components/shared/AtmosphericBackground";

export default function UnauthorizedPage() {
  const router = useRouter();

  const handleReturn = () => {
    // Determine where to return based on current URL or history
    // For safety, go to the appropriate login
    if (window.location.href.includes("institutional")) {
      router.push("/institutional/auth/login");
    } else {
      router.push("/sme/auth/login");
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 relative overflow-hidden">
      <AtmosphericBackground portal="sme" />

      <div className="relative z-10 w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
            <div className="relative h-24 w-24 rounded-3xl bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/30 flex items-center justify-center shadow-2xl">
              <ShieldAlert size={48} className="text-red-500" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-light text-gray-900 dark:text-zinc-100 mb-4">
          Access <span className="font-bold">Restricted</span>
        </h1>

        <p className="text-gray-500 dark:text-zinc-400 mb-10 leading-relaxed">
          Your account does not have permission to access this portal. Please
          ensure you are logged into the correct gateway for your role.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleReturn}
            className="h-14 w-full rounded-full bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-lg transition-all active:scale-[0.98]"
          >
            <ArrowLeft size={18} className="mr-2" /> Return to Login
          </Button>

          <button
            onClick={() => router.push("/")}
            className="h-12 w-full rounded-full border border-gray-100 dark:border-zinc-800 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
          >
            Go to Homepage
          </button>
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 text-gray-300 dark:text-zinc-700">
          <UserCircle size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Identity Governance Enforced
          </span>
        </div>
      </div>
    </div>
  );
}
