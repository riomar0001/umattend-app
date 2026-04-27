'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAdmin, isAuthenticated, replaceAccessToken, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (isAuthenticated()) {
        setIsChecking(false);
        return;
      }

      // User profile persisted from a previous session but no in-memory token.
      // Attempt a silent refresh using the HttpOnly refresh_token cookie.
      if (user) {
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          const { access_token } = response.data.data;
          replaceAccessToken(access_token);
          setIsChecking(false);
        } catch {
          logout();
          router.push('/');
        }
      } else {
        router.push('/');
      }
    };

    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isChecking || !isAuthenticated()) {
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
