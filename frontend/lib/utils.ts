import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks the current state of camera permission.
 * Returns 'unsupported' if the browser doesn't support the Permissions API.
 */
export async function getCameraPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  if (
    typeof navigator === "undefined" ||
    !navigator.permissions ||
    !navigator.permissions.query
  ) {
    return "unsupported";
  }

  try {
    const result = await navigator.permissions.query({
      name: "camera" as any,
    });
    return result.state as any;
  } catch (err) {
    console.warn("Failed to query camera permission:", err);
    return "unsupported";
  }
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
  return label === "Healthy" ? "text-risk-healthy" : "text-risk-distressed";
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
    "mr.",
    "mrs.",
    "ms.",
    "dr.",
    "prof.",
    "mister",
    "missus",
    "doctor",
    "professor",
    "miss",
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

/**
 * Remove markdown formatting artifacts for clean plain-text previews.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    // Remove bold and italic markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove headers
    .replace(/^#+\s+/gm, "")
    // Remove inline code
    .replace(/`(.*?)`/g, "$1")
    // Remove markdown links [text](url)
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, "")
    // Remove multiple newlines
    .replace(/\n+/g, " ")
    .trim();
}

/** Parse an ISO date/time string ensuring it's treated as UTC if naive */
export function parseISO(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`);
}

/** Format a date locale-aware */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format a time locale-aware, enforcing 24-hour format */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return parseISO(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format a datetime locale-aware, enforcing 24-hour format */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return parseISO(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

