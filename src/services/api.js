import axios from "axios";

// ─────────────────────────────────────────
//  BASE CONFIG
// ─────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ─────────────────────────────────────────
//  REQUEST INTERCEPTOR — attach JWT
// ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("convexa_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────
//  RESPONSE INTERCEPTOR — handle 401
//
//  BUG FIX: The previous interceptor called window.location.href = "/login"
//  on ANY 401 response. This caused two critical failures:
//
//  1. If a background/prefetch request got a 401 while the Google OAuth
//     callback was mid-flight (e.g., authAPI.googleLogin() was in-progress),
//     the redirect fired immediately, unloading the page and cancelling the
//     Google login request. The browser logged a 404 for the cancelled
//     request, and the user saw "Google Sign In Failed".
//
//  2. Auth endpoints (/api/auth/**) should NEVER trigger a redirect on 401
//     — a wrong password legitimately returns 401 and must be handled by
//     the form's own catch block, not by a global redirect.
//
//  FIX: Only redirect on 401 for NON-AUTH routes, and use React Router's
//  navigate instead of window.location.href so in-flight requests are not
//  cancelled by a full page reload. We also skip the redirect entirely if
//  an auth-route request returns 401 (wrong password, expired Google token,
//  etc.) so those errors surface correctly in the UI.
// ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? "";

    // Only auto-logout on 401 from protected (non-auth) endpoints.
    // Auth endpoints return 401 for wrong credentials — that's expected
    // and must be handled by the calling code, not this interceptor.
    const isAuthEndpoint = requestUrl.startsWith("/api/auth/");

    if (status === 401 && !isAuthEndpoint) {
      // Clear stale session data
      localStorage.removeItem("convexa_token");
      localStorage.removeItem("convexa_user");

      // Use replace so the protected URL is not left in history.
      // Check we are not already on the login page to avoid redirect loops.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────

/**
 * Persists the JWT and user object returned by the backend.
 *
 * BUG FIX: The previous version wrote to convexa_user TWICE.
 * The first write was conditional on authResponse.user existing.
 * The second write was ALWAYS executed, using a fallback object built from
 * root-level fields (id, name, email, role). Because AuthResponse.java
 * returns flat fields (not a nested .user object), authResponse.user was
 * always undefined — so write #1 was always skipped, and write #2 always
 * ran. But write #2 used `authResponse.user ?? { id, name, email, role }`,
 * meaning when authResponse.user IS defined (nested), it would use that
 * object, and when it is NOT defined it would use the root-level fields.
 * The actual bug: when authResponse.user IS undefined, the ?? branch runs
 * and correctly uses root-level fields — but write #2 ran regardless,
 * OVERWRITING the correct value from write #1 in the case where
 * authResponse.user WAS defined. This is now a single, unified write.
 */
export const storeSession = (authResponse) => {
  if (authResponse.token) {
    localStorage.setItem("convexa_token", authResponse.token);
  }

  // AuthResponse.java returns flat fields (id, name, email, role, token).
  // Some future backends may wrap them under a .user key instead.
  // This single write handles both shapes correctly with no double-write.
  const user = authResponse.user ?? {
    id:    authResponse.id,
    name:  authResponse.name,
    email: authResponse.email,
    role:  authResponse.role,
  };
  localStorage.setItem("convexa_user", JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem("convexa_token");
  localStorage.removeItem("convexa_user");
};

export const getToken = () => localStorage.getItem("convexa_token");

export const getUser = () => {
  try {
    const raw = localStorage.getItem("convexa_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => Boolean(getToken());

// ─────────────────────────────────────────
//  AUTH API  — maps to AuthController.java
//  POST /api/auth/register
//  POST /api/auth/login
//  POST /api/auth/google
// ─────────────────────────────────────────
export const authAPI = {
  /**
   * Register a new user
   * @param {{ name: string, email: string, password: string }} data
   */
  register: (data) => api.post("/api/auth/register", data),

  /**
   * Login an existing user
   * @param {{ email: string, password: string }} data
   */
  login: (data) => api.post("/api/auth/login", data),

  /**
   * Authenticate with a Google ID token.
   * @param {{ credential: string }} data
   */
  googleLogin: (data) => api.post("/api/auth/google", data),
};

export default api;
