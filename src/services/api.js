import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

let activeWorkspaceId = null;

export const setActiveWorkspaceId = (id) => {
  activeWorkspaceId = id;
};

export const getActiveWorkspaceId = () => activeWorkspaceId;

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
    const wsId = getActiveWorkspaceId();
    if (wsId) {
      config.headers["X-Workspace-Id"] = wsId;
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
      activeWorkspaceId = null;
    }

    return Promise.reject(error);
  }
);


/**
 * Persists the JWT and user object returned by the backend.
 *
 * AuthResponse.java returns flat fields (id, name, email, token).
 */
export const storeSession = (authResponse) => {
  if (authResponse.token) {
    localStorage.setItem("convexa_token", authResponse.token);
  }

  const user = authResponse.user ?? {
    id:                   authResponse.id,
    name:                 authResponse.name,
    email:                authResponse.email,
    role:                 authResponse.role,
    companyName:          authResponse.companyName,
    companySlug:          authResponse.companySlug,
    companyLogo:          authResponse.companyLogo,
    department:           authResponse.department,
    subscriptionPlan:     authResponse.subscriptionPlan,
    subscriptionStatus:   authResponse.subscriptionStatus,
    seatLimit:            authResponse.seatLimit,
    currentSeatCount:     authResponse.currentSeatCount,
    noWorkspace:          authResponse.noWorkspace ?? false,
  };
  localStorage.setItem("convexa_user", JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem("convexa_token");
  localStorage.removeItem("convexa_user");
  activeWorkspaceId = null;
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

/**
 * Updates the cached user session's seat count fields by calling sync-seats.
 */
export const refreshSeatCount = async (apiInstance) => {
  try {
    const res = await apiInstance.post("/api/company/sync-seats");
    const { currentSeatCount } = res.data;
    const raw = localStorage.getItem("convexa_user");
    if (raw) {
      const user = JSON.parse(raw);
      user.currentSeatCount = currentSeatCount;
      localStorage.setItem("convexa_user", JSON.stringify(user));
    }
    return currentSeatCount;
  } catch (e) {
    console.warn("refreshSeatCount failed silently", e);
    return null;
  }
};

export const authAPI = {
  register:    (data) => api.post("/api/auth/register", data),
  login:       (data) => api.post("/api/auth/login",    data),
  googleLogin: (data) => api.post("/api/auth/google",   data),
};

export default api;
