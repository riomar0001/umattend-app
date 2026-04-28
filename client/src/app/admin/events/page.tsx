'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Globe,
} from 'lucide-react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAdminEventsOptions,
  patchEventByEventIdPostMutation,
  patchEventByEventIdDraftMutation,
} from '@/api/client/@tanstack/react-query.gen';

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ongoing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  done: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function getStatus(event: any) {
  if (event.is_draft) return 'draft' as const;
  if (event.is_done) return 'done' as const;
  if (event.is_started && !event.is_done) return 'ongoing' as const;
  return 'upcoming' as const;
}

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  };

  const { data, isLoading, isError, error } = useQuery({
    ...getAdminEventsOptions({
      query: { page, limit: 20, search: debouncedSearch || undefined },
    }),
  });

  const postMutation = useMutation({
    ...patchEventByEventIdPostMutation(),
    onSuccess: () => {
      toast.success('Event published');
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: getAdminEventsOptions({}).queryKey });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to publish event');
      setTogglingId(null);
    },
  });

  const draftMutation = useMutation({
    ...patchEventByEventIdDraftMutation(),
    onSuccess: () => {
      toast.success('Event saved as draft');
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: getAdminEventsOptions({}).queryKey });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to draft event');
      setTogglingId(null);
    },
  });

  const handleToggle = (event: any) => {
    setTogglingId(event.id);
    if (event.is_draft) {
      postMutation.mutate({ path: { event_id: event.id } } as any);
    } else {
      draftMutation.mutate({ path: { event_id: event.id } } as any);
    }
  };

  const events = (data?.data as any)?.data ?? [];
  const pagination = (data?.data as any)?.pagination ?? { page: 1, total: 0, totalPages: 1 };
  const currentPage = pagination.page || 1;
  const pageTotal = pagination.total || 0;
  const pagePages = pagination.totalPages || 1;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View and manage all events. Includes drafts not visible to regular users.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by title or description..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : isError ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="text-lg font-medium">Failed to load events</p>
          <p className="mt-1 text-sm">{(error as any)?.message || 'An error occurred'}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: getAdminEventsOptions({}).queryKey })
            }
          >
            Retry
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="text-lg font-medium">No events found</p>
          <p className="mt-1 text-sm">
            {debouncedSearch ? 'Try a different search term.' : 'No events registered yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="border-border rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Created By</TableHead>
                  <TableHead className="hidden sm:table-cell">Start</TableHead>
                  <TableHead className="hidden sm:table-cell">End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Attendance</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event: any) => {
                  const status = getStatus(event);
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {event.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                        {event.department || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {event.created_by_name || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {formatDate(event.start_time)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {formatDate(event.end_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_STYLES[status]}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{event.checkin_count ?? 0}</span>
                        {event.check_out_required && (
                          <span className="text-muted-foreground text-xs">
                            {' '}| {event.checkout_count ?? 0} out
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={event.is_draft ? 'Publish event' : 'Move to drafts'}
                            disabled={togglingId === event.id}
                            onClick={() => handleToggle(event)}
                          >
                            {event.is_draft ? (
                              <Globe className="h-4 w-4 text-green-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-amber-500" />
                            )}
                          </Button>
                          <Link href={`/events/${event.id}/manage`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View event">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pagePages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {Math.min((currentPage - 1) * 20 + 1, pageTotal)}–
                {Math.min(currentPage * 20, pageTotal)} of {pageTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <span className="text-sm font-medium">
                  {currentPage} / {pagePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pagePages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
