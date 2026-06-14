"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  accentColor?: "purple" | "emerald" | "blue" | "yellow" | "institutional";
  disabled?: boolean;
}

export default function OTPInput({
  length = 5,
  value,
  onChange,
  accentColor = "purple",
  disabled = false,
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize otp array from value prop if it changes externally
  useEffect(() => {
    if (value.length === length) {
      setOtp(value.split(""));
    } else if (value === "") {
      setOtp(new Array(length).fill(""));
    }
  }, [value, length]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newOtp = [...otp];
    // Take only the last character entered
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);
    onChange(newOtp.join(""));

    // Move to next input if value is entered
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").substring(0, length);
    if (isNaN(Number(data))) return;

    const newOtp = [...otp];
    data.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    onChange(newOtp.join(""));

    // Focus last input or first empty
    const lastIndex = data.length < length ? data.length : length - 1;
    inputRefs.current[lastIndex]?.focus();
  };

  const accentClasses = {
    purple:
      "focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20",
    emerald:
      "focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20",
    blue: "focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20",
    yellow:
      "focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20",
    institutional:
      "focus:border-black dark:focus:border-white focus:ring-black/5 dark:focus:ring-white/5",
  };

  return (
    <div className="flex justify-between gap-2 md:gap-4 w-full max-w-[320px] mx-auto">
      {otp.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className={cn(
            "w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-bold rounded-2xl border-2 transition-all outline-none",
            "bg-white dark:bg-black border-gray-100 dark:border-zinc-800",
            digit
              ? accentColor === "purple"
                ? "border-purple-500 dark:border-purple-400"
                : accentColor === "emerald"
                ? "border-emerald-500 dark:border-emerald-400"
                : accentColor === "yellow"
                ? "border-yellow-500 dark:border-yellow-400"
                : accentColor === "institutional"
                ? "border-black dark:border-white"
                : "border-blue-500 dark:border-blue-400"
              : "",
            accentClasses[accentColor],
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}
