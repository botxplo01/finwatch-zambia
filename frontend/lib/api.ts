/**
 * FinWatch Zambia - API Client
 *
 * Axios instance pre-configured with base URL and JWT auth interceptor.
 * Implements portal-scoped 401 handling to prevent cross-portal session wipes
 * and preserves native persistent storage on transient failures.
 */

import axios from "axios";
import { getToken, clearToken, isTokenExpired } from "@/lib/auth";
import { getInstitutionalToken, clearInstitutionalToken } from "@/lib/institutional-auth";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();
const isDev = process.env.NODE_ENV === "development";
const PROD_URL = "https://finwatch-backend.onrender.com";

let API_URL = process.env.NEXT_PUBLIC_API_URL || PROD_URL;

if (isDev && !isNative && API_URL === PROD_URL) {
  API_URL = "http://localhost:8000";
}

if (isNative) {
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

/**
 * Determine which portal the current request/page belongs to.
 */
function getActivePortal(): "institutional" | "sme" {
  if (typeof window === "undefined") return "sme";
  const path = window.location.pathname;
  if (
    path.startsWith("/institutional") ||
    path.startsWith("/regulator") ||
    path.startsWith("/analyst")
  ) {
    return "institutional";
  }
  return "sme";
}

api.interceptors.request.use((config) => {
  let token = getToken();

  if (
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/institutional") ||
      window.location.pathname.startsWith("/regulator") ||
      window.location.pathname.startsWith("/analyst"))
  ) {
    const instToken = getInstitutionalToken();
    if (instToken) token = instToken;
  }

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Let the browser set the correct Content-Type (with multipart boundary)
  // when the request body is FormData. The default "application/json" header
  // would otherwise override the auto-detected multipart content type.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

/**
 * Auth page paths that should not trigger redirect loops.
 */
const AUTH_PAGES = [
  "/sme/auth/login",
  "/sme/auth/register",
  "/institutional/auth/login",
  "/institutional/auth/register",
];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;

        if (AUTH_PAGES.some((p) => currentPath === p)) {
          return Promise.reject(error);
        }

        const activePortal = getActivePortal();

        if (activePortal === "institutional") {
          const instToken = getInstitutionalToken();
          if (instToken) {
            clearInstitutionalToken();
            window.location.replace("/institutional/auth/login");
          }
        } else {
          const smeToken = getToken();
          if (smeToken) {
            clearToken();
            window.location.replace("/sme/auth/login");
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
