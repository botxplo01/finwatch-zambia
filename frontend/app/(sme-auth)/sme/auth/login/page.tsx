"use client";

/**
 * FinWatch Zambia - Login Page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogoLiquid from "@/components/shared/BrandLogoLiquid";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import OTPInput from "@/components/shared/OTPInput";
import QRLogin from "@/components/shared/QRLogin";
import {
  loginUser,
  fetchCurrentUser,
  verifyOTP,
  resendVerification,
  setToken,
  setUser,
  clearToken,
} from "@/lib/auth";
import { setRegToken, setRegUser, clearRegToken } from "@/lib/regulator-auth";
import api from "@/lib/api";
import {
  Loader2,
  QrCode,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Capacitor } from "@capacitor/core";

type WakingStatus = "idle" | "waking" | "success" | "error";
type AuthStep = "credentials" | "verification";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("credentials");
  const [showQR, setShowQR] = useState<boolean>(false);
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [wakingStatus, setWakingStatus] = useState<WakingStatus>("idle");
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Auto-Wake mechanism for Render Free Tier
  useEffect(() => {
    const wakeup = async () => {
      try {
        setWakingStatus("waking");
        await api.get("/health");
        setWakingStatus("success");
        setTimeout(() => setWakingStatus("idle"), 3000);
      } catch (err) {
        setWakingStatus("error");
      }
    };
    wakeup();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await loginUser(
        {
          username: identifier.trim(),
          password: password.trim(),
        },
        "sme"
      );
      setStep("verification");
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 400) {
        setError("Invalid username or password. Please try again.");
      } else if (status === 422) {
        setError("Please check your input and try again.");
      } else {
        setError(
          "Unable to connect to the server. Make sure the backend is running."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent, manualToken?: string) => {
    if (e) e.preventDefault();
    if (!manualToken && otp.length < 5) return;

    setIsLoading(true);
    setError("");

    try {
      const isMobile = Capacitor.isNativePlatform();
      const token =
        manualToken ||
        (await verifyOTP(identifier.trim(), "sme", otp, isMobile)).access_token;

      let userRole = "sme_owner";
      try {
        const user = await fetchCurrentUser(token);

        if (user.role === "sme_owner") {
          await setToken(token);
          await setUser(user);
          await clearRegToken();
          userRole = "sme_owner";
        } else {
          await setRegToken(token);
          await setRegUser(user);
          await clearToken();
          userRole = user.role;
        }
      } catch (profileErr) {
        console.error("Profile fetch failed during login:", profileErr);
        await setToken(token);
        await clearRegToken();
        userRole = "sme_owner";
      }

      // Final navigation logic
      localStorage.removeItem("isFirstTimeRegistration");
      sessionStorage.removeItem("hasSeenAITooltipThisSession");
      sessionStorage.removeItem("hasSeenSmeDocsAITooltipThisSession");
      sessionStorage.removeItem("hasSeenAnalystDocsAITooltipThisSession");
      sessionStorage.removeItem("hasSeenRegulatorDocsAITooltipThisSession");
      sessionStorage.removeItem("glossary_button_side");
      sessionStorage.removeItem("chat_button_side");

      if (userRole === "sme_owner") {
        router.push("/sme");
      } else {
        router.push("/institutional");
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 400) {
        setError(detail || "Invalid or expired code.");
      } else if (status === 429) {
        setError("Too many attempts. Please resend a new code.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError("");
    try {
      await resendVerification(identifier.trim(), "sme");
      setResendCooldown(60);
      setOtp("");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col justify-center h-full">
      {/* Mobile-only Header */}
      <div className="mb-2 md:hidden flex justify-center w-full">
        <BrandLogoLiquid className="w-full max-w-[380px] mx-auto" />
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl text-center md:text-left">
        {step === "credentials"
          ? "Sign in to your account"
          : "Verify your email"}
      </h1>

      {step === "verification" && (
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400 text-center md:text-left animate-in fade-in slide-in-from-top-1">
          We've sent a 5-digit code to{" "}
          <span className="font-bold text-gray-900 dark:text-zinc-100">
            {identifier}
          </span>
        </p>
      )}

      <div className="mt-10 flex flex-col">
        {step === "credentials" ? (
          <div className="flex flex-col">
            {/* QR Login Toggle - Hidden on native mobile */}
            {!Capacitor.isNativePlatform() && (
              <div className="flex justify-center mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowQR(!showQR);
                    setError("");
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all",
                    showQR
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white dark:bg-zinc-900 text-gray-500 border-gray-100 dark:border-zinc-800 hover:border-purple-200"
                  )}
                >
                  {showQR ? (
                    <Mail size={14} />
                  ) : (
                    <QrCode size={14} className="animate-pulse" />
                  )}
                  {showQR ? "Use email instead" : "Scan to login"}
                </button>
              </div>
            )}

            {showQR ? (
              <QRLogin
                portalType="sme"
                accentColor="purple"
                onSuccess={(token) => handleVerify(undefined, token)}
              />
            ) : (
              <form onSubmit={handleSignIn} className="flex flex-col">
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

                {error && (
                  <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200">
                    {error}
                  </p>
                )}

                <div className="mt-12 flex w-full flex-col items-center">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    variant="unstyled"
                    aria-label="Sign in to your account"
                    className="relative group overflow-hidden h-14 w-full rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98]"
                  >
                    <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
                    <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                      {isLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "Sign in"
                      )}
                    </span>
                  </Button>

                  <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
                    Don't have an account?{" "}
                    <Link
                      href="/sme/auth/register"
                      className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
                    >
                      Sign up here
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
            <OTPInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (error) setError("");
              }}
              accentColor="purple"
              disabled={isLoading}
            />

            {error && (
              <p className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1">
                {error}
              </p>
            )}

            <div className="mt-10 flex flex-col gap-4">
              <Button
                onClick={() => handleVerify()}
                disabled={isLoading || otp.length < 5}
                variant="unstyled"
                className="relative group overflow-hidden h-14 w-full rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
              >
                <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
                <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Verify & Sign In"
                  )}
                </span>
              </Button>

              <div className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setError("");
                    setOtp("");
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to login
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading || resendCooldown > 0}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50 disabled:no-underline transition-all"
                >
                  <Send size={14} />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Code"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
