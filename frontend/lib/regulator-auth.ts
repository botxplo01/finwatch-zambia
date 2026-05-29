/**
 * FinWatch Zambia - Regulator Auth Helpers
 *
 * Separate token namespace so regulator and SME sessions don't collide.
 */

import api from "@/lib/api";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { isTokenExpired } from "@/lib/auth";

const REG_TOKEN_KEY = "reg_token";
const REG_USER_KEY = "reg_user";

/**
 * Synchronize regulator session data to native storage.
 */
async function syncToNative(key: string, value: string | null) {
  if (Capacitor.isNativePlatform()) {
    try {
      if (value) {
        await Preferences.set({ key, value });
      } else {
        await Preferences.remove({ key });
      }
    } catch (err) {
      console.warn("Native sync failed for key:", key, err);
    }
  }
}

export function getRegToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REG_TOKEN_KEY);
}

export async function setRegToken(token: string): Promise<void> {
  localStorage.setItem(REG_TOKEN_KEY, token);
  await syncToNative(REG_TOKEN_KEY, token);
}

export async function clearRegToken(): Promise<void> {
  localStorage.removeItem(REG_TOKEN_KEY);
  localStorage.removeItem(REG_USER_KEY);
  sessionStorage.removeItem("glossary_button_side");
  sessionStorage.removeItem("chat_button_side");
  sessionStorage.removeItem("hasSeenAITooltipThisSession");
  sessionStorage.removeItem("hasSeenSmeDocsAITooltipThisSession");
  sessionStorage.removeItem("hasSeenAnalystDocsAITooltipThisSession");
  sessionStorage.removeItem("hasSeenRegulatorDocsAITooltipThisSession");
  
  // Clear native preferences concurrently to prevent sequential bridge blocking
  await Promise.all([
    syncToNative(REG_TOKEN_KEY, null),
    syncToNative(REG_USER_KEY, null)
  ]).catch((err) => console.warn("Regulator native session clear failed:", err));
}

export async function setRegUser(user: object): Promise<void> {
  const value = JSON.stringify(user);
  localStorage.setItem(REG_USER_KEY, value);
  await syncToNative(REG_USER_KEY, value);
}

export function getRegUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REG_USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Helper to fetch a key from Capacitor Preferences with retry logic and a strict timeout race.
 * Handles slow bridge boot scenarios gracefully on cold launch without risking infinite WebView hangs.
 */
async function getPreferencesWithRetry(key: string, retries = 2, delay = 100): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const bridgeCall = Preferences.get({ key }).then((res) => res.value);
      const timeoutCall = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Capacitor bridge query timeout")), 600)
      );
      return await Promise.race([bridgeCall, timeoutCall]);
    } catch (err) {
      console.warn(`Bridge query attempt ${i + 1} failed or timed out:`, err);
      if (i === retries - 1) return null; // Fallback to null on final failure
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}

/**
 * Restore regulator session from native storage.
 * Validates token expiry during restoration to prevent loading stale tokens.
 */
export async function restoreRegSessionFromNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const token = await getPreferencesWithRetry(REG_TOKEN_KEY);
    const user = await getPreferencesWithRetry(REG_USER_KEY);

    if (token && user && !isTokenExpired(token)) {
      localStorage.setItem(REG_TOKEN_KEY, token);
      localStorage.setItem(REG_USER_KEY, user);
      return true;
    }

    if (token && isTokenExpired(token)) {
      await Preferences.remove({ key: REG_TOKEN_KEY });
      await Preferences.remove({ key: REG_USER_KEY });
    }
  } catch (err) {
    console.warn("Regulator session restoration from native storage failed:", err);
  }
  return false;
}

import { loginUser, VerificationInitiatedResponse } from "@/lib/auth";

export interface RegUserResponse {
  id: number;
  full_name: string;
  email: string;
  role: string;
  portal_type: string;
  is_active: boolean;
}

export async function loginRegulator(
  email: string,
  password: string
): Promise<VerificationInitiatedResponse> {
  return loginUser({ username: email, password }, "institutional");
}

// Axios instance pre-configured with the regulator token
export function getRegAuthHeader(): Record<string, string> {
  const token = getRegToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
