'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Globe, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAdminRateLimitsOptions,
  deleteAdminRateLimitsMutation,
  deleteAdminRateLimitsByKeyMutation,
} from '@/api/client/@tanstack/react-query.gen';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  key?: string;
  count?: number;
  ttl?: number;
}

interface ParsedEntry extends RateLimitEntry {
  category: string;
  target: string;
  limit: number;
  label: string;
  group: 'ip' | 'user';
}

const CATEGORY_META: Record<string, { label: string; limit: number; group: 'ip' | 'user' }> = {
  ip: { label: 'Login', limit: 300, group: 'ip' },
  oauth: { label: 'OAuth', limit: 300, group: 'ip' },
  account: { label: 'Login', limit: 10, group: 'user' },
  checkin: { label: 'Check-in', limit: 0, group: 'user' },
};

function parseEntry(entry: RateLimitEntry): ParsedEntry {
  const key = entry.key ?? '';
  // Format: rateLimit:<category>:<target...>
  const after = key.replace('rateLimit:', '');
  const firstColon = after.indexOf(':');
  const category = firstColon > -1 ? after.slice(0, firstColon) : after;
  const rawTarget = firstColon > -1 ? after.slice(firstColon + 1) : after;

  // Resolve group, limit, and clean target
  let group: 'ip' | 'user';
  let limit: number;
  let target: string;

  if (category === 'checkin') {
    // rateLimit:checkin:ip:<ip> or rateLimit:checkin:user:<userId>
    const secondColon = rawTarget.indexOf(':');
    const sub = secondColon > -1 ? rawTarget.slice(0, secondColon) : rawTarget;
    target = secondColon > -1 ? rawTarget.slice(secondColon + 1) : rawTarget;
    if (sub === 'ip') {
      group = 'ip';
      limit = 600;
    } else {
      group = 'user';
      limit = 120;
    }
  } else {
    const meta = CATEGORY_META[category];
    group = meta?.group ?? 'ip';
    limit = meta?.limit ?? 0;
    target = rawTarget;
  }

  const meta = CATEGORY_META[category];
  const label = meta?.label ?? category;

  return { ...entry, key, category, target, limit, label, group };
}

export default function AdminRateLimitsPage() {
  const queryClient = useQueryClient();
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...getAdminRateLimitsOptions(),
    refetchInterval: 15_000,
  });

  const deleteKey = useMutation({
    ...deleteAdminRateLimitsByKeyMutation(),
    onSuccess: () => {
      toast.success('Rate limit cleared');
      queryClient.invalidateQueries({ queryKey: getAdminRateLimitsOptions({}).queryKey });
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to clear'),
  });

  const deleteAll = useMutation({
    ...deleteAdminRateLimitsMutation(),
    onSuccess: (data) => {
      toast.success(`${data?.data?.removed ?? 0} rate limits cleared`);
      setDeleteAllDialog(false);
      queryClient.invalidateQueries({ queryKey: getAdminRateLimitsOptions({}).queryKey });
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to clear all'),
  });

  const rawEntries: RateLimitEntry[] = data?.data?.entries ?? [];

  const { ipEntries, userEntries } = useMemo(() => {
    const parsed = rawEntries.map(parseEntry);
    return {
      ipEntries: parsed.filter((e) => e.group === 'ip'),
      userEntries: parsed.filter((e) => e.group === 'user'),
    };
  }, [rawEntries]);

  const total = rawEntries.length;
  const ipBlocked = ipEntries.filter((e) => (e.count ?? 0) >= e.limit * 0.8).length;
  const userBlocked = userEntries.filter((e) => (e.count ?? 0) >= e.limit * 0.8).length;

  // ------------------------------------------------------------------
  // Reusable table component
  // ------------------------------------------------------------------

  function LimitTable({ entries }: { entries: ParsedEntry[] }) {
    return (
      <div className="border-border rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>TTL</TableHead>
              <TableHead className="w-[60px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const key = entry.key ?? '';
              const count = entry.count ?? 0;
              const limit = entry.limit || 1;
              const pct = Math.round((count / limit) * 100);
              const isNear = pct >= 80;
              return (
                <TableRow key={key}>
                  <TableCell>
                    <span className="font-mono text-xs">{entry.target || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{entry.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={isNear ? 'font-medium text-amber-500' : ''}>{count}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{limit}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs">{pct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {(entry.ttl ?? -1) > 0 ? `${entry.ttl}s` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      title="Clear rate limit"
                      disabled={deleteKey.isPending}
                      onClick={() => deleteKey.mutate({ path: { key } })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rate Limits</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor and manage rate limits per IP address and per user. Clear entries to unblock throttled targets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteAll.isPending || total === 0}
            onClick={() => setDeleteAllDialog(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-muted-foreground text-xs">active entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">IP Targets</CardTitle>
            <Globe className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ipEntries.length}</p>
            <p className="text-muted-foreground text-xs">{ipBlocked} near limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">User Targets</CardTitle>
            <User className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userEntries.length}</p>
            <p className="text-muted-foreground text-xs">{userBlocked} near limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Window</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">60s</p>
            <p className="text-muted-foreground text-xs">sliding window</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : isError ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="text-lg font-medium">Failed to load rate limits</p>
          <p className="mt-1 text-sm">{(error as Error)?.message || 'An error occurred'}</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : total === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border py-16 text-center">
          <p className="font-medium">No active rate limits</p>
          <p className="text-sm">No users or IPs are currently being throttled.</p>
        </div>
      ) : (
        <Tabs defaultValue="ip">
          <TabsList>
            <TabsTrigger value="ip" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              IP ({ipEntries.length})
            </TabsTrigger>
            <TabsTrigger value="user" className="gap-1.5">
              <User className="h-3.5 w-3.5" />
              Users ({userEntries.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ip" className="mt-4">
            {ipEntries.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">No IP-based rate limits active.</div>
            ) : (
              <LimitTable entries={ipEntries} />
            )}
          </TabsContent>
          <TabsContent value="user" className="mt-4">
            {userEntries.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">No user-based rate limits active.</div>
            ) : (
              <LimitTable entries={userEntries} />
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={deleteAllDialog} onOpenChange={setDeleteAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Rate Limits</DialogTitle>
            <DialogDescription>
              This will remove all {total} rate limit entries from Redis, unblocking all
              currently throttled IPs and users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAll.isPending}
              onClick={() => deleteAll.mutate({})}
            >
              {deleteAll.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
