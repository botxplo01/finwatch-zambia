"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { registerUser, loginUser, setToken, setUser } from "@/lib/auth";

interface RegisterForm {
  fullNames: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleChange =
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (error) setError("");
    };

  const handleSignUp = async () => {
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
      });

      // 2. Automatically log in after successful registration
      const tokenData = await loginUser({
        username: email.trim(), // backend authenticates by email
        password: password.trim(),
      });

      // 3. Persist token and user
      setToken(tokenData.access_token);
      setUser({
        full_name: fullNames.trim(),
        email: email.trim(),
      });

      // 4. Redirect to dashboard
      router.push("/dashboard");
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSignUp();
  };

  return (
    <div className="flex w-full max-w-md flex-col">
      {/* Mobile-only Header */}
      <div className="mb-10 md:hidden text-center w-full">
        <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-900 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          FinWatch Zambia
        </h2>
      </div>

      <h1 className="text-3xl font-light leading-tight text-black md:text-4xl">
        Create an account
      </h1>

      <div className="mt-10 flex flex-col gap-6">
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
          onKeyDown={handleKeyDown}
          aria-required="true"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </p>
      )}

      <div className="mt-12 flex w-full flex-col items-center">
        <Button
          onClick={handleSignUp}
          disabled={isLoading}
          aria-label="Create your account"
          className={[
            "relative group overflow-hidden h-14 w-full rounded-full border-none",
            "bg-black text-base font-bold text-white shadow-lg",
            "transition-all duration-300",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        >
          {/* Animated fill background */}
          <span className="absolute inset-0 w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />

          {/* Label */}
          <span className="relative z-10">{isLoading ? "Creating account…" : "Sign up"}</span>
        </Button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>

      {/* Fixed Footer with blurred glass effect - Mobile only */}
      <footer className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20 md:hidden">
        <div className="bg-white/40 backdrop-blur-md px-6 py-2 rounded-full border border-gray-100 shadow-sm">
          <p className="text-[11px] text-gray-500 font-medium">
            FinWatch &copy; 2026 &middot; Designed &amp; Developed by David &amp; Denise
          </p>
        </div>
      </footer>
    </div>
  );
}
