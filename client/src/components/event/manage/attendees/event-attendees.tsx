import { useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { AttendanceRecord } from '@/types/events';
import { createColumns } from './data-table/attendance-columns';
import { AttendanceDataTable } from './data-table/attendance-data-table';
import { CheckInStudentDialog } from './check-in-student-dialog';
import EvenAttendeesSkeleton from './event-attendees-skeleton';
import EventAttendeesStats from './event-attendees-stats';
import EventAttendeesStatsSkeleton from './event-attendees-stats-skeleton';
import EventDataTableSkeleton from './event-data-table-skeleton';
import { getEventAttendanceCountOptions, getEventByEventIdAttendeesOptions } from '@/api/client/@tanstack/react-query.gen';
import { Event } from '@/api/client/sdk.gen';
import { formatDateTime } from '@/lib/utils';

interface EventAttendeesProps {
  eventId: string;
  checkOutRequired: boolean;
}

export default function EventAttendees({ eventId, checkOutRequired }: EventAttendeesProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const limit = 10;

  const {
    data: attendeesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    ...getEventByEventIdAttendeesOptions({
      path: {
        event_id: eventId
      },
      query: {
        page,
        limit,
        search: search || undefined
      }
    }),
    enabled: !!eventId,
    retry: false
  });

  const {
    data: attendeesStatsData,
    isLoading: attendeesStatsIsLoading,
    refetch: refetchAttendeesStats
  } = useQuery({
    ...getEventAttendanceCountOptions({
      path: {
        event_id: eventId
      }
    }),
    enabled: !!eventId
  });

  const handleRefresh = () => {
    refetch();
    refetchAttendeesStats();
  };

  const handleExport = async () => {
    try {
      toast.loading('Generating export file...');

      const response = await Event.getEventExportByEventId({
        path: {
          event_id: eventId
        }
      });

      const csvBlob = response.data;

      if (!csvBlob) {
        toast.dismiss();
        toast.error('No data to export');
        return;
      }

      const url = window.URL.createObjectURL(csvBlob as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `event-${eventId}-attendees.csv`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export data');
      console.error('Export error:', error);
    }
  };

  /**
   * Manually check out a single student from the Attendance Records table.
   * The student_id stored in the AttendanceRecord is the numeric student_id string.
   */
  const handleCheckOut = async (studentId: string) => {
    if (loadingStudentId) return; // prevent concurrent requests

    setLoadingStudentId(studentId);
    const toastId = toast.loading('Checking out student…');

    try {
      await Event.postEventByEventIdCheckoutByStudentId({
        path: {
          event_id: eventId,
          student_id: parseInt(studentId, 10)
        },
        throwOnError: true
      });

      toast.dismiss(toastId);
      toast.success('Student checked out successfully');
      handleRefresh();
    } catch (err: unknown) {
      toast.dismiss(toastId);

      // Extract a readable message from the error response if available
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message ?? 'Failed to check out student';
      toast.error(msg);
      console.error('Check-out error:', err);
    } finally {
      setLoadingStudentId(null);
    }
  };

  /**
   * Manually check in a single student by ID.
   */
  const handleCheckIn = async (studentId: string) => {
    if (isCheckingIn) return;

    setIsCheckingIn(true);
    const toastId = toast.loading('Checking in student…');

    try {
      await Event.postEventByEventIdCheckinByStudentId({
        path: {
          event_id: eventId,
          student_id: parseInt(studentId, 10)
        },
        throwOnError: true
      });

      toast.dismiss(toastId);
      toast.success('Student checked in successfully');
      handleRefresh();
      setIsCheckInDialogOpen(false);
    } catch (err: unknown) {
      toast.dismiss(toastId);

      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message ?? 'Failed to check in student';
      toast.error(msg);
      console.error('Check-in error:', err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const attendanceRecords: AttendanceRecord[] =
    attendeesData?.data?.data
      ?.map((item) => {
        const student = item.student;
        if (!student) return null;

        return {
          id: student.student_id?.toString() || '',
          name: student.name || '',
          department: student.department || '',
          program: student.program || '',
          email: student.umindanao_email || '',
          checkInAt: formatDateTime(student.check_in_at ?? undefined),
          checkInBy: student.check_in_by || 'Self',
          checkOutAt: formatDateTime(student.check_out_at ?? undefined),
          checkOutBy: student.check_out_by || (student.check_out_at ? 'Self' : '-')
        };
      })
      .filter((record): record is AttendanceRecord => record !== null) || [];

  const totalStudents = attendeesData?.data?.pagination?.total || 0;
  const totalPages = attendeesData?.data?.pagination?.totalPages || 1;

  const totalStudentsStats = Number(attendeesStatsData?.data?.totalAttendance);
  const totalCheckedOutStats = Number(attendeesStatsData?.data?.totalCheckedOut);

  // Build columns — include the Actions column only when check-out is required
  const tableColumns = createColumns({
    checkOutRequired
  });

  if (attendeesStatsIsLoading) {
    return (
      <div className="min-h-screen">
        <EvenAttendeesSkeleton />
        <EventAttendeesStatsSkeleton />
        <EventDataTableSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:mb-8">
        <div>
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">Attendance Records</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:mt-2 md:text-base lg:text-lg">Manage student check-in and check-out records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCheckInDialogOpen(true)} variant="outline" className="flex-1 gap-2 bg-transparent text-sm font-semibold shadow-sm sm:flex-none">
            <UserPlus className="size-4" />
            <span className="xs:inline hidden">Check in Student</span>
            <span className="xs:hidden">Check in</span>
          </Button>
          <Button onClick={handleRefresh} variant="outline" className="flex-1 gap-2 bg-transparent text-sm font-semibold shadow-sm sm:flex-none">
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={totalStudents === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 gap-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-400 disabled:opacity-50 sm:flex-none"
          >
            <Download className="size-4" />
            <span className="xs:inline hidden">Export Data</span>
            <span className="xs:hidden">Export</span>
          </Button>
        </div>
      </div>

      <EventAttendeesStats totalStudents={totalStudentsStats} totalCheckedOut={totalCheckedOutStats} isLoading={attendeesStatsIsLoading} />

      <AttendanceDataTable
        columns={tableColumns}
        data={attendanceRecords}
        search={search}
        onSearchChange={setSearch}
        page={page}
        onPageChange={setPage}
        totalPages={totalPages}
        totalRecords={totalStudents}
        isLoading={isLoading}
        error={error}
        onCheckOut={handleCheckOut}
        loadingStudentId={loadingStudentId}
      />

      <CheckInStudentDialog
        open={isCheckInDialogOpen}
        onOpenChange={setIsCheckInDialogOpen}
        onConfirm={handleCheckIn}
        isLoading={isCheckingIn}
      />
    </div>
  );
}
