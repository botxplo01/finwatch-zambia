// =============================================================================
// FinWatch Zambia — Regulator Auth Helpers
// Separate token namespace so regulator and SME sessions don't collide.
// =============================================================================

import api from "@/lib/api";

const REG_TOKEN_KEY = "reg_token";
const REG_USER_KEY = "reg_user";

export function getRegToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REG_TOKEN_KEY);
}

export function setRegToken(token: string): void {
  localStorage.setItem(REG_TOKEN_KEY, token);
}

export function clearRegToken(): void {
  localStorage.removeItem(REG_TOKEN_KEY);
  localStorage.removeItem(REG_USER_KEY);
}

export function setRegUser(user: object): void {
  localStorage.setItem(REG_USER_KEY, JSON.stringify(user));
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

export interface RegUserResponse {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

// Login using the same /api/auth/login endpoint — role is validated client-side
// after fetching /api/auth/me to confirm portal access.
export async function loginRegulator(
  email: string,
  password: string,
): Promise<{
  token: string;
  user: RegUserResponse;
}> {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const tokenRes = await api.post<{ access_token: string; token_type: string }>(
    "/api/auth/login",
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

  if (!["policy_analyst", "regulator"].includes(meRes.data.role)) {
    // Role not permitted — remove token and throw
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
