'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { refreshSession } from '@/lib/refreshSession';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [bypassAuth, setBypassAuth] = useState(false);

  // Wait for zustand persist to rehydrate from localStorage before checking auth
  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const state = useAuthStore.getState();

    // Token survived the reload and hasn't expired — no refresh needed
    if (state.accessToken !== null && state.user !== null && !state.isAccessTokenExpired()) {
      setIsChecking(false);
      return;
    }

    // Profile is known but the access token is missing or expired. Attempt a
    // silent refresh using the HttpOnly refresh_token cookie.
    if (state.user) {
      refreshSession()
        .then(() => {
          setIsChecking(false);
        })
        .catch((err) => {
          // Only log out when the refresh token itself is rejected (401).
          // Server 5xx, HMR restarts, and network errors should not kill
          // the session — render the page with the persisted user profile.
          // Individual API calls will trigger a retry via the axios interceptor.
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            state.logout();
            router.push('/');
          } else {
            setIsChecking(false);
            setBypassAuth(true);
          }
        });
    } else {
      router.push('/');
    }
  }, [hasHydrated, router]);

  if (!hasHydrated || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated() && !bypassAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin()) {
    return null;
  }

  return <>{children}</>;
}
