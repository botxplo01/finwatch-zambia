"use client";

/**
 * Login Page — /app/(auth)/login/page.tsx
 *
 * Renders inside (auth)/layout.tsx which supplies the two-column split.
 * This component is responsible only for the form-panel content:
 *   • Heading
 *   • FloatingLabelInput fields (username/email + password)
 *   • Sign-in button (shadcn/ui Button, Tailwind-overridden styling)
 *   • Footer link to /register
 *
 * Hard constraints respected:
 *   • No <form> tags — div wrapper with onClick handler on button
 *   • No inline style attributes
 *   • TypeScript + proper type annotations
 *   • shadcn/ui Button used for the CTA; FloatingLabelInput for fields
 */

import { useState } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";

// Note: metadata exports are not supported in client components; move to a
// server wrapper if static metadata is required, or use generateMetadata().
// Left here as a reference — remove if your linter flags it.
// export const metadata: Metadata = { title: 'Sign In — FinWatch Zambia' }

export default function LoginPage() {
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Handles the sign-in action.
   * Replace the body with your real authentication call (e.g. a POST to
   * /api/auth/login or a call to your FastAPI backend).
   */
  const handleSignIn = async () => {
    if (!identifier.trim() || !password.trim()) return;
    setIsLoading(true);
    try {
      // TODO: call POST /api/auth/login with { identifier, password }
      console.log("Sign-in payload:", { identifier, password });
    } finally {
      setIsLoading(false);
    }
  };

  /** Allow Enter key on either field to trigger sign-in */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSignIn();
  };

  return (
    /*
     * The parent layout supplies px-8 pt-12 md:px-16 md:pt-20, so no
     * extra horizontal padding is needed here. We only add max-w to
     * keep the form from stretching too wide on ultra-wide screens.
     */
    <div className="flex w-full max-w-md flex-col">
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <h1 className="text-3xl font-light leading-tight text-black md:text-4xl">
        Sign into your account
      </h1>

      {/* ── Fields ───────────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col gap-6">
        <FloatingLabelInput
          id="identifier"
          label="Username or Email"
          type="text"
          autoComplete="username email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-required="true"
        />

        <FloatingLabelInput
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-required="true"
        />
      </div>

      {/* ── CTA Button ───────────────────────────────────────────────────── */}
      {/*
       * shadcn/ui Button — styling completely overridden via className.
       * tailwind-merge (inside shadcn's cn()) resolves class conflicts so
       * our classes always take precedence over the default variant styles.
       *
       * Key overrides:
       *   rounded-full   → pill shape
       *   bg-black       → black background (default state)
       *   h-14           → tall, prominent button (overrides shadcn's h-10)
       *   hover:bg-primary-hover → transitions to #5611BD on hover
       *   transition-colors duration-300 → smooth colour change
       */}
      <div className="mt-12 flex w-full flex-col items-center">
        <Button
          onClick={handleSignIn}
          disabled={isLoading}
          aria-label="Sign in to your account"
          className={[
            "h-14 w-full rounded-full",
            "bg-black text-base font-bold text-white",
            "transition-colors duration-300",
            "hover:bg-primary-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>

        {/* ── Footer link ──────────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
