'use client';

import { useState } from 'react';
import { Eye, Globe, FileText } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getAdminEventsOptions, patchEventByEventIdPostMutation, patchEventByEventIdDraftMutation } from '@/api/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  capacity: number | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  check_out_required: boolean;
  is_started: boolean;
  is_done: boolean;
  is_draft: boolean;
  created_by: string;
  created_by_name: string;
  checkin_count: number;
  checkout_count: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminEventsResponse {
  data: AdminEvent[];
  pagination: Pagination;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ongoing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  done: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
};

function getStatus(event: AdminEvent) {
  if (event.is_draft) return 'draft';
  if (event.is_done) return 'done';
  if (event.is_started && !event.is_done) return 'ongoing';
  return 'upcoming';
}

const Th = ({ label }: { label: string }) => <div className="text-foreground text-xs font-medium md:text-sm">{label}</div>;

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    ...getAdminEventsOptions({
      query: { page, limit: 20, search: search || undefined }
    })
  });

  const postMutation = useMutation({
    ...patchEventByEventIdPostMutation(),
    onSuccess: () => {
      toast.success('Event published');
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: getAdminEventsOptions({}).queryKey });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to publish'));
      setTogglingId(null);
    }
  });

  const draftMutation = useMutation({
    ...patchEventByEventIdDraftMutation(),
    onSuccess: () => {
      toast.success('Event saved as draft');
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: getAdminEventsOptions({}).queryKey });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to save as draft'));
      setTogglingId(null);
    }
  });

  const handleToggle = (event: AdminEvent) => {
    setTogglingId(event.id);
    if (event.is_draft) {
      postMutation.mutate({ path: { event_id: event.id } });
    } else {
      draftMutation.mutate({ path: { event_id: event.id } });
    }
  };

  const responseData = data?.data as AdminEventsResponse | undefined;
  const events = responseData?.data ?? [];
  const pagination = responseData?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };

  const columns: ColumnDef<AdminEvent>[] = [
    {
      accessorKey: 'title',
      header: () => <Th label="Title" />,
      cell: ({ row }) => <div className="max-w-[220px] truncate text-xs font-medium md:text-sm">{row.getValue('title')}</div>
    },
    {
      accessorKey: 'department',
      header: () => <Th label="Department" />,
      cell: ({ row }) => <div className="text-muted-foreground max-w-[160px] text-xs md:text-sm">{row.getValue('department') || '—'}</div>
    },
    {
      accessorKey: 'created_by_name',
      header: () => <Th label="Created By" />,
      cell: ({ row }) => <div className="text-xs md:text-sm">{row.getValue('created_by_name') || '—'}</div>
    },
    {
      accessorKey: 'start_time',
      header: () => <Th label="Start" />,
      cell: ({ row }) => {
        const d = row.original.start_time;
        return <div className="text-xs md:text-sm">{d ? new Date(d).toLocaleDateString('en-PH') : '—'}</div>;
      }
    },
    {
      accessorKey: 'end_time',
      header: () => <Th label="End" />,
      cell: ({ row }) => {
        const d = row.original.end_time;
        return <div className="text-xs md:text-sm">{d ? new Date(d).toLocaleDateString('en-PH') : '—'}</div>;
      }
    },
    {
      accessorKey: 'status',
      header: () => <Th label="Status" />,
      cell: ({ row }) => {
        const status = getStatus(row.original);
        return (
          <Badge variant="secondary" className={STATUS_STYLES[status]}>
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'checkin_count',
      header: () => <Th label="Attendance" />,
      cell: ({ row }) => (
        <div className="text-xs">
          <span>{row.original.checkin_count ?? 0}</span>
          {row.original.check_out_required && <span className="text-muted-foreground"> | {row.original.checkout_count ?? 0} out</span>}
        </div>
      )
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
            title={row.original.is_draft ? 'Publish event' : 'Move to drafts'}
            disabled={togglingId === row.original.id}
            onClick={() => handleToggle(row.original)}
          >
            {row.original.is_draft ? <Globe className="h-4 w-4 text-green-500" /> : <FileText className="h-4 w-4 text-amber-500" />}
          </Button>
          <Link href={`/events/${row.original.id}/manage`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="View event">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )
    }
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground mt-1 text-sm">View and manage all events. Includes drafts not visible to regular users.</p>
      </div>

      <DataTable
        columns={columns}
        data={events}
        searchPlaceholder="Search by title or description..."
        searchValue={search}
        onSearchChange={setSearch}
        page={pagination.page}
        onPageChange={setPage}
        pageSize={20}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        isLoading={isLoading}
        error={isError ? error : undefined}
        emptyMessage={search ? 'No events match your search.' : 'No events registered yet.'}
      />
    </div>
  );
}
