import axios from "axios";
import type { ApiEnvelope, ApiErrorEnvelope } from "@/types/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

let getAccessToken: (() => string | null) | null = null;
let handleUnauthorized: (() => void) | null = null;
let refreshSession: (() => Promise<string | null>) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken?.();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;
    const requestUrl = String(originalRequest?.url ?? "");
    const isAuthRefreshRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRefreshRequest &&
      refreshSession
    ) {
      originalRequest._retry = true;
      refreshInFlight ??= refreshSession().finally(() => {
        refreshInFlight = null;
      });

      const nextAccessToken = await refreshInFlight.catch(() => null);
      if (nextAccessToken) {
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${nextAccessToken}`,
        };
        return api.request(originalRequest);
      }
    }

    if (error.response?.status === 401) {
      handleUnauthorized?.();
    }

    const payload = error.response?.data as ApiErrorEnvelope | undefined;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.message ?? error.message ?? "Request failed";

    return Promise.reject(new Error(message));
  },
);

export function configureApiClient(options: {
  getToken: () => string | null;
  onUnauthorized: () => void;
  onRefreshSession: () => Promise<string | null>;
}) {
  getAccessToken = options.getToken;
  handleUnauthorized = options.onUnauthorized;
  refreshSession = options.onRefreshSession;
}

export function unwrapEnvelope<T>(payload: ApiEnvelope<T>) {
  return payload.data;
}
