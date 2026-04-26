'use client';

import { useState } from 'react';
import { MoreVertical, LogOut, Eye } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckOutConfirmDialog } from '@/components/event/manage/attendees/check-out-confirm-dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AttendanceRecord } from '@/types/events';

const Th = ({ label }: { label: string }) => (
  <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{label}</div>
);

// ---------------------------------------------------------------------------
// Actions column component — mirrors organizers-columns.tsx ActionsColumn
// ---------------------------------------------------------------------------

interface ActionsColumnProps {
  record: AttendanceRecord;
  onCheckOut?: (studentId: string) => void;
  loadingStudentId: string | null;
}

function ActionsColumn({ record, onCheckOut, loadingStudentId }: ActionsColumnProps) {
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);

  const isCheckedOut = record.checkOutAt !== '-' && record.checkOutAt !== '';
  const isLoading = loadingStudentId === record.id;

  const handleConfirmCheckOut = () => {
    onCheckOut?.(record.id);
    setIsCheckOutDialogOpen(false);
  };

  return (
    <>
      <div className="text-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-muted size-8 md:size-9">
              <MoreVertical className="size-4 md:size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 shadow-lg md:w-52" align="end">
            <div className="flex flex-col gap-1">
              {!isCheckedOut ? (
                <Button
                  onClick={() => setIsCheckOutDialogOpen(true)}
                  disabled={isLoading}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-xs font-medium text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 md:gap-3 md:text-sm"
                  size="sm"
                >
                  <LogOut className="size-3 md:size-4" />
                  {isLoading ? 'Checking out…' : 'Check Out'}
                </Button>
              ) : (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  Already checked out
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CheckOutConfirmDialog
        open={isCheckOutDialogOpen}
        onOpenChange={setIsCheckOutDialogOpen}
        studentName={record.name}
        studentId={record.id}
        isLoading={isLoading}
        onConfirm={handleConfirmCheckOut}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Base columns (no Actions)
// ---------------------------------------------------------------------------

const baseColumns: ColumnDef<AttendanceRecord>[] = [
  {
    accessorKey: 'id',
    header: () => <Th label="Student ID" />,
    cell: ({ row }) => <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('id')}</div>
  },
  {
    accessorKey: 'name',
    header: () => <Th label="Name" />,
    cell: ({ row }) => <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('name')}</div>
  },
  {
    accessorKey: 'department',
    header: () => <Th label="Department" />,
    cell: ({ row }) => <div className="text-muted-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('department')}</div>
  },
  {
    accessorKey: 'program',
    header: () => <Th label="Program" />,
    cell: ({ row }) => <div className="text-muted-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('program')}</div>
  },
  {
    accessorKey: 'email',
    header: () => <Th label="UMindanao Email" />,
    cell: ({ row }) => <div className="text-muted-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('email')}</div>
  },
  {
    accessorKey: 'checkInAt',
    header: () => <Th label="Check in at" />,
    cell: ({ row }) => <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('checkInAt')}</div>
  },
  {
    accessorKey: 'checkInBy',
    header: () => <Th label="Check in by" />,
    cell: ({ row }) => <div className="text-muted-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('checkInBy')}</div>
  },
  {
    accessorKey: 'checkOutAt',
    header: () => <Th label="Check out at" />,
    cell: ({ row }) => <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('checkOutAt')}</div>
  },
  {
    accessorKey: 'checkOutBy',
    header: () => <Th label="Check out by" />,
    cell: ({ row }) => <div className="text-muted-foreground pl-3 text-xs font-medium md:text-sm">{row.getValue('checkOutBy')}</div>
  }
];

/**
 * Static columns for events that don't require check-out.
 * Exported for backward compatibility.
 */
export const columns: ColumnDef<AttendanceRecord>[] = baseColumns;

// ---------------------------------------------------------------------------
// Column factory — appends the Actions column when checkOutRequired is true
// ---------------------------------------------------------------------------

/**
 * Returns table columns, optionally with a MoreVertical Actions column
 * containing a "Check Out" menu item (only when checkOutRequired is true).
 *
 * The Actions column is driven by a table.meta object so the column
 * definition stays static and avoids re-renders on every keystroke.
 */
export function createColumns({
  checkOutRequired
}: {
  checkOutRequired: boolean;
}): ColumnDef<AttendanceRecord>[] {
  if (!checkOutRequired) {
    return baseColumns;
  }

  const actionsColumn: ColumnDef<AttendanceRecord> = {
    id: 'actions',
    header: () => <div className="text-foreground text-center text-xs font-medium md:text-sm">Actions</div>,
    cell: ({ row, table }) => {
      const record = row.original;
      const meta = table.options.meta as {
        onCheckOut?: (studentId: string) => void;
        loadingStudentId: string | null;
      };

      return (
        <ActionsColumn
          record={record}
          onCheckOut={meta?.onCheckOut}
          loadingStudentId={meta?.loadingStudentId ?? null}
        />
      );
    }
  };

  return [...baseColumns, actionsColumn];
}
