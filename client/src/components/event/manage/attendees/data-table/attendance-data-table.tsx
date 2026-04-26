'use client';

import * as React from 'react';
import { Search, Settings2, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  totalRecords: number;
  isLoading: boolean;
  error?: unknown;
  /** Called with the student ID string when the per-row Check Out button is clicked */
  onCheckOut?: (studentId: string) => void;
  /** Whether the event requires check-out (controls Actions column visibility) */
  checkOutRequired?: boolean;
  /** Student ID currently being checked out (used to show loading state on the button) */
  loadingStudentId?: string | null;
}

type PageItem = number | 'prev-ellipsis' | 'next-ellipsis';

function getPageNumbers(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: PageItem[] = [1];
  const left = current - 2;
  const right = current + 2;

  if (left > 2) pages.push('prev-ellipsis');
  for (let i = Math.max(2, left); i <= Math.min(total - 1, right); i++) pages.push(i);
  if (right < total - 1) pages.push('next-ellipsis');
  if (total > 1) pages.push(total);

  return pages;
}

export function AttendanceDataTable<TData, TValue>({
  columns,
  data,
  onSearchChange,
  page,
  onPageChange,
  totalPages,
  totalRecords,
  isLoading,
  error,
  onCheckOut,
  loadingStudentId
}: DataTableProps<TData, TValue>) {
  // onCheckOut / checkOutRequired / loadingStudentId are consumed by the
  // column factory in the parent (event-attendees.tsx) and the composed
  // columns are passed in directly, so no extra wiring is needed here.
  const [inputValue, setInputValue] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
      onPageChange(1);
    }, 400);
  };

  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { columnFilters, columnVisibility },
    manualPagination: true,
    pageCount: totalPages,
    meta: {
      onCheckOut,
      loadingStudentId
    }
  });

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by Student ID, Name, or Email..."
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto bg-transparent">
              <Settings2 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => {
                const label = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id.charAt(0).toUpperCase() + col.id.slice(1);
                return (
                  <DropdownMenuCheckboxItem key={col.id} className="capitalize" checked={col.getIsVisible()} onCheckedChange={(v) => col.toggleVisibility(!!v)}>
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24">
                  <div className="grid grid-cols-10 gap-4 px-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : error || !table.getRowModel().rows?.length ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-5 flex flex-col items-start justify-between gap-4 text-xs sm:flex-row sm:items-center md:text-sm">
        <p className="text-muted-foreground font-medium">
          {totalRecords === 0 ? 'No records' : `Showing ${(page - 1) * 10 + 1}–${Math.min(page * 10, totalRecords)} of ${totalRecords}`}
        </p>

        <div className="flex items-center gap-1">
          {/* Prev */}
          <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="h-8 w-8 p-0">
            <ChevronLeft className="size-4" />
          </Button>

          {/* Page numbers */}
          {pageNumbers.map((p, i) =>
            p === 'prev-ellipsis' || p === 'next-ellipsis' ? (
              <Button
                key={`ellipsis-${i}`}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(p === 'prev-ellipsis' ? Math.max(1, page - 5) : Math.min(totalPages, page + 5))}
                className="text-muted-foreground hover:bg-muted h-8 w-8 p-0 text-sm"
              >
                …
              </Button>
            ) : (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(p)}
                className={`h-8 w-8 p-0 text-xs font-medium ${
                  page === p ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold' : 'hover:bg-muted'
                }`}
              >
                {p}
              </Button>
            )
          )}

          {/* Next */}
          <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="h-8 w-8 p-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
