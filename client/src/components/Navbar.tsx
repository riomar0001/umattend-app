'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Plus } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Skeleton } from './ui/skeleton';
import { postAuthLogoutMutation } from '@/api/client/@tanstack/react-query.gen';
import { getInitials, formatTimeWithTimezone } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const Navbar = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Mutation for logout
  const logoutMutation = useMutation({
    mutationFn: postAuthLogoutMutation().mutationFn,
    onSuccess: () => {
      // Clear local auth state
      logout();
      // Redirect to home page
      router.push('/');
      toast.success('Logged out successfully');
    },
    onError: (error: unknown) => {
      // Even if API call fails, clear local state and redirect
      console.error('Logout error:', error);
      logout();
      router.push('/');
      toast.info('Logged out');
    }
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch user data after authentication

  const studentData = {
    name: user?.name || 'User',
    idNumber: user?.student_id?.toString() || 'N/A',
    email: user?.umindanao_email || 'N/A'
  };

  const logoutUser = () => {
    // Call logout API (refresh token will be sent from cookies or can be in Authorization header)
    logoutMutation.mutate({});
  };

  return (
    <header className="border-border bg-background sticky top-0 z-50 border-b">
      <div className="container mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="hover:bg-muted rounded-md bg-transparent p-2 transition-colors lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={18} />
          </div>

          <Link href="/events" className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-balance">
              <span className="text-yellow-500">UM</span>
              <span className="text-foreground">Attend</span>
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden items-center gap-6 md:flex">
            {user?.role && ['admin', 'organizer', 'csg'].includes(user.role) && (
              <Link href="/events/new">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground hidden cursor-pointer font-medium sm:flex">
                  Create Event
                </Button>
              </Link>
            )}
          </nav>

          <span className="text-muted-foreground hidden text-xs lg:inline">{formatTimeWithTimezone(now)}</span>
          <ThemeToggle />

          <Popover>
            <PopoverTrigger className="cursor-pointer">
              {!user ? (
                <Skeleton className="h-8 w-8 rounded-full bg-neutral-200" />
              ) : (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profile_picture || undefined} />
                  <AvatarFallback className="bg-foreground text-background text-sm font-semibold">{getInitials(studentData.name)}</AvatarFallback>
                </Avatar>
              )}
            </PopoverTrigger>
            <PopoverContent className="mt-3 w-64 rounded-xl border border-border p-0 shadow-lg" align="end">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profile_picture || undefined} alt={studentData.name} />
                    <AvatarFallback className="bg-foreground text-background text-sm font-semibold">{getInitials(studentData.name)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-sm font-semibold">{studentData.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{studentData.email}</span>
                </div>
              </div>
              <div className="flex flex-col py-1">
                <div
                  className="hover:bg-muted cursor-pointer justify-start bg-transparent px-4 py-3 text-left text-xs font-normal transition-colors"
                  onClick={() => router.push('/profile')}
                >
                  View Profile
                </div>
                <div
                  className="hover:bg-muted cursor-pointer justify-start bg-transparent px-4 py-3 text-left text-xs font-normal transition-colors"
                  onClick={() => router.push('/profile/settings')}
                >
                  Account Settings
                </div>
                <div
                  className="hover:bg-muted cursor-pointer justify-start bg-transparent px-4 py-3 text-left text-xs font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={logoutUser}
                  style={{ opacity: logoutMutation.isPending ? 0.5 : 1 }}
                >
                  {logoutMutation.isPending ? 'Signing Out...' : 'Sign Out'}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <h1 className="font-bold text-balance">
                <span className="text-yellow-500">UM</span>
                <span className="text-foreground">Attend</span>
              </h1>
            </SheetTitle>
          </SheetHeader>
          <nav className="mx-3 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-muted-foreground text-sm">{formatTimeWithTimezone(now)}</span>
            </div>

            {user?.role && ['admin', 'organizer', 'csg'].includes(user.role) && (
              <Link href="/events/new" onClick={() => setIsMobileMenuOpen(false)}>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full font-medium">
                  <Plus size={16} className="mr-2" />
                  Create Event
                </Button>
              </Link>
            )}
            <div className="border-border/40 border-b" />
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default Navbar;
