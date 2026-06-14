"use client";

/**
 * FinWatch Zambia - Institutional Registration Page
 * Optimized with anchored headers for layout stability.
 * Includes early email validation for better UX.
 * Integrated 2nd-step verification flow.
 * Atomic Design: User record is created ONLY after OTP success.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogoLiquid from "@/components/shared/BrandLogoLiquid";
import OTPInput from "@/components/shared/OTPInput";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import {
  registerUser,
  verifyOTP,
  resendVerification,
  fetchCurrentUser,
  checkEmailAvailability,
} from "@/lib/auth";
import { setInstitutionalToken, setInstitutionalUser } from "@/lib/institutional-auth";
import api from "@/lib/api";
import { isTitleInName, cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useAuthAccent } from "@/context/AuthAccentContext";
import {
  BarChart3,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Zap,
  KeyRound,
  UserCheck,
  User,
  Check,
  Loader2,
  ArrowLeft,
  Send,
} from "lucide-react";

import { Capacitor } from "@capacitor/core";

interface RegisterForm {
  fullNames: string;
  title: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  invitationCode: string;
}

type WakingStatus = "idle" | "waking" | "success" | "error";

export default function InstitutionalRegisterPage() {
  const router = useRouter();
  const { setAccent } = useAuthAccent();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    title: "Mr.",
    email: "",
    password: "",
    confirmPassword: "",
    role: "policy_analyst",
    invitationCode: "",
  });
  const [otp, setOtp] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [wakingStatus, setWakingStatus] = useState<WakingStatus>("idle");
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

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

  const roles = [
    {
      id: "policy_analyst",
      label: "Policy Analyst",
      icon: BarChart3,
      desc: "Monitor sector insights & trends",
    },
    {
      id: "regulator",
      label: "Regulator",
      icon: ShieldCheck,
      desc: "Full systemic oversight & anomalies",
    },
  ];

  const selectedRole = roles.find((r) => r.id === form.role) || roles[0];
  const accentColor = form.role === "policy_analyst" ? "blue" : "emerald";

  // Synchronize global auth layout accent with selected role
  useEffect(() => {
    setAccent(accentColor);
  }, [accentColor, setAccent]);

  const titleOptions = [
    { value: "Mr.", label: "Mr.", icon: User },
    { value: "Mrs.", label: "Mrs.", icon: User },
    { value: "Ms.", label: "Ms.", icon: User },
    { value: "Dr.", label: "Dr.", icon: User },
    { value: "Prof.", label: "Prof.", icon: User },
  ];

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
    [form.password]
  );

  const validateStep = async () => {
    setError("");
    if (step === 1) {
      if (!form.invitationCode.trim()) {
        setError("Invitation code is required to verify institutional access.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!form.fullNames.trim() || !form.email.trim()) {
        setError("Please provide your full identity details.");
        return false;
      }
      const titleFound = isTitleInName(form.fullNames);
      if (titleFound) {
        setError(
          `Full name should not include professional titles like '${titleFound}'. Please use the dedicated Title field.`
        );
        return false;
      }
      if (!form.email.includes("@")) {
        setError("Please enter a valid institutional email address.");
        return false;
      }

      setIsLoading(true);
      try {
        const isAvailable = await checkEmailAvailability(
          form.email.trim(),
          "institutional"
        );
        if (!isAvailable) {
          setError("An active account with that email already exists.");
          return false;
        }
        return true;
      } catch (err) {
        setError("Error validating email. Please try again.");
        return false;
      } finally {
        setIsLoading(false);
      }
    }
    return true;
  };

  const nextStep = async () => {
    if (await validateStep()) {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      fullNames,
      title,
      email,
      password,
      confirmPassword,
      invitationCode,
    } = form;

    if (!password || !confirmPassword) {
      setError("Please set a secure password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Institutional policy requires at least 8 characters.");
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
        portal_type: "institutional",
        invitation_code: invitationCode.trim(),
      });

      setStep(4);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const detail = (err as any)?.response?.data?.detail;

      if (status === 403) {
        setError("Invalid Institutional Invitation Code.");
        setStep(1); // Go back to invitation code step
      } else if (status === 400) {
        setError(detail || "An active account with that email already exists.");
        setStep(2); // Go back to identity step
      } else {
        setError(
          detail || "Authentication server error. Please contact sysadmin."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length < 5) return;

    setIsLoading(true);
    setError("");

    try {
      const isMobile = Capacitor.isNativePlatform();
      const tokenData = await verifyOTP(
        form.email.trim(),
        "institutional",
        otp,
        isMobile
      );
      const token = tokenData.access_token;

      // Database-Proof Reset: Clear old browser flags for this email before setting new session
      localStorage.removeItem(`hasSeenWelcomeModal_${form.email.trim()}`);
      sessionStorage.removeItem("hasSeenAITooltipThisSession");

      await setInstitutionalToken(token);
      const user = await fetchCurrentUser(token);
      await setInstitutionalUser(user);

      localStorage.setItem("isFirstTimeRegistration", "true");
      sessionStorage.removeItem("hasSeenAITooltipThisSession");
      
      if (user.role === "regulator") {
        router.replace("/regulator");
      } else {
        router.replace("/analyst");
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
      await resendVerification(form.email.trim(), "institutional");
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
    <div className="flex w-full flex-col pt-10 md:pt-32">
      {/* Mobile-only Header - Slightly lower */}
      <div className="mb-2 md:hidden flex justify-center w-full">
        <BrandLogoLiquid className="w-full max-w-[380px] mx-auto" />
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full border w-fit",
            accentColor === "blue"
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
              : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
          )}
        >
          <UserCheck
            size={14}
            className={
              accentColor === "blue"
                ? "text-blue-600 dark:text-blue-400"
                : "text-emerald-600 dark:text-emerald-400"
            }
          />
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              accentColor === "blue"
                ? "text-blue-700 dark:text-blue-400"
                : "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {accentColor === "blue"
              ? "Policy Analyst Portal"
              : "Regulator Portal"}
          </span>
        </div>
      </div>

      {/* ANCHORED HEADER SECTION: Fixed layout for stability using Step 2 as reference */}
      <div className="mb-2 h-[145px] md:h-[155px] flex flex-col justify-start">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Step {step} of 4
        </p>

        {/* Progress Indicator */}
        <div className="flex items-center gap-1.5 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                step === s
                  ? accentColor === "blue"
                    ? "w-8 bg-blue-500"
                    : "w-8 bg-emerald-500"
                  : s < step
                  ? accentColor === "blue"
                    ? "w-2 bg-blue-200 dark:bg-blue-900"
                    : "w-2 bg-emerald-200 dark:bg-emerald-900"
                  : "w-2 bg-gray-100 dark:bg-zinc-800"
              )}
            />
          ))}
        </div>

        <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl">
          {step === 1 && "Access Verification"}
          {step === 2 && "Professional Identity"}
          {step === 3 && "Account Security"}
          {step === 4 && "Email Verification"}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
          {step === 1 && "Verify your institutional authorization."}
          {step === 2 &&
            "Enter your professional credentials. This will help us verify your identity."}
          {step === 3 && "Secure your account with a strong password."}
          {step === 4 && `We've sent a 5-digit code to ${form.email}`}
        </p>
      </div>

      <div className="mt-1 flex flex-col">
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">
                  Designated Role
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!isLoading) setRoleMenuOpen(!roleMenuOpen);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between h-12 px-4 rounded-2xl border bg-white dark:bg-zinc-900 transition-all duration-200 shadow-sm",
                    "border-gray-200 dark:border-zinc-800",
                    accentColor === "blue"
                      ? "hover:border-blue-500"
                      : "hover:border-emerald-500"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <selectedRole.icon
                      size={16}
                      className={
                        accentColor === "blue"
                          ? "text-blue-600"
                          : "text-emerald-600"
                      }
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                      {selectedRole.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${
                      roleMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {roleMenuOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden p-1.5 animate-in fade-in slide-in-from-top-2">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, role: role.id });
                          setRoleMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                          form.role === role.id
                            ? accentColor === "blue"
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "bg-emerald-50 dark:bg-emerald-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            form.role === role.id
                              ? accentColor === "blue"
                                ? "bg-blue-600 text-white"
                                : "bg-emerald-600 text-white"
                              : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                          )}
                        >
                          <role.icon size={16} />
                        </div>
                        <div className="text-left">
                          <p
                            className={cn(
                              "text-sm font-bold",
                              form.role === role.id
                                ? accentColor === "blue"
                                  ? "text-blue-600"
                                  : "text-emerald-600"
                                : "text-gray-900 dark:text-zinc-100"
                            )}
                          >
                            {role.label}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {role.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <KeyRound
                    size={16}
                    className={cn(
                      "transition-colors",
                      accentColor === "blue"
                        ? "text-blue-500 group-focus-within:text-blue-600"
                        : "text-emerald-500 group-focus-within:text-emerald-600"
                    )}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Institutional Invitation Code"
                  autoFocus
                  className={cn(
                    "w-full h-12 pl-12 pr-4 rounded-2xl border bg-white dark:bg-zinc-900 outline-none transition-all text-sm font-medium",
                    "border-gray-200 dark:border-zinc-800",
                    accentColor === "blue"
                      ? "focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  )}
                  value={form.invitationCode}
                  onChange={(e) =>
                    setForm({ ...form, invitationCode: e.target.value })
                  }
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={nextStep}
              disabled={isLoading}
              variant="unstyled"
              className="mt-4 h-14 w-full relative group overflow-hidden rounded-full border-none bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-lg transition-all duration-300 active:scale-[0.98]"
            >
              <span
                className={cn(
                  "absolute inset-0 w-0 transition-all duration-500 ease-out group-hover:w-full",
                  accentColor === "blue" ? "bg-blue-600" : "bg-emerald-600"
                )}
              />
              <div className="relative z-10 flex items-center justify-center gap-2 transition-colors duration-500 group-hover:dark:text-white">
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Continue <ChevronRight size={18} />
                  </>
                )}
              </div>
            </Button>
          </div>
        )}

        {step === 2 && (
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
                  themeColor={accentColor}
                />
              </div>

              <FloatingLabelInput
                id="fullNames"
                label="Full Name"
                accentColor="institutional"
                value={form.fullNames}
                onChange={(e) =>
                  setForm({ ...form, fullNames: e.target.value })
                }
              />

              <FloatingLabelInput
                id="email"
                label="Official Work Email"
                type="email"
                accentColor="institutional"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="h-14 flex-1 rounded-full border-gray-200 dark:border-zinc-800 font-bold text-gray-600 dark:text-zinc-400"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={nextStep}
                disabled={isLoading}
                variant="unstyled"
                className="h-14 flex-[2] relative group overflow-hidden rounded-full border-none bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-lg transition-all duration-300 active:scale-[0.98]"
              >
                <span
                  className={cn(
                    "absolute inset-0 w-0 transition-all duration-500 ease-out group-hover:w-full",
                    accentColor === "blue" ? "bg-blue-600" : "bg-emerald-600"
                  )}
                />
                <div className="relative z-10 flex items-center justify-center gap-2 transition-colors duration-500 group-hover:dark:text-white">
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      Continue <ChevronRight size={18} />
                    </>
                  )}
                </div>
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
              <div className="relative">
                <FloatingLabelInput
                  id="password"
                  label="Secure Password"
                  type="password"
                  accentColor="institutional"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  onFocus={() => setShowPasswordHint(true)}
                  onBlur={() => setShowPasswordHint(false)}
                />

                {showPasswordHint && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                      Institutional Requirements
                    </p>
                    <ul className="space-y-2">
                      {passwordRequirements.map((req, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                              req.met
                                ? accentColor === "blue"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                                : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
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
                                : "text-gray-400 dark:text-zinc-500"
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
                accentColor="institutional"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="h-14 flex-1 rounded-full border-gray-200 dark:border-zinc-800 font-bold text-gray-600 dark:text-zinc-400"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSignUp}
                disabled={isLoading}
                variant="unstyled"
                className="h-14 flex-[2] relative group overflow-hidden rounded-full border-none bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-lg transition-all duration-300 active:scale-[0.98]"
              >
                <span
                  className={cn(
                    "absolute inset-0 w-0 transition-all duration-500 ease-out group-hover:w-full",
                    accentColor === "blue" ? "bg-blue-600" : "bg-emerald-600"
                  )}
                />
                <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Register"
                  )}
                </span>
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
            <OTPInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (error) setError("");
              }}
              accentColor={accentColor}
              disabled={isLoading}
            />

            <div className="mt-10 flex flex-col gap-4">
              <Button
                onClick={() => handleVerify()}
                disabled={isLoading || otp.length < 5}
                variant="unstyled"
                className="relative group overflow-hidden h-14 w-full rounded-full border-none bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
              >
                <span
                  className={cn(
                    "absolute inset-0 w-0 transition-all duration-500 ease-out group-hover:w-full",
                    accentColor === "blue" ? "bg-blue-600" : "bg-emerald-600"
                  )}
                />
                <span className="relative z-10 transition-colors duration-500 group-hover:dark:text-white">
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Verify & Complete"
                  )}
                </span>
              </Button>

              <div className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(3);
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
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-bold hover:underline disabled:opacity-50 disabled:no-underline transition-all",
                    accentColor === "blue"
                      ? "text-blue-600"
                      : "text-emerald-600"
                  )}
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

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>

      <p className="mt-2 md:mt-4 text-center text-sm text-gray-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/institutional/auth/login"
          className={cn(
            "font-medium hover:underline transition-colors",
            accentColor === "blue" ? "text-blue-600" : "text-emerald-600"
          )}
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
