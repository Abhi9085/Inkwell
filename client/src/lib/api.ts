import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_URL;
const api = axios.create({ baseURL, withCredentials: true });
const refreshClient = axios.create({ baseURL, withCredentials: true });

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url || "";
    const isAuthEndpoint = ["/auth/login", "/auth/register", "/auth/google", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password"].some((path) => url.includes(path));

    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint || typeof window === "undefined") {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient.post("/auth/refresh").then((response) => {
          const nextToken = response.data?.token as string | undefined;
          if (!nextToken) throw new Error("Refresh response did not contain an access token");
          localStorage.setItem("token", nextToken);
          return nextToken;
        }).catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          return null;
        }).finally(() => { refreshPromise = null; });
      }
      const token = await refreshPromise;
      if (!token) return Promise.reject(error);
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return Promise.reject(error);
    }
  }
);

export async function logoutSession() {
  try { await api.post("/auth/logout"); }
  finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }
}

export default api;
