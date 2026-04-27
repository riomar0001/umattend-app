// store/authStore.ts
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id?: string; // Database ID
  student_id?: number; // Student ID number (e.g., 535940)
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
  isDoneOnboarding: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (accessToken: string, refreshToken: string) => {
        const decoded = jwtDecode<User>(accessToken);
        set({
          user: decoded,
          accessToken,
          refreshToken
        });
      },

      replaceAccessToken: (accessToken: string) => {
        const decoded = jwtDecode<User>(accessToken);
        set({
          user: decoded,
          accessToken
        });
      },

      updateUser: (user: User) => {
        set({ user });
      },

      logout: () => {
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

      isDoneOnboarding: () => {
        const state = get();
        return state.user?.done_onboarding ?? false;
      }
    }),
    {
      name: 'umattend',
      // Only persist the user profile — tokens stay in memory only to reduce XSS exposure
      partialize: (state) => ({ user: state.user })
    }
  )
);
