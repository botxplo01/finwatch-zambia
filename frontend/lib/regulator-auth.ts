/**
 * FinWatch Zambia - Regulator Auth Helpers
 *
 * Separate token namespace so regulator and SME sessions don't collide.
 */

import api from "@/lib/api";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const REG_TOKEN_KEY = "reg_token";
const REG_USER_KEY = "reg_user";

/**
 * Synchronize regulator session data to native storage.
 */
async function syncToNative(key: string, value: string | null) {
  if (Capacitor.isNativePlatform()) {
    if (value) {
      await Preferences.set({ key, value });
    } else {
      await Preferences.remove({ key });
    }
  }
}

export function getRegToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REG_TOKEN_KEY);
}

export function setRegToken(token: string): void {
  localStorage.setItem(REG_TOKEN_KEY, token);
  syncToNative(REG_TOKEN_KEY, token);
}

export function clearRegToken(): void {
  localStorage.removeItem(REG_TOKEN_KEY);
  localStorage.removeItem(REG_USER_KEY);
  syncToNative(REG_TOKEN_KEY, null);
  syncToNative(REG_USER_KEY, null);
}

export function setRegUser(user: object): void {
  const value = JSON.stringify(user);
  localStorage.setItem(REG_USER_KEY, value);
  syncToNative(REG_USER_KEY, value);
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
 */
export async function restoreRegSessionFromNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const { value: token } = await Preferences.get({ key: REG_TOKEN_KEY });
  const { value: user } = await Preferences.get({ key: REG_USER_KEY });

  if (token && user) {
    localStorage.setItem(REG_TOKEN_KEY, token);
    localStorage.setItem(REG_USER_KEY, user);
    return true;
  }
  return false;
}

export interface RegUserResponse {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export async function loginRegulator(
  email: string,
  password: string,
  long_session: boolean = false,
): Promise<{
  token: string;
  user: RegUserResponse;
}> {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const tokenRes = await api.post<{ access_token: string; token_type: string }>(
    `/api/auth/login${long_session ? "?long_session=true" : ""}`,
    formData,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  const token = tokenRes.data.access_token;

  // Temporarily store to allow the /me call to go through
  localStorage.setItem(REG_TOKEN_KEY, token);

  // Validate the role before confirming login
  const meRes = await api.get<RegUserResponse>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const normalizedRole = meRes.data.role?.toLowerCase().trim();

  if (normalizedRole === "sme_owner") {
    // SME owners are never allowed in the Institutional Portal
    localStorage.removeItem(REG_TOKEN_KEY);
    throw new Error("WRONG_ROLE");
  }

  return { token, user: meRes.data };
}

// Axios instance pre-configured with the regulator token
export function getRegAuthHeader(): Record<string, string> {
  const token = getRegToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
