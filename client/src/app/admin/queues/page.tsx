'use client';

import { useState } from 'react';
import { RefreshCw, Trash2, RotateCcw, AlertTriangle, Inbox, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  getAdminQueuesOptions,
  getAdminQueuesByQueueNameFailedOptions,
  postAdminQueuesByQueueNameFailedByJobIdRetryMutation,
  deleteAdminQueuesByQueueNameFailedByJobIdMutation,
  postAdminQueuesByQueueNameFailedRetryAllMutation,
  deleteAdminQueuesByQueueNameFailedMutation
} from '@/api/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueInfo {
  name: string;
  inspectable: boolean;
  note: string;
}

interface FailedJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  /**
   * Null when the platform dead-lettered the job rather than the consumer —
   * a crash or CPU timeout, where no catch block ran to record a reason.
   */
  failedReason: string | null;
  queue: string | null;
  attemptsMade: number;
  timestamp: number | null;
}

interface FailedResponse {
  data: FailedJob[];
  backlog: number;
  truncated: boolean;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * A thrown Error serialises as "Name: message\n  at frame…". The first line
 * carries the whole diagnosis; the stack only matters once you are already
 * looking closely, so it stays in the detail sheet.
 */
function errorHeadline(reason: string): string {
  return reason.split('\n')[0].trim();
}

/**
 * One-line gist of a job, chosen per type rather than dumping JSON — the
 * payload column is for recognising *which* job this is at a glance.
 */
function summarise(job: FailedJob): string {
  const d = job.data ?? {};
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : undefined);

  switch (job.name) {
    case 'send-email':
      return [str('to'), str('subject')].filter(Boolean).join(' — ') || '(no recipient)';
    case 'event-start':
    case 'event-done':
      return str('event_id') ? `event ${str('event_id')}` : '(no event id)';
    default: {
      const keys = Object.keys(d);
      return keys.length ? keys.slice(0, 4).join(', ') : '(empty)';
    }
  }
}

const Th = ({ label }: { label: string }) => <div className="text-foreground text-xs font-medium md:text-sm">{label}</div>;

/** Key/value row used throughout the detail sheet. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 py-1.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="min-w-0 text-xs wrap-break-word">{children}</div>
    </div>
  );
}

/** Scrollable monospace block for stacks and JSON. */
function CodeBlock({ children, tone = 'default' }: { children: string; tone?: 'default' | 'danger' }) {
  return (
    <pre
      className={`bg-muted/50 max-h-80 overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${
        tone === 'danger' ? 'text-red-600 dark:text-red-400' : ''
      }`}
    >
      {children}
    </pre>
  );
}

