'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Wait for zustand persist to rehydrate from localStorage before checking auth
  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const state = useAuthStore.getState();

    // Already have a valid in-memory token — no need to refresh
    if (state.accessToken !== null && state.user !== null) {
      setIsChecking(false);
      return;
    }

    // User profile persisted from a previous session but no in-memory token.
    // Attempt a silent refresh using the HttpOnly refresh_token cookie.
    if (state.user) {
      axios
        .post('/api/v1/auth/refresh', {}, { withCredentials: true })
        .then((response) => {
          state.replaceAccessToken(response.data.data.access_token);
          setIsChecking(false);
        })
        .catch(() => {
          state.logout();
          router.push('/');
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

  if (!isAuthenticated()) {
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
