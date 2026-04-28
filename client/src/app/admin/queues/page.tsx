'use client';

import { useState } from 'react';
import { RefreshCw, Trash2, RotateCcw, Inbox, AlertTriangle, Clock, CheckCircle, CircleDashed, Timer } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type QueueName = 'email-queue' | 'event-start-status-queue' | 'event-end-status-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

interface QueueInfo {
  name: QueueName;
  counts: QueueCounts;
}

interface FailedJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: number | null;
  finishedOn: number | null;
  processedOn: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const QUEUE_LABELS: Record<QueueName, string> = {
  'email-queue': 'Email Queue',
  'event-start-status-queue': 'Event Start Status',
  'event-end-status-queue': 'Event End Status'
};

const QUEUE_ICONS: Record<QueueName, React.ElementType> = {
  'email-queue': Inbox,
  'event-start-status-queue': Timer,
  'event-end-status-queue': CheckCircle
};

const Th = ({ label }: { label: string }) => <div className="text-foreground text-xs font-medium md:text-sm">{label}</div>;

export default function AdminQueuesPage() {
  const queryClient = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState<QueueName>('email-queue');
  const [failedPageState, setFailedPageState] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'clean' | 'retry-all';
    queue: QueueName;
  } | null>(null);

  const queuesQuery = useQuery({
    ...getAdminQueuesOptions(),
    refetchInterval: 10_000
  });

  const failedQuery = useQuery({
    ...getAdminQueuesByQueueNameFailedOptions({
      path: { queueName: selectedQueue },
      query: { page: failedPageState, limit: 10 }
    }),
    refetchInterval: 10_000
  });

  const retryJob = useMutation({
    ...postAdminQueuesByQueueNameFailedByJobIdRetryMutation(),
    onSuccess: () => {
      toast.success('Job retried');
      invalidateAll();
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to retry job')
  });

  const deleteJob = useMutation({
    ...deleteAdminQueuesByQueueNameFailedByJobIdMutation(),
    onSuccess: () => {
      toast.success('Job removed');
      invalidateAll();
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to remove job')
  });

  const retryAll = useMutation({
    ...postAdminQueuesByQueueNameFailedRetryAllMutation(),
    onSuccess: (data) => {
      const retried = (data?.data as { retried?: number } | undefined)?.retried ?? 0;
      toast.success(`${retried} jobs retried`);
      setConfirmDialog(null);
      invalidateAll();
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to retry jobs')
  });

  const cleanAll = useMutation({
    ...deleteAdminQueuesByQueueNameFailedMutation(),
    onSuccess: (data) => {
      const removed = (data?.data as { removed?: number } | undefined)?.removed ?? 0;
      toast.success(`${removed} jobs cleaned`);
      setConfirmDialog(null);
      invalidateAll();
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to clean jobs')
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getAdminQueuesOptions({}).queryKey });
    queryClient.invalidateQueries({
      queryKey: getAdminQueuesByQueueNameFailedOptions({ path: { queueName: selectedQueue } }).queryKey
    });
  }

  const queues = (queuesQuery.data?.data as QueueInfo[] | undefined) ?? [];
  const failedData = failedQuery.data?.data as { data: FailedJob[]; pagination: Pagination } | undefined;
  const failedJobs = failedData?.data ?? [];
  const pagination = failedData?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 1 };

  // ------------------------------------------------------------------
  // Failed jobs columns
  // ------------------------------------------------------------------
  const failedColumns: ColumnDef<FailedJob>[] = [
    {
      accessorKey: 'id',
      header: () => <Th label="Job ID" />,
      cell: ({ row }) => (
        <div className="max-w-[100px] truncate font-mono text-[10px] md:text-xs" title={row.original.id}>
          {row.original.id}
        </div>
      )
    },
    {
      accessorKey: 'name',
      header: () => <Th label="Name" />,
      cell: ({ row }) => <div className="text-xs md:text-sm">{row.original.name || '—'}</div>
    },
    {
      accessorKey: 'failedReason',
      header: () => <Th label="Failed Reason" />,
      cell: ({ row }) => {
        const reason = row.original.failedReason;
        return (
          <div className="max-w-[260px] truncate text-xs text-red-600 dark:text-red-400" title={reason ?? ''}>
            {reason || 'Unknown'}
          </div>
        );
      }
    },
    {
      accessorKey: 'attemptsMade',
      header: () => <Th label="Attempts" />,
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {row.original.attemptsMade}
        </Badge>
      )
    },
    {
      accessorKey: 'finishedOn',
      header: () => <Th label="Finished" />,
      cell: ({ row }) => {
        const ts = row.original.finishedOn;
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
            title="Retry"
            disabled={retryJob.isPending}
            onClick={() =>
              retryJob.mutate({
                path: { queueName: selectedQueue, jobId: row.original.id }
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            title="Delete"
            disabled={deleteJob.isPending}
            onClick={() =>
              deleteJob.mutate({
                path: { queueName: selectedQueue, jobId: row.original.id }
              })
            }
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
        <p className="text-muted-foreground mt-1 text-sm">Monitor and manage failed background jobs across all queues.</p>
      </div>

      {/* Queue Overview Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {queuesQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="bg-muted h-4 w-24 rounded" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="bg-muted h-8 w-12 rounded" />
                  <div className="bg-muted h-8 w-12 rounded" />
                  <div className="bg-muted h-8 w-12 rounded" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : queuesQuery.isError ? (
          <Card className="sm:col-span-3">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Failed to load queues</p>
              <Button className="ml-4" variant="outline" size="sm" onClick={() => queuesQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          queues.map((q) => {
            const name = q.name;
            const Icon = QUEUE_ICONS[name] || CircleDashed;
            const counts = q.counts || {};
            const hasFailed = (counts.failed || 0) > 0;
            return (
              <Card
                key={name}
                className={cn('hover:border-primary/50 cursor-pointer transition-colors', selectedQueue === name && 'border-primary ring-primary ring-1')}
                onClick={() => {
                  setSelectedQueue(name);
                  setFailedPageState(1);
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{QUEUE_LABELS[name]}</CardTitle>
                  <Icon className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <Stat icon={CircleDashed} label="Waiting" value={counts.waiting} />
                    <Stat icon={Timer} label="Delayed" value={counts.delayed} />
                    <Stat icon={Clock} label="Active" value={counts.active} />
                    <Stat icon={CheckCircle} label="Done" value={counts.completed} />
                    <Stat icon={AlertTriangle} label="Failed" value={counts.failed} highlight={hasFailed} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Failed Jobs Section */}
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Failed Jobs</h2>
          <p className="text-muted-foreground text-sm">{QUEUE_LABELS[selectedQueue]}</p>
        </div>
      </div>

      <DataTable
        columns={failedColumns}
        data={failedJobs}
        searchPlaceholder="Search jobs..."
        searchValue=""
        onSearchChange={() => {}}
        page={pagination.page}
        onPageChange={setFailedPageState}
        pageSize={10}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        isLoading={failedQuery.isLoading}
        error={failedQuery.isError ? failedQuery.error : undefined}
        emptyMessage="No failed jobs — the queue is healthy."
        toolbar={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={retryAll.isPending || pagination.total === 0}
              onClick={() => setConfirmDialog({ type: 'retry-all', queue: selectedQueue })}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Retry All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={cleanAll.isPending || pagination.total === 0}
              onClick={() => setConfirmDialog({ type: 'clean', queue: selectedQueue })}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clean All
            </Button>
          </div>
        }
      />

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.type === 'clean' ? 'Clean All Failed Jobs' : 'Retry All Failed Jobs'}</DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'clean'
                ? `This will permanently remove all failed jobs from ${QUEUE_LABELS[confirmDialog?.queue ?? 'email-queue']}. This action cannot be undone.`
                : `This will retry all failed jobs in ${QUEUE_LABELS[confirmDialog?.queue ?? 'email-queue']}. Jobs may fail again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog?.type === 'clean' ? 'destructive' : 'default'}
              disabled={retryAll.isPending || cleanAll.isPending}
              onClick={() => {
                if (!confirmDialog) return;
                if (confirmDialog.type === 'clean') {
                  cleanAll.mutate({ path: { queueName: confirmDialog.queue } });
                } else {
                  retryAll.mutate({ path: { queueName: confirmDialog.queue } });
                }
              }}
            >
              {retryAll.isPending || cleanAll.isPending ? 'Processing...' : confirmDialog?.type === 'clean' ? 'Clean All' : 'Retry All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value = 0, highlight }: { icon: React.ElementType; label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={cn('h-3 w-3', highlight ? 'text-red-500' : 'text-muted-foreground')} />
      <span className={cn('text-muted-foreground', highlight && 'text-red-500')}>{label}:</span>
      <span className={cn('font-medium', highlight && 'text-red-500')}>{value ?? 0}</span>
    </div>
  );
}
