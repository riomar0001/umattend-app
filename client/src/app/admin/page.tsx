'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, ClipboardCheck, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import axiosInstance from '@/lib/axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Breakdown {
  label: string;
  count: number;
}

interface Stats {
  users: {
    total: number;
    deleted: number;
    onboarded: number;
    pendingOnboarding: number;
    newLast30Days: number;
    activeLast7Days: number;
    scannableStudents: number;
    byRole: Breakdown[];
  };
  events: {
    total: number;
    draft: number;
    published: number;
    upcoming: number;
    ongoing: number;
    done: number;
    newLast30Days: number;
    byDepartment: Breakdown[];
  };
  attendance: {
    total: number;
    checkedOut: number;
    stillCheckedIn: number;
    last7Days: number;
    averagePerRunEvent: number;
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 1,284 / 12.9K / 4.2M — keeps stat tiles to a readable width. */
function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

const TITLE_CASE_EXCEPTIONS: Record<string, string> = { csg: 'CSG' };

function label(value: string): string {
  return TITLE_CASE_EXCEPTIONS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/**
 * Stat tile — label, value, and an optional supporting line.
 *
 * A single current number is a tile, not a one-bar chart. The value uses the
 * font's proportional figures; tabular-nums is reserved for the breakdown
 * columns below, where digits must line up vertically.
 */
function StatTile({
  icon: Icon,
  label: tileLabel,
  value,
  hint
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{tileLabel}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{compact(value)}</div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Horizontal magnitude bars, one hue.
 *
 * The job here is "compare magnitude", not "tell series apart", so this is a
 * sequential single hue rather than a categorical palette — bar length carries
 * the value and colour carries nothing, which is why there is no legend. Marks
 * are capped at 10px with a 4px rounded data-end, and values sit at the tip;
 * the text stays in ink tokens rather than wearing the data colour.
 */
function BreakdownBars({ title, rows, empty }: { title: string; rows: Breakdown[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs" title={row.label}>
                    {label(row.label)}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{row.count.toLocaleString()}</span>
                </div>
                {/* Track is a muted surface step, not a lighter tint of the data hue,
                    so an empty bar never reads as a small value. */}
                <div className="bg-muted h-2.5 w-full overflow-hidden rounded-sm">
                  <div
                    className="h-full rounded-r-[4px] bg-[var(--viz-bar)]"
                    style={{ width: `${Math.max((row.count / max) * 100, row.count > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Small key/value strip for the secondary numbers that don't warrant a tile. */
function MiniStat({ label: miniLabel, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-muted-foreground text-xs">{miniLabel}</span>
      <span className="text-sm font-medium tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      // Path is relative to the instance's baseURL, which already carries /api/v1.
      const res = await axiosInstance.get<{ data: Stats }>('/admin/stats');
      return res.data.data;
    },
    staleTime: 60_000
  });

  const stats = statsQuery.data;

  return (
    /* The two data-colour steps are declared here rather than inline so light
       and dark swap in one place. Both were validated against this app's own
       card surfaces (#ffffff / oklch(0.205 0 0)) — lightness band, chroma floor
       and 3:1 contrast all pass. */
    <div
      className="px-4 py-6 sm:px-6 lg:px-8 [--viz-bar:#2a78d6] dark:[--viz-bar:#3987e5]"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Users, events and attendance at a glance.</p>
        </div>
        <Button variant="outline" size="sm" disabled={statsQuery.isFetching} onClick={() => statsQuery.refetch()}>
          <RefreshCw className={`mr-1 h-4 w-4 ${statsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {statsQuery.isError && (
        <Card className="mb-6 border-red-500/40">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 text-sm">Could not load statistics.</div>
            <Button variant="outline" size="sm" onClick={() => statsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {statsQuery.isLoading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Users} label="Users" value={stats.users.total} hint={`${stats.users.newLast30Days.toLocaleString()} joined in the last 30 days`} />
            <StatTile icon={Activity} label="Active users" value={stats.users.activeLast7Days} hint="Signed in within 7 days" />
            <StatTile icon={Calendar} label="Events" value={stats.events.total} hint={`${stats.events.published.toLocaleString()} published, ${stats.events.draft.toLocaleString()} draft`} />
            <StatTile icon={ClipboardCheck} label="Check-ins" value={stats.attendance.total} hint={`${stats.attendance.last7Days.toLocaleString()} in the last 7 days`} />
          </div>

          {/* Breakdowns */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <BreakdownBars title="Users by role" rows={stats.users.byRole} empty="No users yet." />
            <BreakdownBars
              title="Events by status"
              rows={[
                { label: 'upcoming', count: stats.events.upcoming },
                { label: 'ongoing', count: stats.events.ongoing },
                { label: 'done', count: stats.events.done },
                { label: 'draft', count: stats.events.draft }
              ]}
              empty="No events yet."
            />
            <BreakdownBars title="Events by department" rows={stats.events.byDepartment} empty="No events yet." />
          </div>

          {/* Secondary numbers */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-border divide-y">
                  <MiniStat label="Onboarded" value={stats.users.onboarded} />
                  <MiniStat label="Pending onboarding" value={stats.users.pendingOnboarding} />
                  <MiniStat label="Students with a scannable ID" value={stats.users.scannableStudents} />
                  <MiniStat label="Soft-deleted" value={stats.users.deleted} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-border divide-y">
                  <MiniStat label="Checked out" value={stats.attendance.checkedOut} />
                  <MiniStat label="Still checked in" value={stats.attendance.stillCheckedIn} />
                  <MiniStat label="Average per event held" value={stats.attendance.averagePerRunEvent} />
                  <MiniStat label="Events created in last 30 days" value={stats.events.newLast30Days} />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
