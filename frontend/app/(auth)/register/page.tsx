"use client";

/**
 * Register Page — /app/(auth)/register/page.tsx
 *
 * Renders inside (auth)/layout.tsx which supplies the two-column split.
 * This component is responsible only for the form-panel content:
 *   • Heading
 *   • FloatingLabelInput fields (full names, username, email, password)
 *   • Sign-up button (shadcn/ui Button, Tailwind-overridden styling)
 *   • Footer link to /login
 *
 * Hard constraints respected:
 *   • No <form> tags — div wrapper with onClick handler on button
 *   • No inline style attributes
 *   • TypeScript + proper type annotations
 *   • shadcn/ui Button used for the CTA; FloatingLabelInput for fields
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";

/** Shape of the registration form state */
interface RegisterForm {
  fullNames: string;
  username: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>({
    fullNames: "",
    username: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /** Generic field updater — keeps the state object flat and DRY */
  const handleChange =
    (field: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  /**
   * Handles the sign-up action.
   * Replace the body with your real registration call (e.g. a POST to
   * /api/auth/register or your FastAPI backend's /auth/register endpoint).
   */
  const handleSignUp = async () => {
    const { fullNames, username, email, password } = form;
    if (
      !fullNames.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    )
      return;
    setIsLoading(true);
    try {
      // TODO: call POST /api/auth/register with form
      console.log("Registration payload:", form);
    } finally {
      setIsLoading(false);
    }
  };

  /** Allow Enter key on the last field to trigger sign-up */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSignUp();
  };

  return (
    /*
     * The parent layout supplies px-8 pt-12 md:px-16 md:pt-20.
     * max-w-md keeps the form from stretching on ultra-wide screens.
     */
    <div className="flex w-full max-w-md flex-col">
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <h1 className="text-3xl font-light leading-tight text-black md:text-4xl">
        Create an account
      </h1>

      {/* ── Fields ───────────────────────────────────────────────────────── */}
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

      {/* ── CTA Button ───────────────────────────────────────────────────── */}
      {/*
       * Identical override pattern to the login button:
       *   rounded-full   → pill shape
       *   bg-black       → black background (default state)
       *   h-14           → tall, prominent (overrides shadcn's h-10)
       *   hover:bg-primary-hover → transitions to #5611BD on hover
       *   transition-colors duration-300 → smooth colour change
       */}
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

        {/* ── Footer link ──────────────────────────────────────────────────── */}
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
