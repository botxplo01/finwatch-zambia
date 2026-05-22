/**
 * FinWatch Zambia - API Client
 *
 * Axios instance pre-configured with base URL and JWT auth interceptor.
 */

import axios from "axios";
import { getToken, clearToken } from "@/lib/auth";
import { getRegToken, clearRegToken } from "@/lib/regulator-auth";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();
const isDev = process.env.NODE_ENV === "development";
const PROD_URL = "https://finwatch-backend.onrender.com";

// Priority logic to prevent accidental production connection
let API_URL = process.env.NEXT_PUBLIC_API_URL || PROD_URL;

if (isDev && !isNative && API_URL === PROD_URL) {
  // Dev environment: use local backend
  API_URL = "http://localhost:8000";
}

if (isNative) {
  // Android/iOS point to production URL
  API_URL = PROD_URL;
}

console.log(
  `Initializing API in ${isNative ? "Native" : "Web"} (${
    process.env.NODE_ENV
  }) mode with URL:`,
  API_URL
);

const api = axios.create({
  baseURL: API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 300_000,
});

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  let token = getToken();

  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/regulator")
  ) {
    const regToken = getRegToken();
    if (regToken) token = regToken;
  }

  if (token && !config.headers.Authorization) {
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
        if (
          currentPath !== "/login" &&
          currentPath !== "/register" &&
          currentPath !== "/regulator/auth/login" &&
          currentPath !== "/regulator/auth/register"
        ) {
          if (currentPath.startsWith("/regulator")) {
            window.location.href = "/regulator/auth/login";
          } else {
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
