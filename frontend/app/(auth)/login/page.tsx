"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { loginUser, fetchCurrentUser, setToken, setUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSignIn = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 1. Exchange credentials for a JWT
      const tokenData = await loginUser({
        username: identifier.trim(),
        password: password.trim(),
      });

      // 2. Persist token
      setToken(tokenData.access_token);

      // 3. Fetch and persist user profile
      try {
        const user = await fetchCurrentUser();
        setUser(user);
      } catch {
        // Non-critical — dashboard will work without cached profile
      }

      // 4. Redirect to dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 400) {
        setError("Invalid username or password. Please try again.");
      } else if (status === 422) {
        setError("Please check your input and try again.");
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
    if (e.key === "Enter") handleSignIn();
  };

  return (
    <div className="flex w-full max-w-md flex-col">
      <h1 className="text-3xl font-light leading-tight text-black md:text-4xl">
        Sign into your account
      </h1>

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

      {/* Error message */}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
          {error}
        </p>
      )}

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
