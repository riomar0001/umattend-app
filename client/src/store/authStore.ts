// store/authStore.ts
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id?: string; // Database ID
  // Student ID number (e.g., 535940). null for accounts whose umindanao.edu.ph
  // address carries no number (`tan.jessiejames@…`) until onboarding supplies one.
  student_id?: number | null;
  umindanao_email?: string;
  name?: string;
  department?: string;
  program?: string;
  role: 'student' | 'admin' | 'csg' | 'instructor' | 'organizer' | undefined;
  done_onboarding: boolean | undefined;
  profile_picture: string | undefined;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (accessToken: string, refreshToken: string) => void;
  replaceAccessToken: (accessToken: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
  isAccessTokenExpired: () => boolean;
  isDoneOnboarding: () => boolean;
}

// The access token lives in sessionStorage rather than localStorage: it has to
// survive a page reload (otherwise every refresh forces a /auth/refresh round
// trip) but it dies with the tab, keeping the exposure window short.
const ACCESS_TOKEN_KEY = 'umattend_access_token';

// Treat a token as expired slightly early so an in-flight request can't race
// the clock and come back 401 right after we decided it was still good.
const EXPIRY_SKEW_SECONDS = 30;

const readStoredAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeStoredAccessToken = (accessToken: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (accessToken) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // Storage disabled (private mode / blocked cookies) — fall back to
    // in-memory only, which just means a refresh on the next reload.
  }
};

export const isJwtExpired = (token: string | null): boolean => {
  if (!token) return true;

  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (!exp) return true;
    return exp - EXPIRY_SKEW_SECONDS <= Date.now() / 1000;
  } catch {
    return true;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: readStoredAccessToken(),
      refreshToken: null,

      setAuth: (accessToken: string, refreshToken: string) => {
        const decoded = jwtDecode<User>(accessToken);
        writeStoredAccessToken(accessToken);
        set({
          user: decoded,
          accessToken,
          refreshToken
        });
      },

      replaceAccessToken: (accessToken: string) => {
        const decoded = jwtDecode<User>(accessToken);
        writeStoredAccessToken(accessToken);
        set({
          user: decoded,
          accessToken
        });
      },

      updateUser: (user: User) => {
        set({ user });
      },

      logout: () => {
        writeStoredAccessToken(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null
        });
        localStorage.removeItem('umattend');
      },

      isAdmin: () => {
        const state = get();
        return state.user?.role === 'admin' || state.user?.role === 'csg' || state.user?.role === 'organizer';
      },

      isAuthenticated: () => {
        const state = get();
        return state.accessToken !== null && state.user !== null;
      },

      isAccessTokenExpired: () => {
        return isJwtExpired(get().accessToken);
      },

      isDoneOnboarding: () => {
        const state = get();
        return state.user?.done_onboarding ?? false;
      }
    }),
    {
      name: 'umattend',
      // Only the user profile goes to localStorage. The access token is kept in
      // sessionStorage (see readStoredAccessToken) and the refresh token never
      // leaves the HttpOnly cookie.
      partialize: (state) => ({ user: state.user })
    }
  )
);
