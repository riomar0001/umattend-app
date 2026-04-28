'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Trash2, Shield } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  getAdminUsersOptions,
  patchAdminUsersByUserIdRoleMutation,
  deleteAdminUsersByUserIdMutation,
} from '@/api/client/@tanstack/react-query.gen';

type UserRole = 'student' | 'admin' | 'csg' | 'instructor' | 'organizer';

const VALID_ROLES: UserRole[] = ['student', 'admin', 'csg', 'instructor', 'organizer'];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  csg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  instructor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  organizer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  student: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; email: string } | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    ...getAdminUsersOptions({
      query: { page, limit: 20, search: debouncedSearch || undefined },
    }),
  });

  const roleMutation = useMutation({
    ...patchAdminUsersByUserIdRoleMutation(),
    onSuccess: () => {
      toast.success('Role updated');
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: getAdminUsersOptions({}).queryKey });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update role');
    },
  });

  const deleteMutation = useMutation({
    ...deleteAdminUsersByUserIdMutation(),
    onSuccess: () => {
      toast.success('User deleted');
      setDeleteDialog(null);
      queryClient.invalidateQueries({ queryKey: getAdminUsersOptions({}).queryKey });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete user');
    },
  });

  const users = (data?.data as any)?.data ?? [];
  const pagination = (data?.data as any)?.pagination ?? { page: 1, total: 0, totalPages: 1 };
  const currentPage = pagination.page || 1;
  const pageTotal = pagination.total || 0;
  const pagePages = pagination.totalPages || 1;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage all registered users. Update roles or soft-delete accounts.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, email, or ID..."
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
          <p className="text-lg font-medium">Failed to load users</p>
          <p className="mt-1 text-sm">{(error as any)?.message || 'An error occurred'}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: getAdminUsersOptions({}).queryKey })
            }
          >
            Retry
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="text-lg font-medium">No users found</p>
          <p className="mt-1 text-sm">
            {debouncedSearch ? 'Try a different search term.' : 'No users registered yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="border-border rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Student ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.student?.name || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[180px] truncate">
                      {user.umindanao_email}
                    </TableCell>
                    <TableCell>
                      {editingRole === user.id ? (
                        <Select
                          defaultValue={user.role}
                          onValueChange={(role: UserRole) => {
                            roleMutation.mutate({
                              path: { userId: user.id },
                              body: { role },
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
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
                      ) : (
                        <Badge variant="secondary" className={ROLE_COLORS[user.role] || ''}>
                          {user.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.student?.student_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                      {user.student?.department || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Change role"
                          onClick={() =>
                            setEditingRole(editingRole === user.id ? null : user.id)
                          }
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title="Delete user"
                          onClick={() =>
                            setDeleteDialog({ id: user.id, email: user.umindanao_email })
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

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This will soft-delete <strong>{deleteDialog?.email}</strong>. The user record
              will be preserved but hidden from listings.
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
