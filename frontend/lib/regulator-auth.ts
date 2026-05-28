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
  await syncToNative(REG_TOKEN_KEY, null);
  await syncToNative(REG_USER_KEY, null);
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
 * Restore regulator session from native storage.
 * Validates token expiry during restoration to prevent loading stale tokens.
 */
export async function restoreRegSessionFromNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const { value: token } = await Preferences.get({ key: REG_TOKEN_KEY });
    const { value: user } = await Preferences.get({ key: REG_USER_KEY });

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
