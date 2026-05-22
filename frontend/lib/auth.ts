/**
 * FinWatch Zambia - Auth Helpers
 *
 * Token storage utilities and typed wrappers around FastAPI auth endpoints.
 */

import api from "@/lib/api";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// Token storage

const TOKEN_KEY = "token";
const USER_KEY = "user";

/**
 * Synchronize session data to native storage for robust persistence.
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
 */
export async function restoreSessionFromNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const { value: token } = await Preferences.get({ key: TOKEN_KEY });
  const { value: user } = await Preferences.get({ key: USER_KEY });

  if (token && user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, user);
    return true;
  }
  return false;
}

// Types

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
  business_scale?: "small_scale" | "medium_scale" | null;
  invitation_code?: string;
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
  business_scale?: "small_scale" | "medium_scale" | null;
  profile_picture_url?: string;
  original_profile_picture_url?: string;
}

// API calls

export async function loginUser(
  payload: LoginPayload,
  long_session: boolean = false,
): Promise<AuthTokenResponse> {
  const formData = new URLSearchParams();
  formData.append("username", payload.username);
  formData.append("password", payload.password);

  const response = await api.post<AuthTokenResponse>(
    `/api/auth/login${long_session ? "?long_session=true" : ""}`,
    formData,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return response.data;
}

export async function registerUser(
  payload: RegisterPayload,
): Promise<UserResponse> {
  const response = await api.post<UserResponse>("/api/auth/register", payload);
  return response.data;
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    await api.post("/api/auth/check-email", { email });
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

