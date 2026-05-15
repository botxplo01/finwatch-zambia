"use client";

/**
 * FinWatch Zambia - Regulator Registration Page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogoLiquid from "@/components/shared/BrandLogoLiquid";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { registerUser, loginUser } from "@/lib/auth";
import { setRegToken, setRegUser } from "@/lib/regulator-auth";
import api from "@/lib/api";
import {
  BarChart3,
  ShieldCheck,
  ChevronDown,
  Zap,
  KeyRound,
  UserCheck,
  Loader2,
} from "lucide-react";

interface RegisterForm {
  fullNames: string;
  email: string;
  password: string;
  role: string;
  invitationCode: string;
}

type WakingStatus = "idle" | "waking" | "success" | "error";

export default function RegulatorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    email: "",
    password: "",
    role: "policy_analyst",
    invitationCode: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [wakingStatus, setWakingStatus] = useState<WakingStatus>("idle");

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fullNames, email, password, invitationCode } = form;

    if (
      !fullNames.trim() ||
      !email.trim() ||
      !password.trim() ||
      !invitationCode.trim()
    ) {
      setError("All institutional fields are mandatory.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await registerUser({
        full_name: fullNames.trim(),
        email: email.trim(),
        password: password.trim(),
        role: form.role,
        invitation_code: invitationCode.trim(),
      });

      const tokenData = await loginUser({
        username: email.trim(),
        password: password.trim(),
      });

      // Database-Proof Reset: Clear old browser flags for this email before setting new session
      localStorage.removeItem(`hasSeenWelcomeModal_${email.trim()}`);
      sessionStorage.removeItem("hasSeenAITooltipThisSession");

      setRegToken(tokenData.access_token);
      setRegUser({
        full_name: fullNames.trim(),
        email: email.trim(),
        role: form.role,
      });

      localStorage.setItem("isFirstTimeRegistration", "true");
      sessionStorage.removeItem("hasSeenAITooltipThisSession");
      window.location.href = "/regulator";

      } catch (err: unknown) {

      const status = (err as any)?.response?.status;

      if (status === 403) {
        setError("Invalid Institutional Invitation Code.");
      } else if (status === 400) {
        setError("This institutional email is already registered.");
      } else {
        setError("Authentication server error. Please contact sysadmin.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col">
      {/* Mobile-only Header - Slightly lower */}
      <div className="mb-2 md:hidden flex justify-center w-full mt-4">
        <BrandLogoLiquid className="w-full max-w-[380px] mx-auto" />
      </div>

      <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 w-fit mx-auto md:mx-0 md:-mt-8">
        <UserCheck
          size={14}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
          Institutional Registration
        </span>
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl text-center md:text-left">
        Apply for Access
      </h1>

      <form onSubmit={handleSignUp} className="mt-2 flex flex-col">
        <div className="flex flex-col gap-4">
          <FloatingLabelInput
            id="fullNames"
            label="Full Name & Title"
            value={form.fullNames}
            onChange={(e) => setForm({ ...form, fullNames: e.target.value })}
          />

          <FloatingLabelInput
            id="email"
            label="Official Work Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <FloatingLabelInput
            id="password"
            label="Secure Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">
              Designated Role
            </label>
            <button
              type="button"
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="w-full flex items-center justify-between h-12 px-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <selectedRole.icon size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  {selectedRole.label}
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`}
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
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${form.role === role.id ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === role.id ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-500"}`}
                    >
                      <role.icon size={16} />
                    </div>
                    <div className="text-left">
                      <p
                        className={`text-sm font-bold ${form.role === role.id ? "text-emerald-600" : "text-gray-900 dark:text-zinc-100"}`}
                      >
                        {role.label}
                      </p>
                      <p className="text-[10px] text-gray-500">{role.desc}</p>
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
                className="text-emerald-500 group-focus-within:text-emerald-600 transition-colors"
              />
            </div>
            <input
              type="text"
              placeholder="Institutional Invitation Code"
              className="w-full h-12 pl-12 pr-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
              value={form.invitationCode}
              onChange={(e) =>
                setForm({ ...form, invitationCode: e.target.value })
              }
            />
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}

        <div className="mt-8 flex w-full flex-col items-center">
          <Button
            type="submit"
            disabled={isLoading}
            className="relative group overflow-hidden h-14 w-full rounded-full border-none bg-black dark:bg-zinc-100 hover:bg-black dark:hover:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg transition-all duration-300"
          >
            <span className="absolute inset-0 w-0 bg-emerald-600 transition-all duration-500 ease-out group-hover:w-full" />
            <span className="relative z-10">
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Complete Registration"
              )}
            </span>
          </Button>

          <p className="mt-4 text-center text-sm text-gray-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/regulator/auth/login"
              className="font-medium text-emerald-600 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </form>

      {/* Fixed Footer - Mobile only */}
      <footer className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20 md:hidden">
        <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-gray-100 dark:border-zinc-800 shadow-sm">
          <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
            FinWatch &copy; 2026 &middot; Designed &amp; developed by David
            &amp; Denise
          </p>
        </div>
      </footer>
    </div>
  );
}
