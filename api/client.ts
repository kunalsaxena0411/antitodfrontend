import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { BACKEND_URL, AUTH_CONFIG } from "../config/config";

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);

    if (token && config.headers) {
      config.headers[AUTH_CONFIG.TOKEN_HEADER] = token;
    }
    return config;
  },
  (error) => {
    console.error("[API] Request error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor - Handle errors and unauthorized access
api.interceptors.response.use(
  (response) => {
    // Prevent frontend crashes when backend is offline and Vite falls back to index.html
    const contentType = response.headers["content-type"];
    if (
      typeof response.data === "string" &&
      contentType &&
      contentType.includes("text/html")
    ) {
      console.error(
        "[API] Received HTML instead of JSON. Backend is likely down.",
      );
      return Promise.reject(
        new axios.AxiosError(
          "Received HTML instead of JSON (Backend Unreachable)",
          "ERR_INVALID_CONTENT_TYPE",
          response.config,
          response.request,
          response,
        ),
      );
    }

    return response;
  },
  (error: AxiosError) => {
    console.error(
      "[API] Response error:",
      error.response?.status,
      error.config?.url,
    );

    // Handle 401 Unauthorized - Clear token and redirect to login
    if (error.response && error.response.status === 401) {
      console.warn("[API] Unauthorized access - clearing token");
      localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
      localStorage.removeItem(AUTH_CONFIG.TOKEN_EXPIRES_KEY);
      window.dispatchEvent(new Event("auth-changed"));

      // Only redirect if not already on login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // Handle 403 Forbidden
    if (error.response && error.response.status === 403) {
      console.warn("[API] Forbidden access");
    }

    // Handle network errors
    if (!error.response) {
      console.error("[API] Network error - server may be unreachable");
    }

    return Promise.reject(error);
  },
);

export default api;

// Helper function to handle API errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: { message?: string };
    }>;

    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      return data.message || data.error?.message || "An error occurred";
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred";
};
