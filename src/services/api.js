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
//  ROOT CAUSE OF THE DAILY BREAK:
//
//  The original interceptor fired window.location.href = "/login" on ANY
//  401. This caused a cascade:
//    1. Render's free backend sleeps after 15 min → wakes with a new JWT
//       secret → your stored JWT is now invalid → next API call returns 401.
//    2. The interceptor fires and redirects to /login.
//    3. Render's static CDN has no /login file — it's a React SPA route,
//       not a physical file. Render returned a real 404.
//    4. The page unloaded. Any in-flight Google auth request was cancelled.
//    5. The user saw "Google sign-in failed" AND a broken page.
//    6. Clearing localStorage removed the stale JWT → no 401 on next visit
//       → interceptor never fires → Google works again → repeat next day.
//
//  FIX 1: Only redirect on 401 for NON-AUTH endpoints.
//    Auth endpoints (/api/auth/**) legitimately return 401 for wrong
//    credentials. These must be handled by the form's own error handling,
//    not by a global redirect.
//
//  FIX 2: Redirect to "/" (the landing page / root) not "/login".
//    "/" always exists as a physical file (index.html) on any static host.
//    "/login" does NOT exist as a file — it's a client-side route that
//    requires the SPA rewrite rule in render.yaml to work. Even with
//    render.yaml deployed, redirecting to "/" is safer because the landing
//    page is the canonical public entry point for unauthenticated users,
//    and it always resolves correctly on every host (Render, Vercel, Netlify,
//    S3, etc.) without requiring any special routing config.
//
//  NOTE: render.yaml now includes the SPA rewrite rule, so /login will
//  also work after that is deployed. But "/" is still the better redirect
//  target for a 401 because it's the natural "you got logged out" landing.
// ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status     = error.response?.status;
    const requestUrl = error.config?.url ?? "";

    // Only auto-logout on 401 from protected (non-auth) endpoints.
    // Auth endpoints return 401 for wrong credentials — that's expected
    // and must be handled by the calling code, not this interceptor.
    const isAuthEndpoint = requestUrl.startsWith("/api/auth/");

    if (status === 401 && !isAuthEndpoint) {
      // Clear stale session data
      localStorage.removeItem("convexa_token");
      localStorage.removeItem("convexa_user");

      // Redirect to root ("/") not "/login":
      //   - "/" is always a real file (index.html) on every static host.
      //   - "/login" is a React Router route — it requires the SPA rewrite
      //     rule to be configured in render.yaml. If that rule isn't in
      //     place yet, /login returns a 404 and breaks the page entirely.
      //   - Redirecting to "/" is safe in all environments and shows the
      //     user the landing page, from which they can click "Log in".
      if (!window.location.pathname.startsWith("/")) {
        window.location.replace("/");
      } else if (window.location.pathname !== "/") {
        window.location.replace("/");
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
 * AuthResponse.java returns flat fields (id, name, email, role, token).
 * This single write handles both flat (current backend) and nested
 * (.user key) response shapes.
 */
export const storeSession = (authResponse) => {
  if (authResponse.token) {
    localStorage.setItem("convexa_token", authResponse.token);
  }

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
  register:    (data) => api.post("/api/auth/register", data),
  login:       (data) => api.post("/api/auth/login",    data),
  googleLogin: (data) => api.post("/api/auth/google",   data),
};

export default api;
