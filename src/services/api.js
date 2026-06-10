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
// ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("convexa_token");
      localStorage.removeItem("convexa_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────
export const storeSession = (authResponse) => {
  if (authResponse.token) {
    localStorage.setItem("convexa_token", authResponse.token);
  }
  if (authResponse.user) {
    localStorage.setItem("convexa_user", JSON.stringify(authResponse.user));
  }
  // Some backends return user fields at root level
  const user = authResponse.user ?? {
    id: authResponse.id,
    name: authResponse.name,
    email: authResponse.email,
    role: authResponse.role,
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
// ─────────────────────────────────────────
export const authAPI = {
  /**
   * Register a new user
   * @param {{ name: string, email: string, password: string }} data
   * @returns {Promise<AuthResponse>}
   */
  register: (data) => api.post("/api/auth/register", data),

  /**
   * Login an existing user
   * @param {{ email: string, password: string }} data
   * @returns {Promise<AuthResponse>}
   */
  login: (data) => api.post("/api/auth/login", data),

  /**
   * Authenticate with a Google ID token.
   * Backend verifies the token with Google, creates / looks up the user,
   * and returns the same AuthResponse (JWT + user) as regular login.
   * @param {{ credential: string }} data — credential is the raw Google ID token
   * @returns {Promise<AuthResponse>}
   */
  googleLogin: (data) => api.post("/api/auth/google", data),
};

export default api;
