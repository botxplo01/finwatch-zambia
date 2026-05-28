"use client";

/**
 * FinWatch Zambia - Regulator Login Page
 * Refactored into a 2-step verification flow.
 * Integrated Scan to Login (QR) for institutional users.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogoLiquid from "@/components/shared/BrandLogoLiquid";
import OTPInput from "@/components/shared/OTPInput";
import QRLogin from "@/components/shared/QRLogin";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import {
  loginRegulator,
  clearRegToken,
  setRegToken,
  setRegUser,
} from "@/lib/regulator-auth";
import {
  clearToken,
  fetchCurrentUser,
  verifyOTP,
  resendVerification,
} from "@/lib/auth";
import api from "@/lib/api";
import {
  Loader2,
  QrCode,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Send,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Capacitor } from "@capacitor/core";

type WakingStatus = "idle" | "waking" | "success" | "error";
type AuthStep = "credentials" | "verification";

export default function RegulatorLoginPage() {
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

  // Auto-Wake mechanism
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
      await loginRegulator(identifier.trim(), password.trim());
      setStep("verification");
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 400) {
        setError("Invalid credentials. Please verify and try again.");
      } else {
        setError("Unable to connect to the institutional server.");
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
        (await verifyOTP(identifier.trim(), "institutional", otp, isMobile))
          .access_token;

      // Validate the role before confirming login
      const user = await fetchCurrentUser(token);

      const normalizedRole = user.role?.toLowerCase().trim();

      if (normalizedRole === "sme_owner") {
        setError(
          "This account is not authorized for the Institutional Portal."
        );
        setIsLoading(false);
        return;
      }

      await setRegToken(token);
      await setRegUser(user);
      await clearToken();

      localStorage.removeItem("isFirstTimeRegistration");
      sessionStorage.removeItem("hasSeenAITooltipThisSession");
      sessionStorage.removeItem("hasSeenSmeDocsAITooltipThisSession");
      sessionStorage.removeItem("hasSeenAnalystDocsAITooltipThisSession");
      sessionStorage.removeItem("hasSeenRegulatorDocsAITooltipThisSession");
      router.push("/institutional");
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
      await resendVerification(identifier.trim(), "institutional");
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
      {/* Mobile-only Header - Slightly lower */}
      <div className="mb-2 md:hidden flex justify-center w-full">
        <BrandLogoLiquid className="w-full max-w-[380px] mx-auto" />
      </div>

      <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 w-fit mx-auto md:mx-0 md:-mt-8">
        <ShieldCheck
          size={14}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
          Institutional Access
        </span>
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl text-center md:text-left">
        {step === "credentials" ? "Sign in to account" : "Verify access"}
      </h1>

      {step === "verification" && (
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400 text-center md:text-left animate-in fade-in slide-in-from-top-1">
          We've sent a 5-digit code to{" "}
          <span className="font-bold text-gray-900 dark:text-zinc-100">
            {identifier}
          </span>
        </p>
      )}

      <div className="mt-6 md:mt-10 flex flex-col">
        {/* Compact Dynamic Connection Status */}
        {wakingStatus !== "idle" && (
          <div
            className={`mb-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500
            ${
              wakingStatus === "waking"
                ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400"
                : ""
            }
            ${
              wakingStatus === "success"
                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                : ""
            }
            ${
              wakingStatus === "error"
                ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400"
                : ""
            }
          `}
          >
            {wakingStatus === "waking" && (
              <Zap size={12} className="animate-pulse" />
            )}
            {wakingStatus === "success" && <CheckCircle2 size={12} />}
            {wakingStatus === "error" && <AlertCircle size={12} />}
            <p className="text-[10px] font-bold uppercase tracking-tight">
              {wakingStatus === "waking"
                ? "Connecting to secure network..."
                : wakingStatus === "success"
                ? "Network active"
                : "Connection failed"}
            </p>
          </div>
        )}

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
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white dark:bg-zinc-900 text-gray-500 border-gray-100 dark:border-zinc-800 hover:border-emerald-200"
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
                portalType="institutional"
                accentColor="emerald"
                onSuccess={(token) => handleVerify(undefined, token)}
              />
            ) : (
              <form onSubmit={handleSignIn} className="flex flex-col">
                <div className="flex flex-col gap-4">
                  <FloatingLabelInput
                    id="identifier"
                    label="Institutional Email"
                    type="email"
                    accentColor="emerald"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                  <FloatingLabelInput
                    id="password"
                    label="Password"
                    type="password"
                    accentColor="emerald"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex w-full flex-col items-center">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    variant="unstyled"
                    className="relative group overflow-hidden h-14 w-full rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98]"
                  >
                    <span className="absolute inset-0 w-0 bg-emerald-600 transition-all duration-500 ease-out group-hover:w-full" />
                    <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                      {isLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "Continue"
                      )}
                    </span>
                  </Button>

                  <p className="mt-4 text-center text-sm text-gray-500 dark:text-zinc-400">
                    Need institutional access?{" "}
                    <Link
                      href="/institutional/auth/register"
                      className="font-medium text-emerald-600 underline-offset-4 hover:underline"
                    >
                      Apply here
                    </Link>
                  </p>

                  <Link
                    href="/sme/auth/login"
                    className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    Switch to SME Portal
                  </Link>
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
              accentColor="emerald"
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
                <span className="absolute inset-0 w-0 bg-emerald-600 transition-all duration-500 ease-out group-hover:w-full" />
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
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading || resendCooldown > 0}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50 disabled:no-underline transition-all"
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
