import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status     = error.response?.status;
    const requestUrl = error.config?.url ?? "";

    const isAuthEndpoint = requestUrl.startsWith("/api/auth/");

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("convexa_token");
      localStorage.removeItem("convexa_user");

      const authPaths = ["/", "/login", "/register"];
      if (!authPaths.includes(window.location.pathname)) {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);


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
    companyName: authResponse.companyName,
    companyLogo: authResponse.companyLogo,
    department: authResponse.department,
    managerName: authResponse.managerName,
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

export const authAPI = {
  register:    (data) => api.post("/api/auth/register", data),
  login:       (data) => api.post("/api/auth/login",    data),
  googleLogin: (data) => api.post("/api/auth/google",   data),
};

export default api;
