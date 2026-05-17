import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely */
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

/** 
 * Format a professional name: [Title] [Name]
 * Prioritizes [Title] [Last Name], falls back to [Title] [First Name] if Last Name is too long.
 * Truncates name portion if both are too long, preserving the Title.
 */
export function formatProfessionalName(
  fullName: string,
  title?: string | null,
  maxChars: number = 16
): string {
  if (!fullName) return "";
  if (!title) return fullName;

  const parts = fullName.trim().split(" ");
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

  // Title length + 1 (space)
  const prefix = `${title} `;
  const remainingSpace = maxChars - prefix.length;

  // 1. Try Title + Last Name
  if (lastName && lastName.length <= remainingSpace) {
    return `${prefix}${lastName}`;
  }

  // 2. Try Title + First Name
  if (firstName.length <= remainingSpace) {
    return `${prefix}${firstName}`;
  }

  // 3. Both too long? Truncate the name part (First Name is safer to truncate)
  const truncatedName = firstName.substring(0, remainingSpace - 3) + "...";
  return `${prefix}${truncatedName}`;
}

/**
 * Check if a name contains professional titles.
 * Used for validation to ensure users use the dedicated Title field.
 */
export function isTitleInName(name: string): string | null {
  const val = name.toLowerCase();
  const forbiddenTitles = [
    "mr.", "mrs.", "ms.", "dr.", "prof.", 
    "mister", "missus", "doctor", "professor", "miss"
  ];
  
  for (const t of forbiddenTitles) {
    // Regex for distinct word or starting with the title
    const pattern = new RegExp(`\\b${t.replace(".", "\\.")}\\b`, "i");
    if (pattern.test(val)) {
      return t;
    }
  }
  return null;
}