export default function AdminQueuesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<'clean' | 'retry-all' | null>(null);
  const [selected, setSelected] = useState<FailedJob | null>(null);

  // The queue list is only used to discover the environment's DLQ name, which
  // differs between production and staging.
  const queuesQuery = useQuery(getAdminQueuesOptions());
  const queues = (queuesQuery.data?.data as QueueInfo[] | undefined) ?? [];
  const dlq = queues.find((q) => q.inspectable);

  const failedQuery = useQuery({
    ...getAdminQueuesByQueueNameFailedOptions({
      path: { queueName: dlq?.name ?? '' },
      query: { page, limit: PAGE_SIZE }
    }),
    // Deliberately not polled. Listing pulls messages, and every pull increments
    // a message's delivery attempts — a timer would age messages out on its own.
    refetchOnWindowFocus: false,
    enabled: Boolean(dlq)
  });

  const failed = failedQuery.data?.data as FailedResponse | undefined;
  const jobs = failed?.data ?? [];
  const backlog = failed?.backlog ?? 0;
  const pagination = failed?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };

  function invalidateAll() {
    queryClient.invalidateQueries({
      queryKey: getAdminQueuesByQueueNameFailedOptions({ path: { queueName: dlq?.name ?? '' } }).queryKey
    });
  }

  const retryJob = useMutation({
    ...postAdminQueuesByQueueNameFailedByJobIdRetryMutation(),
    onSuccess: () => {
      toast.success('Job re-queued');
      setSelected(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to retry job'))
  });

  const deleteJob = useMutation({
    ...deleteAdminQueuesByQueueNameFailedByJobIdMutation(),
    onSuccess: () => {
      toast.success('Job discarded');
      setSelected(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to discard job'))
  });

  const retryAll = useMutation({
    ...postAdminQueuesByQueueNameFailedRetryAllMutation(),
    onSuccess: (data) => {
      const result = data?.data as { retried?: number; skipped?: number } | undefined;
      const skipped = result?.skipped ?? 0;
      toast.success(`${result?.retried ?? 0} jobs re-queued${skipped ? `, ${skipped} skipped` : ''}`);
      setConfirmDialog(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to retry jobs'))
  });

  const cleanAll = useMutation({
    ...deleteAdminQueuesByQueueNameFailedMutation(),
    onSuccess: (data) => {
      const removed = (data?.data as { removed?: number } | undefined)?.removed ?? 0;
      toast.success(`${removed} jobs discarded`);
      setConfirmDialog(null);
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to discard jobs'))
  });

  const busy = retryAll.isPending || cleanAll.isPending;
  const rowBusy = retryJob.isPending || deleteJob.isPending;

  // ------------------------------------------------------------------
  // Columns
  // ------------------------------------------------------------------
  const columns: ColumnDef<FailedJob>[] = [
    {
      accessorKey: 'name',
      header: () => <Th label="Type" />,
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-[10px] whitespace-nowrap md:text-xs">
          {row.original.name}
        </Badge>
      )
    },
    {
      accessorKey: 'failedReason',
      header: () => <Th label="Failed Reason" />,
      cell: ({ row }) => {
        const reason = row.original.failedReason;
        if (!reason) {
          return (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs" title="No consumer recorded a reason — the platform dead-lettered this job after a crash or timeout. Check Workers logs.">
              <FileWarning className="h-3.5 w-3.5 shrink-0" />
              <span className="italic">Not recorded</span>
            </div>
          );
        }
        return (
          <div className="max-w-80 truncate font-mono text-[11px] text-red-600 md:text-xs dark:text-red-400" title={errorHeadline(reason)}>
            {errorHeadline(reason)}
          </div>
        );
      }
    },
    {
      accessorKey: 'data',
      header: () => <Th label="Payload" />,
      cell: ({ row }) => (
        <div className="text-muted-foreground max-w-70 truncate text-xs" title={summarise(row.original)}>
          {summarise(row.original)}
        </div>
      )
    },
    {
      accessorKey: 'attemptsMade',
      header: () => <Th label="Tries" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.attemptsMade}
        </Badge>
      )
    },
    {
      accessorKey: 'timestamp',
      header: () => <Th label="Failed" />,
      cell: ({ row }) => {
        const ts = row.original.timestamp;
        return <div className="text-muted-foreground text-xs whitespace-nowrap">{ts ? new Date(ts).toLocaleString() : '—'}</div>;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right text-xs font-medium md:text-sm">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelected(row.original)}>
            View
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dead Letter Queue</h1>
        <p className="text-muted-foreground mt-1 text-sm">Jobs that exhausted their retries. Re-queue them to run again, or discard them.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{dlq?.name ?? 'Dead letter queue'}</CardTitle>
            {backlog > 0 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Inbox className="text-muted-foreground h-4 w-4" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${backlog > 0 ? 'text-red-500' : ''}`}>{failedQuery.isLoading ? '—' : backlog}</div>
            <p className="text-muted-foreground mt-1 text-xs">{backlog === 1 ? 'message waiting' : 'messages waiting'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Not inspectable</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {queues
                .filter((q) => !q.inspectable)
                .map((q) => (
                  <li key={q.name} className="font-mono">
                    {q.name}
                  </li>
                ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">Queues with a Worker consumer cannot be read — depth and contents are unavailable from the API.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-2 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Failed Jobs</h2>
        {failed?.truncated && (
          <p className="text-muted-foreground text-sm">
            Showing the first {jobs.length} of {backlog}. The queue API returns one batch at a time and has no cursor.
          </p>
        )}
      </div>

      <DataTable
        columns={columns}
        data={jobs}
        searchPlaceholder="Search jobs..."
        searchValue=""
        onSearchChange={() => {}}
        page={pagination.page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        isLoading={failedQuery.isLoading}
        error={failedQuery.isError ? failedQuery.error : undefined}
        emptyMessage="No failed jobs — nothing has exhausted its retries."
        toolbar={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={failedQuery.isFetching} onClick={() => failedQuery.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" disabled={busy || backlog === 0} onClick={() => setConfirmDialog('retry-all')}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Retry All
            </Button>
            <Button variant="outline" size="sm" disabled={busy || backlog === 0} onClick={() => setConfirmDialog('clean')}>
              <Trash2 className="mr-1 h-4 w-4" />
              Discard All
            </Button>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* Detail sheet                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selected.name}
                  </Badge>
                  Failed job
                </SheetTitle>
                <SheetDescription>
                  {selected.failedReason
                    ? 'The consumer recorded why this job failed before dead-lettering it.'
                    : 'Dead-lettered by the platform, so no reason was captured — see Workers logs around the time below.'}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-6">
                <div className="divide-border divide-y">
                  <Field label="Job ID">
                    <span className="font-mono">{selected.id}</span>
                  </Field>
                  <Field label="Origin queue">{selected.queue ? <span className="font-mono">{selected.queue}</span> : <span className="text-muted-foreground italic">unknown</span>}</Field>
                  <Field label="Attempts">{selected.attemptsMade}</Field>
                  <Field label="Failed at">{selected.timestamp ? new Date(selected.timestamp).toLocaleString() : '—'}</Field>
                </div>

                <Separator className="my-4" />

                <h3 className="mb-2 text-sm font-semibold">Failed reason</h3>
                {selected.failedReason ? (
                  <CodeBlock tone="danger">{selected.failedReason}</CodeBlock>
                ) : (
                  <p className="text-muted-foreground bg-muted/50 rounded-md border p-3 text-xs">
                    Not recorded. This job did not fail inside a <code className="font-mono">catch</code> block — it was a CPU timeout, an isolate crash, or a throw before the handler
                    started. Cloudflare dead-lettered the message verbatim, so only the payload survived.
                  </p>
                )}

                <Separator className="my-4" />

                <h3 className="mb-2 text-sm font-semibold">Payload</h3>
                <CodeBlock>{JSON.stringify(selected.data, null, 2)}</CodeBlock>

                <div className="mt-6 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={rowBusy || !dlq}
                    onClick={() => dlq && retryJob.mutate({ path: { queueName: dlq.name, jobId: selected.id } })}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    {retryJob.isPending ? 'Re-queuing...' : 'Re-queue'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={rowBusy || !dlq}
                    onClick={() => dlq && deleteJob.mutate({ path: { queueName: dlq.name, jobId: selected.id } })}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {deleteJob.isPending ? 'Discarding...' : 'Discard'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog === 'clean' ? 'Discard All Failed Jobs' : 'Retry All Failed Jobs'}</DialogTitle>
            <DialogDescription>
              {confirmDialog === 'clean'
                ? 'This permanently deletes every message currently in the dead letter queue. This cannot be undone.'
                : 'This re-sends every message in the dead letter queue to its original queue. Jobs may fail again and come straight back.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog === 'clean' ? 'destructive' : 'default'}
              disabled={busy || !dlq}
              onClick={() => {
                if (!confirmDialog || !dlq) return;
                if (confirmDialog === 'clean') {
                  cleanAll.mutate({ path: { queueName: dlq.name } });
                } else {
                  retryAll.mutate({ path: { queueName: dlq.name } });
                }
              }}
            >
              {busy ? 'Processing...' : confirmDialog === 'clean' ? 'Discard All' : 'Retry All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
