'use client';

import { useState } from 'react';
import { RefreshCw, Trash2, RotateCcw, AlertTriangle, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
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
   * Always null. A dead-lettered message carries the original body verbatim and
   * nothing about why it failed — the error only exists in Workers logs.
   */
  failedReason: string | null;
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

const Th = ({ label }: { label: string }) => <div className="text-foreground text-xs font-medium md:text-sm">{label}</div>;

export default function AdminQueuesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<'clean' | 'retry-all' | null>(null);

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
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to retry job'))
  });

  const deleteJob = useMutation({
    ...deleteAdminQueuesByQueueNameFailedByJobIdMutation(),
    onSuccess: () => {
      toast.success('Job discarded');
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

  // ------------------------------------------------------------------
  // Columns
  // ------------------------------------------------------------------
  const columns: ColumnDef<FailedJob>[] = [
    {
      accessorKey: 'name',
      header: () => <Th label="Type" />,
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {row.original.name}
        </Badge>
      )
    },
    {
      accessorKey: 'data',
      header: () => <Th label="Payload" />,
      cell: ({ row }) => {
        const json = JSON.stringify(row.original.data);
        return (
          <div className="bg-secondary/30 max-w-[360px] truncate rounded-sm border p-1 font-mono text-[10px] hover:text-wrap md:text-xs" title={json}>
            {json}
          </div>
        );
      }
    },
    {
      accessorKey: 'attemptsMade',
      header: () => <Th label="Deliveries" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs" title="Includes deliveries caused by viewing this page">
          {row.original.attemptsMade}
        </Badge>
      )
    },
    {
      accessorKey: 'timestamp',
      header: () => <Th label="Queued" />,
      cell: ({ row }) => {
        const ts = row.original.timestamp;
        return <div className="text-muted-foreground text-xs">{ts ? new Date(ts).toLocaleString() : '—'}</div>;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right text-xs font-medium md:text-sm">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Re-queue this job"
            disabled={retryJob.isPending || !dlq}
            onClick={() => retryJob.mutate({ path: { queueName: dlq!.name, jobId: row.original.id } })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            title="Discard permanently"
            disabled={deleteJob.isPending || !dlq}
            onClick={() => deleteJob.mutate({ path: { queueName: dlq!.name, jobId: row.original.id } })}
          >
            <Trash2 className="h-4 w-4" />
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
            <p className="text-muted-foreground mt-2 text-xs">
              Queues with a Worker consumer cannot be read — depth and contents are unavailable from the API.
            </p>
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
