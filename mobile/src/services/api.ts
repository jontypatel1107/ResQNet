import axios from "axios";
import * as SecureStore from "expo-secure-store";
import {
  clearServerBaseUrlCache,
  ensureServerBaseUrl,
  getApiBaseUrl,
} from "./serverConfig";

export { getApiBaseUrl } from "./serverConfig";

type RetryableRequest = {
  _serverRetried?: boolean;
  _retry?: boolean;
  baseURL?: string;
  headers: Record<string, string>;
};

const isNetworkFailure = (error: any): boolean =>
  !error?.response || error?.code === "ERR_NETWORK" || error?.code === "ECONNABORTED";

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Discover the active backend port before the first request, then retry once
// on a transport failure in case the backend moved ports since the last call.
api.interceptors.request.use(
  async (config) => {
    await ensureServerBaseUrl();
    config.baseURL = getApiBaseUrl();

    try {
      const token = await SecureStore.getItemAsync("resqnet_access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // SecureStore not available in certain web environments
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    if (!originalRequest) return Promise.reject(error);

    if (isNetworkFailure(error) && !originalRequest._serverRetried) {
      originalRequest._serverRetried = true;
      clearServerBaseUrlCache();
      await ensureServerBaseUrl();
      originalRequest.baseURL = getApiBaseUrl();
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync("resqnet_refresh_token");
        if (refreshToken) {
          const res = await axios.post(`${getApiBaseUrl()}/auth/refresh-token`, {
            refreshToken,
          });
          if (res.data?.success && res.data.data?.accessToken) {
            await SecureStore.setItemAsync(
              "resqnet_access_token",
              res.data.data.accessToken
            );
            originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        await SecureStore.deleteItemAsync("resqnet_access_token");
        await SecureStore.deleteItemAsync("resqnet_refresh_token");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
