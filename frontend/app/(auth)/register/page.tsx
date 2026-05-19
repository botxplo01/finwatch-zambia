"use client";

/**
 * FinWatch Zambia - Registration Page
 * Refactored into a 2-step onboarding flow with synchronized institutional layout.
 * Optimized with anchored headers for layout stability.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogoLiquid from "@/components/shared/BrandLogoLiquid";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import {
  registerUser,
  loginUser,
  setToken,
  setUser,
  checkEmailAvailability,
} from "@/lib/auth";
import { setRegToken, setRegUser } from "@/lib/regulator-auth";
import api from "@/lib/api";
import { isTitleInName, cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  User,
  Check,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { Capacitor } from "@capacitor/core";

interface RegisterForm {
  fullNames: string;
  title: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

type WakingStatus = "idle" | "waking" | "success" | "error";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    title: "Mr.",
    email: "",
    password: "",
    confirmPassword: "",
    role: "sme_owner",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [wakingStatus, setWakingStatus] = useState<WakingStatus>("idle");
  const [showPasswordHint, setShowPasswordHint] = useState(false);

  // Auto-Wake mechanism for Render Free Tier
  useEffect(() => {
    const wakeup = async () => {
      try {
        setWakingStatus("waking");
        await api.get("/health");
        setWakingStatus("success");
        setTimeout(() => setWakingStatus("idle"), 3000);
      } catch (err: any) {
        console.error("Auto-Wake failed:", err);
        setWakingStatus("error");
      }
    };
    wakeup();
  }, []);

  const passwordRequirements = useMemo(
    () => [
      { label: "At least 8 characters", met: form.password.length >= 8 },
      {
        label: "At least one uppercase letter",
        met: /[A-Z]/.test(form.password),
      },
      {
        label: "At least one lowercase letter",
        met: /[a-z]/.test(form.password),
      },
      { label: "At least one digit", met: /\d/.test(form.password) },
      {
        label: "At least one special character",
        met: /[^A-Za-z0-9]/.test(form.password),
      },
    ],
    [form.password],
  );

  const titleOptions = [
    { value: "Mr.", label: "Mr.", icon: User },
    { value: "Mrs.", label: "Mrs.", icon: User },
    { value: "Ms.", label: "Ms.", icon: User },
    { value: "Dr.", label: "Dr.", icon: User },
    { value: "Prof.", label: "Prof.", icon: User },
  ];

  const handleChange = useCallback(
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (error) setError("");
    },
    [error],
  );

  const nextStep = async () => {
    const { fullNames, email, title } = form;
    if (!fullNames.trim() || !email.trim() || !title.trim()) {
      setError("Please fill in all identity fields.");
      return;
    }

    const titleFound = isTitleInName(fullNames);
    if (titleFound) {
      setError(
        `Full name should not include professional titles like '${titleFound}'. Please use the dedicated Title field.`,
      );
      return;
    }

    // Basic Email regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const isAvailable = await checkEmailAvailability(email.trim());
      if (!isAvailable) {
        setError("An account with that email already exists.");
        return;
      }
      setStep(2);
    } catch (err) {
      setError("Error validating email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const prevStep = () => {
    setError("");
    setStep(1);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fullNames, title, email, password, confirmPassword } = form;

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please fill in all security fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const unmet = passwordRequirements.filter((r) => !r.met);
    if (unmet.length > 0) {
      setError("Password does not meet all requirements.");
      setShowPasswordHint(true);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await registerUser({
        full_name: fullNames.trim(),
        title: title.trim(),
        email: email.trim(),
        password: password.trim(),
        role: form.role,
      });

      const isMobile = Capacitor.isNativePlatform();
      const tokenData = await loginUser({
        username: email.trim(),
        password: password.trim(),
      }, isMobile);

      // Database-Proof Reset: Clear old browser flags for this email before setting new session
      localStorage.removeItem(`hasSeenWelcomeModal_${email.trim()}`);
      sessionStorage.removeItem("hasSeenAITooltipThisSession");

      if (form.role === "sme_owner") {
        setToken(tokenData.access_token);
        setUser({
          full_name: fullNames.trim(),
          title: title.trim(),
          email: email.trim(),
          role: form.role,
        });
        localStorage.setItem("isFirstTimeRegistration", "true");
        router.push("/dashboard");
      } else {
        setRegToken(tokenData.access_token);
        setRegUser({
          full_name: fullNames.trim(),
          title: title.trim(),
          email: email.trim(),
          role: form.role,
        });
        localStorage.setItem("isFirstTimeRegistration", "true");
        router.push("/regulator");
      }
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const detail = (err as any)?.response?.data?.detail;

      if (
        status === 409 ||
        (typeof detail === "string" && detail.toLowerCase().includes("exist"))
      ) {
        setError("An account with that email already exists.");
      } else if (status === 422) {
        setError("Please check your input. Make sure your email is valid.");
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
    <div className="flex w-full flex-col pt-10 md:pt-32">
      {/* Mobile-only Header */}
      <div className="mb-2 md:hidden flex justify-center w-full">
        <BrandLogoLiquid className="w-full max-w-[380px] mx-auto" />
      </div>

      {/* ANCHORED HEADER SECTION: Fixed layout for stability */}
      <div className="mb-2 h-[122px] md:h-[132px] flex flex-col justify-start">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Step {step} of 2
        </p>

        {/* Progress Indicator */}
        <div className="flex items-center gap-1.5 mb-6">
          <div
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              step === 1
                ? "w-8 bg-purple-500"
                : "w-2 bg-purple-200 dark:bg-purple-900",
            )}
          />
          <div
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              step === 2
                ? "w-8 bg-purple-500"
                : "w-2 bg-gray-100 dark:bg-zinc-800",
            )}
          />
        </div>

        <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl text-left">
          {step === 1 ? "Identity" : "Account Security"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400 text-left">
          {step === 1
            ? "Tell us a bit about yourself to get started."
            : "Protect your account with a secure password."}
        </p>
      </div>

      <form onSubmit={handleSignUp} className="mt-1 flex flex-col">
        {/* Compact Dynamic Connection Status */}
        {wakingStatus !== "idle" && (
          <div
            className={`mb-6 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500 animate-in fade-in slide-in-from-top-2
              ${wakingStatus === "waking" ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400" : ""}
              ${wakingStatus === "success" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400" : ""}
              ${wakingStatus === "error" ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400" : ""}
            `}
          >
            {wakingStatus === "waking" && (
              <Zap size={12} className="animate-pulse" />
            )}
            {wakingStatus === "success" && <CheckCircle2 size={12} />}
            {wakingStatus === "error" && <AlertCircle size={12} />}

            <p className="text-[10px] font-bold uppercase tracking-tight">
              {wakingStatus === "waking" &&
                "Initializing secure connection... please wait"}
              {wakingStatus === "success" && "Connection established"}
              {wakingStatus === "error" &&
                "Connection failed. Please try again later."}
            </p>
          </div>
        )}

        <div>
          {step === 1 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                    Professional Title
                  </label>
                  <CustomSelect
                    options={titleOptions}
                    value={form.title}
                    onChange={(val) => setForm({ ...form, title: val })}
                    placeholder="Select Title"
                    icon={User}
                    themeColor="purple"
                  />
                </div>
                <FloatingLabelInput
                  id="fullNames"
                  label="Full Name"
                  type="text"
                  autoComplete="name"
                  accentColor="purple"
                  value={form.fullNames}
                  onChange={handleChange("fullNames")}
                  aria-required="true"
                />

                <FloatingLabelInput
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  accentColor="purple"
                  value={form.email}
                  onChange={handleChange("email")}
                  aria-required="true"
                />
              </div>

              <Button
                type="button"
                onClick={nextStep}
                disabled={isLoading}
                variant="unstyled"
                className="mt-4 h-14 w-full relative group overflow-hidden rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98]"
              >
                <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
                <div className="relative z-10 flex items-center justify-center gap-2 transition-colors duration-500 group-hover:dark:text-white">
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>Continue <ArrowRight size={18} /></>
                  )}
                </div>
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-4">
                <div className="relative">
                  <FloatingLabelInput
                    id="password"
                    label="Create Password"
                    type="password"
                    autoComplete="new-password"
                    accentColor="purple"
                    value={form.password}
                    onChange={handleChange("password")}
                    onBlur={() => setShowPasswordHint(false)}
                    onFocus={() => setShowPasswordHint(true)}
                    aria-required="true"
                  />

                  {showPasswordHint && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-30 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Password Requirements
                      </p>
                      <ul className="space-y-2">
                        {passwordRequirements.map((req, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                req.met
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                  : "bg-gray-100 dark:bg-zinc-800 text-gray-400",
                              )}
                            >
                              {req.met ? (
                                <Check size={10} strokeWidth={3} />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-medium transition-colors",
                                req.met
                                  ? "text-gray-900 dark:text-zinc-100"
                                  : "text-gray-400 dark:text-zinc-500",
                              )}
                            >
                              {req.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <FloatingLabelInput
                  id="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  autoComplete="new-password"
                  accentColor="purple"
                  value={form.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  aria-required="true"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="h-14 flex-1 rounded-full border-gray-200 dark:border-zinc-800 font-bold text-gray-600 dark:text-zinc-400"
                >
                  <ArrowLeft size={18} className="mr-2" /> Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  variant="unstyled"
                  className="relative group overflow-hidden h-14 flex-[2] rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98]"
                >
                  <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
                  <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Sign up"}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </form>

      <p className="mt-2 md:mt-4 text-center text-sm text-gray-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
