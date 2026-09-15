// lib/axios.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { refreshSession } from './refreshSession';

export const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const { accessToken, user, isAccessTokenExpired } = useAuthStore.getState();

    // Only reach for a new token when the current one is actually expired (or
    // absent while a session is known to exist). A live token is used as-is.
    if (user && (!accessToken || isAccessTokenExpired())) {
      try {
        config.headers.Authorization = `Bearer ${await refreshSession()}`;
        return config;
      } catch {
        // Let the request go out unauthenticated; the response interceptor
        // handles the 401 and the logout decision.
      }
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { logout } = useAuthStore.getState();

      try {
        // Rely on the HttpOnly refresh_token cookie — no token in request body
        const access_token = await refreshSession();

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Only log out when the refresh token itself is rejected (401).
        // Server errors (5xx), HMR restarts, and network blips should NOT
        // kill the session — the client will retry on the next request.
        if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
          logout();
          window.location.href = '/';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
