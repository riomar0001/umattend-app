'use client';

import { Globe, Monitor, MapPin, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthLoginHistoryOptions } from '@/api/client/@tanstack/react-query.gen';

const LoginHistorySkeleton = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="space-y-2 rounded-lg border p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

const formatLocation = (city?: string, region?: string, country?: string) => {
  const parts = [city, region, country].filter(Boolean);
  if (parts.length === 0) return 'Unknown Location';

  if (parts.every((part) => part === 'Local')) return 'Local Network';

  if (city && country && city !== 'Local') {
    return `${city}, ${country}`;
  }

  return parts.join(', ');
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

type LoginHistoryEntry = {
  id?: string;
  ip_address?: string;
  browser?: string;
  os?: string;
  device?: string;
  city?: string;
  region?: string;
  country?: string;
  created_at?: string;
};

export const LoginHistoryTable = () => {
  const { data, isLoading, isError } = useQuery({
    ...getAuthLoginHistoryOptions(),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const loginHistory = (data?.data?.login_history || []).slice(0, 10) as LoginHistoryEntry[];

  if (isError) {
    return (
      <Card className="border-border border shadow-sm">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-foreground text-lg font-semibold">Login History</CardTitle>
          <CardDescription className="text-muted-foreground">View your recent login activity</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <Globe className="text-muted-foreground/50 mb-3 h-12 w-12" />
            <p className="text-sm">Failed to load login history</p>
            <p className="text-xs">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border border shadow-sm">
      <CardHeader className="border-border border-b pb-4">
        <CardTitle className="text-foreground text-lg font-semibold">Login History</CardTitle>
        <CardDescription className="text-muted-foreground">Your 10 most recent login sessions</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <LoginHistorySkeleton />
        ) : loginHistory.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <History className="text-muted-foreground/50 mb-3 h-12 w-12" />
            <p className="text-sm font-medium">No login history found</p>
            <p className="text-xs">Your login activity will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loginHistory.map((entry) => {
              const location = formatLocation(entry.city, entry.region, entry.country);
              const browser = entry.browser || 'Unknown Browser';
              const os = entry.os || 'Unknown OS';
              const device = entry.device || 'Unknown Device';
              const ipAddress = entry.ip_address || 'Unknown IP';
              const dateTime = formatDateTime(entry.created_at);

              return (
                <div key={entry.id} className="border-border hover:bg-muted/50 rounded-lg border p-4 transition-colors">
                  {/* Date / time header */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-foreground text-xs font-semibold">{dateTime}</span>
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-mono text-xs">
                      {ipAddress}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">{location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      <span className="text-foreground text-sm">{device} · {os}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      <span className="text-foreground text-sm">{browser}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
