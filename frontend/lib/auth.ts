// =============================================================================
// FinWatch Zambia — Auth Helpers
// Token storage utilities + typed wrappers around the FastAPI auth endpoints.
// =============================================================================

import api from "@/lib/api";

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "token";
const USER_KEY = "user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setUser(user: object): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  username: string; // FastAPI OAuth2PasswordRequestForm uses 'username'
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  username: string;
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  full_name: string;
  username: string;
  email: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * FastAPI expects OAuth2 form data (application/x-www-form-urlencoded),
 * not JSON — so we use URLSearchParams, not a plain object.
 */
export async function loginUser(
  payload: LoginPayload,
): Promise<AuthTokenResponse> {
  const formData = new URLSearchParams();
  formData.append("username", payload.username);
  formData.append("password", payload.password);

  const response = await api.post<AuthTokenResponse>(
    "/api/v1/auth/login",
    formData,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return response.data;
}

/**
 * POST /api/v1/auth/register
 * Standard JSON body.
 */
export async function registerUser(
  payload: RegisterPayload,
): Promise<UserResponse> {
  const response = await api.post<UserResponse>(
    "/api/v1/auth/register",
    payload,
  );
  return response.data;
}

/**
 * GET /api/v1/auth/me
 * Fetch the current user's profile (uses JWT from interceptor).
 */
export async function fetchCurrentUser(): Promise<UserResponse> {
  const response = await api.get<UserResponse>("/api/v1/auth/me");
  return response.data;
}
