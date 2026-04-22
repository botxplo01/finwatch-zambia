// =============================================================================
// FinWatch Zambia — API Client
// Axios instance pre-configured with base URL and JWT auth interceptor.
// =============================================================================

import axios from "axios";
import { getToken, clearToken } from "@/lib/auth";
import { getRegToken, clearRegToken } from "@/lib/regulator-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,   // 30s — allows for NLP inference latency
});

// Attach JWT token to every request if present
// Prioritizes reg_token if the current path is /regulator
api.interceptors.request.use((config) => {
  let token = getToken();

  // If on a regulator route, use the reg_token
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/regulator")) {
    const regToken = getRegToken();
    if (regToken) token = regToken;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear tokens and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      clearRegToken();
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        // Only redirect (refresh) if we're not already on the login/register pages
        if (currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/regulator/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
