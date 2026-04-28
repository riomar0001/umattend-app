'use client';

import { useEffect, useState } from 'react';
import { Users, Calendar, MessageSquareWarning, Gauge } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/protected-routes';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/authStore';

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/queues', label: 'Dead Letter Queue', icon: MessageSquareWarning },
  { href: '/admin/rate-limits', label: 'Rate Limits', icon: Gauge }
];

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
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
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader className="px-3 py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link href="/admin">
                    <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                      <Users className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">Admin Panel</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarMenu>
                {ADMIN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.href);
                  return (
                    <SidebarMenuItem key={tab.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={tab.href}>
                          <Icon />
                          <span>{tab.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <Navbar sidebarTrigger={<SidebarTrigger className="-ml-1" />} />
          <main className="flex-1">{children}</main>
          <Footer />
        </SidebarInset>
        <SidebarRail />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
