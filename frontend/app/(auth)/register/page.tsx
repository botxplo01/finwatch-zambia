"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { registerUser, loginUser, setToken, setUser } from "@/lib/auth";

interface RegisterForm {
  fullNames: string;
  username: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    username: "",
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
    const { fullNames, username, email, password } = form;

    if (
      !fullNames.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
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
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
      });

      // 2. Automatically log in after successful registration
      const tokenData = await loginUser({
        username: username.trim(),
        password: password.trim(),
      });

      // 3. Persist token and user
      setToken(tokenData.access_token);
      setUser({
        full_name: fullNames.trim(),
        username: username.trim(),
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
          id="username"
          label="Username"
          type="text"
          autoComplete="username"
          value={form.username}
          onChange={handleChange("username")}
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
            "h-14 w-full rounded-full",
            "bg-black text-base font-bold text-white",
            "transition-colors duration-300",
            "hover:bg-primary-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        >
          {isLoading ? "Creating account…" : "Sign up"}
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
    </div>
  );
}
