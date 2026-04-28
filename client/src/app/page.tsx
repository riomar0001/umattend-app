'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ClickSpark from '@/components/ClickSpark';
import LoginForm from '@/components/auth/login-form';
import useExchangeCode from '@/hooks/useExchangeCode';
import { getUserOptions } from '@/api/client/@tanstack/react-query.gen';
import { useAuthStore } from '@/store/authStore';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticating, isError, serverMessage, exchangeCode } = useExchangeCode();
  const setAuth = useAuthStore((state) => state.setAuth);
  const updateUser = useAuthStore((state) => state.updateUser);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isDoneOnboarding = useAuthStore((state) => state.isDoneOnboarding);

  const [hasHydrated, setHasHydrated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Wait for zustand persist to rehydrate from localStorage before checking auth
  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    return unsub;
  }, []);

  const handleGoogleLogin = async () => {
    router.push('/api/v1/auth/google');
  };

  // Fetch user data after authentication
  const { data: userData } = useQuery({
    ...getUserOptions(),
    enabled: hasHydrated && isAuthenticated(),
    staleTime: Infinity,
    retry: false // Don't refetch unless manually invalidated
  });

  // Update user data in store when fetched (merge with existing JWT data)
  useEffect(() => {
    if (userData?.success && userData?.data?.user) {
      const apiUser = userData.data.user;
      const currentUser = useAuthStore.getState().user;

      // Merge API data with existing JWT data (preserve student_id from JWT)
      updateUser({
        user_id: apiUser.id,
        student_id: currentUser?.student_id, // Keep from JWT
        umindanao_email: apiUser.umindanao_email || currentUser?.umindanao_email,
        name: apiUser.name || currentUser?.name,
        department: apiUser.department || currentUser?.department,
        program: apiUser.program || currentUser?.program,
        role: (apiUser.role as 'student' | 'admin' | 'csg' | 'instructor' | 'organizer') || currentUser?.role || 'student',
        done_onboarding: apiUser.done_onboarding ?? currentUser?.done_onboarding ?? false,
        profile_picture: currentUser?.profile_picture || ''
      });
    }
  }, [userData, updateUser]);

  useEffect(() => {
    if (!hasHydrated) return;

    const auth_code = searchParams.get('auth_code');
    const error_code = searchParams.get('error_code');

    const handleAuthCode = async () => {
      if (!auth_code) return;
      const result = await exchangeCode('auth_code', auth_code);

      if (result.accessToken && result.refreshToken) {
        setAuth(result.accessToken, result.refreshToken);
      }

      router.push(!isDoneOnboarding() ? '/onboarding' : '/events');
    };

    const handleErrorCode = async () => {
      if (!error_code) return;
      await exchangeCode('error_code', error_code);
    };

    handleAuthCode();
    handleErrorCode();
  }, [hasHydrated, exchangeCode, setAuth, searchParams, router, isDoneOnboarding]);

  useEffect(() => {
    if (!hasHydrated) return;

    // If we're mid-exchange, let the auth_code effect handle redirect
    const auth_code = searchParams.get('auth_code');
    if (auth_code) return;

    if (isAuthenticated() && !isDoneOnboarding()) {
      router.replace('/onboarding');
      return;
    }

    if (isAuthenticated() && isDoneOnboarding()) {
      router.replace('/events');
      return;
    }

    // User profile is persisted but tokens are in-memory only — attempt silent refresh
    const user = useAuthStore.getState().user;
    if (user) {
      setIsRefreshing(true);
      return;
    }

    // Confirmed unauthenticated — safe to render the login form
    setIsInitializing(false);
  }, [hasHydrated, isAuthenticated, isDoneOnboarding, router, searchParams]);

  // Attempt silent token refresh when user profile exists but access token is missing
  useEffect(() => {
    if (!isRefreshing) return;

    const doRefresh = async () => {
      try {
        const response = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const { access_token } = response.data.data;
        useAuthStore.getState().replaceAccessToken(access_token);
        // Redirect based on the refreshed token's user data
        const refreshedUser = useAuthStore.getState().user;
        if (refreshedUser?.done_onboarding) {
          router.replace('/events');
        } else {
          router.replace('/onboarding');
        }
      } catch {
        useAuthStore.getState().logout();
        setIsRefreshing(false);
        setIsInitializing(false);
      }
    };

    doRefresh();
  }, [isRefreshing, router]);

  if (!hasHydrated || isInitializing || isRefreshing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <ClickSpark sparkColor="#000" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
      <LoginForm serverMessage={serverMessage} isError={isError} isAuthenticating={isAuthenticating} handleGoogleLogin={handleGoogleLogin} />
    </ClickSpark>
  );
}
