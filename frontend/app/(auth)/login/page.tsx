"use client";

/**
 * FinWatch Zambia - Login Page
 *
 * Login form with role-aware redirect. Supports SME owner and regulator roles.
 * Includes auto-wake mechanism for Render Free Tier and role-based routing.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { loginUser, fetchCurrentUser, setToken, setUser, clearToken } from "@/lib/auth";
import { setRegToken, setRegUser, clearRegToken } from "@/lib/regulator-auth";
import api from "@/lib/api";
import { Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";

type WakingStatus = "idle" | "waking" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [wakingStatus, setWakingStatus] = useState<WakingStatus>("idle");

  // Auto-Wake mechanism for Render Free Tier
  useEffect(() => {
    const wakeup = async () => {
      try {
        setWakingStatus("waking");
        await api.get("/health");
        setWakingStatus("success");
        // Clear the success message after 3 seconds
        setTimeout(() => setWakingStatus("idle"), 3000);
      } catch (err) {
        setWakingStatus("error");
      }
    };
    wakeup();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const tokenData = await loginUser({
        username: identifier.trim(),
        password: password.trim(),
      });

      const token = tokenData.access_token;

      let userRole = "sme_owner";
      try {
        const user = await fetchCurrentUser(token);
        
        if (user.role === "sme_owner") {
          setToken(token);
          setUser(user);
          clearRegToken();
          userRole = "sme_owner";
        } else {
          setRegToken(token);
          setRegUser(user);
          clearToken();
          userRole = user.role;
        }
      } catch (profileErr) {
        console.error("Profile fetch failed during login:", profileErr);
        setToken(token);
        clearRegToken();
        userRole = "sme_owner";
      }

      if (userRole === "sme_owner") {
        router.push("/dashboard");
      } else {
        router.push("/regulator");
      }
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 400) {
        setError("Invalid username or password. Please try again.");
      } else if (status === 422) {
        setError("Please check your input and try again.");
      } else {
        setError(
          "Unable to connect to the server. Make sure the backend is running.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col">
      {/* Mobile-only Header */}
      <div className="mb-10 md:hidden text-center w-full">
        <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-emerald-500 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
          FinWatch Zambia
        </h2>
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl">
        Sign in to your account
      </h1>

      <form onSubmit={handleSignIn} className="mt-10 flex flex-col">
        {/* Compact Dynamic Connection Status */}
        {wakingStatus !== "idle" && (
          <div 
            className={`mb-6 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500 animate-in fade-in slide-in-from-top-2
              ${wakingStatus === "waking" ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400" : ""}
              ${wakingStatus === "success" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400" : ""}
              ${wakingStatus === "error" ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400" : ""}
            `}
          >
            {wakingStatus === "waking" && <Zap size={12} className="animate-pulse" />}
            {wakingStatus === "success" && <CheckCircle2 size={12} />}
            {wakingStatus === "error" && <AlertCircle size={12} />}
            
            <p className="text-[10px] font-bold uppercase tracking-tight">
              {wakingStatus === "waking" && "Initializing secure connection... please wait"}
              {wakingStatus === "success" && "Connection established"}
              {wakingStatus === "error" && "Connection failed. Please try again later."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <FloatingLabelInput
            id="identifier"
            label="Email Address"
            type="email"
            autoComplete="email"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (error) setError("");
            }}
            aria-required="true"
          />

          <FloatingLabelInput
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            aria-required="true"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}

        <div className="mt-12 flex w-full flex-col items-center">
          <Button
            type="submit"
            disabled={isLoading}
            aria-label="Sign in to your account"
            className={[
              "relative group overflow-hidden h-14 w-full rounded-full border-none",
              "bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg",
              "transition-all duration-300",
              "disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
            <span className="relative z-10">{isLoading ? <Loader2 className="animate-spin" /> : "Sign in"}</span>
          </Button>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign up for free
            </Link>
          </p>
        </div>
      </form>

      {/* Fixed Footer - Mobile only */}
      <footer className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20 md:hidden">
        <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-gray-100 dark:border-zinc-800 shadow-sm">
          <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
            FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
          </p>
        </div>
      </footer>
    </div>
  );
}
