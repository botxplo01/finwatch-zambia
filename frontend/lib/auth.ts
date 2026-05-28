/**
 * FinWatch Zambia - Auth Helpers
 *
 * Token storage utilities and typed wrappers around FastAPI auth endpoints.
 */

import api from "@/lib/api";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const TOKEN_KEY = "token";
const USER_KEY = "user";

/**
 * Decode the payload of a JWT without verification (client-side expiry check).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if a JWT has expired based on its `exp` claim.
 * Returns true if expired or malformed, false if still valid.
 * Applies a 60-second safety margin to avoid edge-case races.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= payload.exp - 60;
}

/**
 * Synchronize session data to native storage for robust persistence.
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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_KEY, token);
  await syncToNative(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("prediction_draft");
  sessionStorage.removeItem("hasSeenAITooltipThisSession");
  sessionStorage.removeItem("hasSeenSmeDocsAITooltipThisSession");
  sessionStorage.removeItem("hasSeenAnalystDocsAITooltipThisSession");
  sessionStorage.removeItem("hasSeenRegulatorDocsAITooltipThisSession");
  await syncToNative(TOKEN_KEY, null);
  await syncToNative(USER_KEY, null);
}

export async function setUser(user: object): Promise<void> {
  const value = JSON.stringify(user);
  localStorage.setItem(USER_KEY, value);
  await syncToNative(USER_KEY, value);
}

export function getUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Restore session from native storage if WebView storage was lost.
 * Validates token expiry during restoration to prevent loading stale tokens.
 */
export async function restoreSessionFromNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const { value: token } = await Preferences.get({ key: TOKEN_KEY });
    const { value: user } = await Preferences.get({ key: USER_KEY });

    if (token && user && !isTokenExpired(token)) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, user);
      return true;
    }

    if (token && isTokenExpired(token)) {
      await Preferences.remove({ key: TOKEN_KEY });
      await Preferences.remove({ key: USER_KEY });
    }
  } catch (err) {
    console.warn("Session restoration from native storage failed:", err);
  }
  return false;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  title?: string;
  email: string;
  password: string;
  role: string;
  portal_type: string;
  business_scale?: "small_scale" | "medium_scale" | null;
  invitation_code?: string;
}

export interface VerificationInitiatedResponse {
  detail: string;
  email: string;
  portal_type: string;
  expires_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  full_name: string;
  title?: string;
  email: string;
  role: string;
  portal_type: string;
  business_scale?: "small_scale" | "medium_scale" | null;
  onboarding_complete: boolean;
  profile_picture_url?: string;
  original_profile_picture_url?: string;
}

// API calls

export async function loginUser(
  payload: LoginPayload,
  portal_type: string = "sme"
): Promise<VerificationInitiatedResponse> {
  const formData = new URLSearchParams();
  formData.append("username", payload.username);
  formData.append("password", payload.password);

  const response = await api.post<VerificationInitiatedResponse>(
    `/api/auth/login?portal_type=${portal_type}`,
    formData,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
}

export async function registerUser(
  payload: RegisterPayload
): Promise<VerificationInitiatedResponse> {
  const response = await api.post<VerificationInitiatedResponse>(
    "/api/auth/register",
    payload
  );
  return response.data;
}

export async function verifyOTP(
  email: string,
  portal_type: string,
  code: string,
  long_session: boolean = false
): Promise<AuthTokenResponse> {
  const response = await api.post<AuthTokenResponse>(
    `/api/auth/verify${long_session ? "?long_session=true" : ""}`,
    { email, portal_type, code }
  );
  return response.data;
}

export async function resendVerification(
  email: string,
  portal_type: string
): Promise<VerificationInitiatedResponse> {
  const response = await api.post<VerificationInitiatedResponse>(
    `/api/auth/resend-verification?email=${encodeURIComponent(
      email
    )}&portal_type=${portal_type}`
  );
  return response.data;
}

export async function checkEmailAvailability(
  email: string,
  portal_type: string = "sme"
): Promise<boolean> {
  try {
    await api.post("/api/auth/check-email", { email, portal_type });
    return true;
  } catch (err: any) {
    return false;
  }
}

export async function fetchCurrentUser(token?: string): Promise<UserResponse> {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const response = await api.get<UserResponse>("/api/auth/me", config);
  return response.data;
}
