"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { registerUser, loginUser, setToken, setUser } from "@/lib/auth";
import { setRegToken, setRegUser } from "@/lib/regulator-auth";
import { 
  Briefcase, 
  BarChart3, 
  ShieldCheck, 
  ChevronDown,
  Check
} from "lucide-react";

interface RegisterForm {
  fullNames: string;
  email: string;
  password: string;
  role: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    email: "",
    password: "",
    role: "sme_owner",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const roles = [
    { id: "sme_owner", label: "SME Owner", icon: Briefcase, desc: "Predict your business health" },
    { id: "policy_analyst", label: "Policy Analyst", icon: BarChart3, desc: "Monitor sector insights" },
    { id: "regulator", label: "Regulator", icon: ShieldCheck, desc: "Full systemic oversight" },
  ];

  const selectedRole = roles.find(r => r.id === form.role) || roles[0];

  const handleChange =
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (error) setError("");
    };

  const handleSignUp = async (e: React.FormEvent) => {
    // Prevent page refresh immediately
    e.preventDefault();

    const { fullNames, email, password } = form;

    if (!fullNames.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 1. Register the new account
      await registerUser({
        full_name: fullNames.trim(),
        email: email.trim(),
        password: password.trim(),
        role: form.role,
      });

      // 2. Automatically log in after successful registration
      const tokenData = await loginUser({
        username: email.trim(), // backend authenticates by email
        password: password.trim(),
      });

      // 3. Persist token and user
      if (form.role === "sme_owner") {
        setToken(tokenData.access_token);
        setUser({
          full_name: fullNames.trim(),
          email: email.trim(),
          role: form.role,
        });
        // Use window.location.href to ensure a clean state refresh upon landing
        window.location.href = "/dashboard";
      } else {
        setRegToken(tokenData.access_token);
        setRegUser({
          full_name: fullNames.trim(),
          email: email.trim(),
          role: form.role,
        });
        window.location.href = "/regulator";
      }
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const detail = (err as any)?.response?.data?.detail;

      if (
        status === 409 ||
        (typeof detail === "string" && detail.toLowerCase().includes("exist"))
      ) {
        setError("An account with that username or email already exists.");
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
    <div className="flex w-full max-w-md flex-col">
      {/* Mobile-only Header */}
      <div className="mb-10 md:hidden text-center w-full">
        <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-emerald-500 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
          FinWatch Zambia
        </h2>
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl">
        Create an account
      </h1>

      <form onSubmit={handleSignUp} className="mt-10 flex flex-col">
        <div className="flex flex-col gap-6">
          <FloatingLabelInput
            id="fullNames"
            label="Full Names"
            type="text"
            autoComplete="name"
            value={form.fullNames}
            onChange={handleChange("fullNames")}
            aria-required="true"
          />

          <FloatingLabelInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange("email")}
            aria-required="true"
          />

          <FloatingLabelInput
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange("password")}
            aria-required="true"
          />

          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
              Access Role
            </label>
            <button
              type="button"
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="w-full flex items-center justify-between h-14 px-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-primary transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
                  <selectedRole.icon size={16} className="text-gray-600 dark:text-zinc-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{selectedRole.label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 leading-none">{selectedRole.desc}</p>
                </div>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${roleMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {roleMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1.5">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, role: role.id }));
                          setRoleMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors
                          ${form.role === role.id ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                            ${form.role === role.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>
                            <role.icon size={18} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${form.role === role.id ? 'text-primary' : 'text-gray-900 dark:text-zinc-100'}`}>{role.label}</p>
                            <p className="text-[10px] text-gray-500 dark:text-zinc-400">{role.desc}</p>
                          </div>
                        </div>
                        {form.role === role.id && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
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
            aria-label="Create your account"
            className={[
              "relative group overflow-hidden h-14 w-full rounded-full border-none",
              "bg-black dark:bg-zinc-100 text-base font-bold text-white dark:text-zinc-900 shadow-lg",
              "transition-all duration-300",
              "disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            {/* Animated fill background */}
            <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />

            {/* Label */}
            <span className="relative z-10">{isLoading ? "Creating account…" : "Sign up"}</span>
          </Button>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </form>

      {/* Fixed Footer with blurred glass effect - Mobile only */}
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
