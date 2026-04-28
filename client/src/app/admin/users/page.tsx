'use client';

import { useState } from 'react';
import { Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAdminUsersOptions, patchAdminUsersByUserIdRoleMutation, deleteAdminUsersByUserIdMutation } from '@/api/client/@tanstack/react-query.gen';

type UserRole = 'student' | 'admin' | 'csg' | 'instructor' | 'organizer';
const VALID_ROLES: UserRole[] = ['student', 'admin', 'csg', 'instructor', 'organizer'];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  csg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  instructor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  organizer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  student: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUserStudent {
  student_id: number;
  name: string;
  department: string | null;
  program: string | null;
}

interface AdminUser {
  id: string;
  umindanao_email: string;
  role: string;
  done_onboarding: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  student: AdminUserStudent | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminUsersResponse {
  data: AdminUser[];
  pagination: Pagination;
}

const Th = ({ label }: { label: string }) => <div className="text-foreground text-xs font-medium md:text-sm">{label}</div>;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; email: string } | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    ...getAdminUsersOptions({
      query: { page, limit: 20, search: search || undefined }
    })
  });
  

  const roleMutation = useMutation({
    ...patchAdminUsersByUserIdRoleMutation(),
    onSuccess: () => {
      toast.success('Role updated');
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: getAdminUsersOptions({}).queryKey });
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to update role')
  });

  const deleteMutation = useMutation({
    ...deleteAdminUsersByUserIdMutation(),
    onSuccess: () => {
      toast.success('User deleted');
      setDeleteDialog(null);
      queryClient.invalidateQueries({ queryKey: getAdminUsersOptions({}).queryKey });
    },
    onError: (err) => toast.error((err as Error)?.message || 'Failed to delete user')
  });

  const responseData = data?.data as AdminUsersResponse | undefined;
  const users = responseData?.data ?? [];
  const pagination = responseData?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'name',
      header: () => <Th label="Name" />,
      accessorFn: (row) => row.student?.name ?? '',
      cell: ({ row }) => <div className="text-xs font-medium md:text-sm">{row.original.student?.name || '—'}</div>
    },
    {
      accessorKey: 'student_id',
      header: () => <Th label="Student ID" />,
      accessorFn: (row) => row.student?.student_id,
      cell: ({ row }) => <div className="text-xs md:text-sm">{row.original.student?.student_id ?? '—'}</div>
    },
    {
      accessorKey: 'umindanao_email',
      header: () => <Th label="Email" />,
      cell: ({ row }) => <div className="text-muted-foreground max-w-[200px] text-xs md:text-sm">{row.getValue('umindanao_email')}</div>
    },
    {
      accessorKey: 'department',
      header: () => <Th label="Department" />,
      accessorFn: (row) => row.student?.department,
      cell: ({ row }) => <div className="text-muted-foreground max-w-[180px] text-xs md:text-sm">{row.original.student?.department || '—'}</div>
    },
    {
      accessorKey: 'role',
      header: () => <Th label="Role" />,
      cell: ({ row }) => {
        const role = row.original.role;
        if (editingRole === row.original.id) {
          return (
            <Select
              defaultValue={role}
              onValueChange={(r: UserRole) => {
                roleMutation.mutate({
                  path: { userId: row.original.id },
                  body: { role: r }
                });
              }}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Badge variant="secondary" className={ROLE_COLORS[role] || ''}>
            {role}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: () => <Th label="Joined" />,
      cell: ({ row }) => {
        const d = row.original.created_at;
        return <div className="text-muted-foreground text-xs md:text-sm">{d ? new Date(d).toLocaleDateString('en-PH') : '—'}</div>;
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
            title="Change role"
            onClick={() => setEditingRole(editingRole === row.original.id ? null : row.original.id)}
          >
            <Shield className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            title="Delete user"
            onClick={() =>
              setDeleteDialog({
                id: row.original.id,
                email: row.original.umindanao_email
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
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage all registered users. Update roles or soft-delete accounts.</p>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Search by name, email, or ID..."
        searchValue={search}
        onSearchChange={setSearch}
        page={pagination.page}
        onPageChange={setPage}
        pageSize={20}
        totalPages={pagination.totalPages}
        totalRecords={pagination.total}
        isLoading={isLoading}
        error={isError ? error : undefined}
        emptyMessage={search ? 'No users match your search.' : 'No users registered yet.'}
      />

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This will soft-delete <strong>{deleteDialog?.email}</strong>. The user record will be preserved but hidden from listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteDialog) {
                  deleteMutation.mutate({ path: { userId: deleteDialog.id } });
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
