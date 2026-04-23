"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { loginUser, fetchCurrentUser, setToken, setUser, clearToken } from "@/lib/auth";
import { setRegToken, setRegUser, clearRegToken } from "@/lib/regulator-auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSignIn = async (e: React.FormEvent) => {
    // Crucial: Always prevent default at the very start
    e.preventDefault();

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

      const token = tokenData.access_token;

      // 3. Fetch user profile using the NEW token explicitly
      let userRole = "sme_owner";
      try {
        const user = await fetchCurrentUser(token);
        
        if (user.role === "sme_owner") {
          // It's an SME owner — store in SME namespace and clear any old regulator data
          setToken(token);
          setUser(user);
          clearRegToken();
          userRole = "sme_owner";
        } else {
          // It's a regulator — store in regulator namespace and clear any old SME data
          setRegToken(token);
          setRegUser(user);
          clearToken();
          userRole = user.role;
        }
      } catch (profileErr) {
        // Fallback: if profile fetch fails, treat as SME owner
        console.error("Profile fetch failed during login:", profileErr);
        setToken(token);
        clearRegToken();
        userRole = "sme_owner";
      }

      // 4. Role-aware redirect
      if (userRole === "sme_owner") {
        router.push("/dashboard");
      } else {
        router.push("/regulator");
      }
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

  return (
    <div className="flex w-full max-w-md flex-col">
      {/* Mobile-only Header */}
      <div className="mb-10 md:hidden text-center w-full">
        <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-emerald-500 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
          FinWatch Zambia
        </h2>
      </div>

      <h1 className="text-3xl font-light leading-tight text-gray-900 dark:text-zinc-100 md:text-4xl">
        Sign into your account
      </h1>

      <form onSubmit={handleSignIn} className="mt-10 flex flex-col">
        <div className="flex flex-col gap-6">
          <FloatingLabelInput
            id="identifier"
            label="Email Address"
            type="text"
            autoComplete="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-required="true"
          />

          <FloatingLabelInput
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-required="true"
          />
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
            aria-label="Sign in to your account"
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
            <span className="relative z-10">{isLoading ? "Signing in…" : "Sign in"}</span>
          </Button>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
            Don&apos;t have an account yet?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign up here
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
