import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { OrganizersSkeleton } from '@/components/event/manage/organizers/organizers-skeleton';
import { Card } from '@/components/ui/card';
import { organizersColumns, type OrganizerRecord } from './data-table/organizers-columns';
import { OrganizersDataTable } from './data-table/organizers-data-table';
import {
  getEventByEventIdOrganizersOptions,
  postEventAddOrganizerByEventIdMutation,
  deleteEventRemoveOrganizerByEventIdMutation
} from '@/api/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/error-utils';
import { formatDateTimeFull } from '@/lib/utils';

interface EventOrganizersProps {
  eventId: string;
}

export default function EventOrganizers({ eventId }: EventOrganizersProps) {
  // Fetch organizers data from API
  const {
    data: organizersData,
    isLoading,
    refetch
  } = useQuery({
    ...getEventByEventIdOrganizersOptions({
      path: {
        event_id: eventId
      }
    }),
    enabled: !!eventId,
    retry: false
  });

  // Mutation for adding organizer
  const addOrganizerMutation = useMutation({
    mutationFn: postEventAddOrganizerByEventIdMutation().mutationFn,
    onSuccess: () => {
      toast.success('Organizer added successfully');
      refetch();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to add organizer'));
    }
  });

  // Mutation for removing organizer
  const removeOrganizerMutation = useMutation({
    mutationFn: deleteEventRemoveOrganizerByEventIdMutation().mutationFn,
    onSuccess: () => {
      toast.success('Organizer removed successfully');
      refetch();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to remove organizer'));
    }
  });

  const handleAddOrganizer = (newOrganizer: { studentId: string; name: string; department: string; program: string; email: string }) => {
    addOrganizerMutation.mutate({
      path: {
        event_id: eventId
      },
      body: {
        umindanao_email: newOrganizer.email
      }
    });
  };

  const handleRemoveOrganizer = (email: string) => {
    removeOrganizerMutation.mutate({
      path: {
        event_id: eventId
      },
      body: {
        umindanao_email: email
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card p-4 sm:p-6">
        <OrganizersSkeleton />
      </Card>
    );
  }

  // Transform API data to OrganizerRecord format
  const organizers: OrganizerRecord[] =
    organizersData?.data?.map((org) => {
      // Check if this organizer is the event creator
      // The creator is someone who added themselves (name === added_by) or was added by System
      const isCreator = org.name === org.added_by || org.added_by === 'System';

      return {
        id: org.student_id?.toString() || '',
        name: org.name || '',
        department: org.department || '',
        program: org.program || '',
        email: org.umindanao_email || '',
        addedBy: org.added_by || '',
        addedAt: formatDateTimeFull(org.added_at),
        isCreator: isCreator
      };
    }) || [];

  return (
    <Card className="border-border bg-card p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-foreground mb-1 text-base font-semibold sm:text-lg">Event Organizers</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">Manage organizers who can help coordinate and run this event.</p>
      </div>
      <OrganizersDataTable columns={organizersColumns} data={organizers} onAddOrganizer={handleAddOrganizer} onRemoveOrganizer={handleRemoveOrganizer} />
    </Card>
  );
}
