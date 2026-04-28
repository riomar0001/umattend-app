'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RefreshCw,
  Trash2,
  RotateCcw,
  Inbox,
  AlertTriangle,
  Clock,
  CheckCircle,
  CircleDashed,
  Timer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  getAdminQueuesOptions,
  getAdminQueuesByQueueNameFailedOptions,
  postAdminQueuesByQueueNameFailedByJobIdRetryMutation,
  deleteAdminQueuesByQueueNameFailedByJobIdMutation,
  postAdminQueuesByQueueNameFailedRetryAllMutation,
  deleteAdminQueuesByQueueNameFailedMutation,
} from '@/api/client/@tanstack/react-query.gen';
import { cn } from '@/lib/utils';

type QueueName = 'email-queue' | 'event-start-status-queue' | 'event-end-status-queue';

const QUEUE_LABELS: Record<QueueName, string> = {
  'email-queue': 'Email Queue',
  'event-start-status-queue': 'Event Start Status',
  'event-end-status-queue': 'Event End Status',
};

const QUEUE_ICONS: Record<QueueName, React.ElementType> = {
  'email-queue': Inbox,
  'event-start-status-queue': Timer,
  'event-end-status-queue': CheckCircle,
};

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
    refetchInterval: 10_000,
  });

  const failedQuery = useQuery({
    ...getAdminQueuesByQueueNameFailedOptions({
      path: { queueName: selectedQueue },
      query: { page: failedPageState, limit: 10 },
    }),
    refetchInterval: 10_000,
  });

  const retryJob = useMutation({
    ...postAdminQueuesByQueueNameFailedByJobIdRetryMutation(),
    onSuccess: () => {
      toast.success('Job retried');
      invalidateQueueQueries();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to retry job'),
  });

  const deleteJob = useMutation({
    ...deleteAdminQueuesByQueueNameFailedByJobIdMutation(),
    onSuccess: () => {
      toast.success('Job removed');
      invalidateQueueQueries();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to remove job'),
  });

  const retryAll = useMutation({
    ...postAdminQueuesByQueueNameFailedRetryAllMutation(),
    onSuccess: (data: any) => {
      toast.success(`${data?.data?.retried ?? 0} jobs retried`);
      setConfirmDialog(null);
      invalidateQueueQueries();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to retry jobs'),
  });

  const cleanAll = useMutation({
    ...deleteAdminQueuesByQueueNameFailedMutation(),
    onSuccess: (data: any) => {
      toast.success(`${data?.data?.removed ?? 0} jobs cleaned`);
      setConfirmDialog(null);
      invalidateQueueQueries();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to clean jobs'),
  });

  function invalidateQueueQueries() {
    queryClient.invalidateQueries({ queryKey: getAdminQueuesOptions({}).queryKey });
    queryClient.invalidateQueries({
      queryKey: getAdminQueuesByQueueNameFailedOptions({
        path: { queueName: selectedQueue },
      }).queryKey,
    });
  }

  const queues = (queuesQuery.data?.data as any[]) ?? [];
  const failedJobs = (failedQuery.data?.data?.data as any[]) ?? [];
  const pagination = (failedQuery.data?.data?.pagination as any) ?? {
    page: 1,
    total: 0,
    totalPages: 1,
  };
  const failedCurPage = pagination.page || 1;
  const failedTotal = pagination.total || 0;
  const failedCurPages = pagination.totalPages || 1;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dead Letter Queue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitor and manage failed background jobs across all queues.
        </p>
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
              <p className="text-muted-foreground">Failed to load queues</p>
              <Button
                className="ml-4"
                variant="outline"
                size="sm"
                onClick={() => queuesQuery.refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          queues.map((q: any) => {
            const name = q.name as QueueName;
            const Icon = QUEUE_ICONS[name] || CircleDashed;
            const counts = q.counts || {};
            const hasFailed = (counts.failed || 0) > 0;
            return (
              <Card
                key={name}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  selectedQueue === name && 'border-primary ring-1 ring-primary'
                )}
                onClick={() => {
                  setSelectedQueue(name);
                  setFailedPageState(1);
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {QUEUE_LABELS[name] || name}
                  </CardTitle>
                  <Icon className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <CircleDashed className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground">Waiting:</span>
                      <span className="font-medium">{counts.waiting ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Timer className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground">Delayed:</span>
                      <span className="font-medium">{counts.delayed ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground">Active:</span>
                      <span className="font-medium">{counts.active ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground">Done:</span>
                      <span className="font-medium">{counts.completed ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle
                        className={cn(
                          'h-3 w-3',
                          hasFailed ? 'text-red-500' : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(hasFailed ? 'text-red-500' : 'text-muted-foreground')}
                      >
                        Failed:
                      </span>
                      <span className={cn('font-medium', hasFailed && 'text-red-500')}>
                        {counts.failed ?? 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Failed Jobs Section */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Failed Jobs</h2>
          <p className="text-muted-foreground text-sm">
            {QUEUE_LABELS[selectedQueue] || selectedQueue}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={retryAll.isPending || failedTotal === 0}
            onClick={() =>
              setConfirmDialog({ type: 'retry-all', queue: selectedQueue })
            }
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Retry All
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={cleanAll.isPending || failedTotal === 0}
            onClick={() =>
              setConfirmDialog({ type: 'clean', queue: selectedQueue })
            }
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Clean All
          </Button>
        </div>
      </div>

      {failedQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : failedQuery.isError ? (
        <div className="text-muted-foreground py-12 text-center">
          <p className="font-medium">Failed to load jobs</p>
          <Button
            className="mt-2"
            variant="outline"
            size="sm"
            onClick={() => failedQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : failedJobs.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border py-12 text-center">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
          <p className="font-medium">No failed jobs</p>
          <p className="text-sm">The queue is healthy.</p>
        </div>
      ) : (
        <>
          <div className="border-border rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Failed Reason</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="hidden lg:table-cell">Finished</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedJobs.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell
                      className="font-mono text-xs max-w-[120px] truncate"
                      title={job.id}
                    >
                      {job.id}
                    </TableCell>
                    <TableCell className="text-sm">{job.name || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[280px] truncate">
                      <span
                        className="text-xs text-red-600 dark:text-red-400"
                        title={job.failedReason}
                      >
                        {job.failedReason || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {job.attemptsMade}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {job.finishedOn
                        ? new Date(job.finishedOn).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Retry"
                          disabled={retryJob.isPending}
                          onClick={() =>
                            retryJob.mutate({
                              path: { queueName: selectedQueue, jobId: job.id },
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
                              path: { queueName: selectedQueue, jobId: job.id },
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {failedCurPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {Math.min((failedCurPage - 1) * 10 + 1, failedTotal)}–
                {Math.min(failedCurPage * 10, failedTotal)} of {failedTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={failedCurPage <= 1}
                  onClick={() => setFailedPageState((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {failedCurPage} / {failedCurPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={failedCurPage >= failedCurPages}
                  onClick={() => setFailedPageState((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'clean'
                ? 'Clean All Failed Jobs'
                : 'Retry All Failed Jobs'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'clean'
                ? `This will permanently remove all failed jobs from ${QUEUE_LABELS[confirmDialog?.queue ?? 'email-queue'] ?? confirmDialog?.queue}. This action cannot be undone.`
                : `This will retry all failed jobs in ${QUEUE_LABELS[confirmDialog?.queue ?? 'email-queue'] ?? confirmDialog?.queue}. Jobs may fail again.`}
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
              {retryAll.isPending || cleanAll.isPending
                ? 'Processing...'
                : confirmDialog?.type === 'clean'
                  ? 'Clean All'
                  : 'Retry All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
