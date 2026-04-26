import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely. Used by shadcn/ui components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a float as a percentage string. e.g. 0.7432 → "74.3%" */
export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a float ratio to a fixed number of decimal places. e.g. 1.234567 → "1.235" */
export function formatRatio(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

/** Return a Tailwind color class based on risk label. */
export function getRiskColor(label: string): string {
  return label === "Healthy"
    ? "text-risk-healthy"
    : "text-risk-distressed";
}

/** Return a Tailwind background class based on risk label. */
export function getRiskBgColor(label: string): string {
  return label === "Healthy"
    ? "bg-green-50 border-green-200"
    : "bg-red-50 border-red-200";
}
