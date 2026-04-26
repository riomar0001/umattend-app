'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AttendanceRecord } from '@/types/events';

const Th = ({ label }: { label: string }) => (
  <div className="text-foreground pl-3 text-xs font-medium md:text-sm">{label}</div>
);

export const columns: ColumnDef<AttendanceRecord>[] = [
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
