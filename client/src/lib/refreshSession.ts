// lib/refreshSession.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

// A single in-flight refresh shared by every caller. Without this, a page that
// mounts ProtectedRoute and fires several API calls at once would send one
// /auth/refresh per caller.
let inFlight: Promise<string> | null = null;

/**
 * Exchange the HttpOnly refresh_token cookie for a new access token and store it.
 * Concurrent calls share the same request.
 */
export const refreshSession = (): Promise<string> => {
  if (inFlight) return inFlight;

  inFlight = axios
    .post('/api/v1/auth/refresh', {}, { withCredentials: true })
    .then((response) => {
      const { access_token } = response.data.data;
      useAuthStore.getState().replaceAccessToken(access_token);
      return access_token as string;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Returns the current access token, refreshing only when it is missing or
 * expired. A valid token is handed back untouched — no network call.
 */
export const ensureAccessToken = (): Promise<string> => {
  const { accessToken, isAccessTokenExpired } = useAuthStore.getState();

  if (accessToken && !isAccessTokenExpired()) {
    return Promise.resolve(accessToken);
  }

  return refreshSession();
};
