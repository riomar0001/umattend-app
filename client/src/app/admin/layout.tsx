'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Calendar,
  MessageSquareWarning,
} from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/protected-routes';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/queues', label: 'Dead Letter Queue', icon: MessageSquareWarning },
];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() =>
      setHasHydrated(true)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (hasHydrated && (!user || user.role !== 'admin')) {
      router.replace('/forbidden');
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <ProtectedRoute>
      <div>
        <Navbar />
        <div className="bg-background relative min-h-screen">
          <div className="border-border/40 flex min-h-[calc(100vh-57px)]">
            <aside className="border-border/40 hidden w-56 shrink-0 border-r md:block">
              <div className="flex flex-col gap-1 px-3 py-4">
                <div className="mb-3 px-3">
                  <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Admin Panel
                  </h2>
                </div>
                {ADMIN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </aside>

            <div className="border-border/40 fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden">
              <nav className="flex justify-around py-2">
                {ADMIN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        'flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {tab.label === 'Dead Letter Queue' ? 'Queue' : tab.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <main className="flex-1 overflow-x-auto pb-16 md:pb-0">
              {children}
            </main>
          </div>
        </div>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
