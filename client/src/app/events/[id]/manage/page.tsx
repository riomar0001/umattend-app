'use client';

import { useState, useEffect } from 'react';
import { BarChart3, UserCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import EventAttendees from '@/components/event/manage/attendees/event-attendees';
import EventDetails from '@/components/event/manage/details/event-details';
import EventNotFound from '@/components/event/manage/event-not-found';
import HeroSection from '@/components/event/manage/hero-section';
import ManageEventSkeleton from '@/components/event/manage/manage-event-skeleton';
import EventOrganizers from '@/components/event/manage/organizers/event-organizers';
import { EventCheckInScanner } from '@/components/event/manage/qr-scanner/event-check-in-scanner';
import { EventCheckOutScanner } from '@/components/event/manage/qr-scanner/event-check-out-scanner';
import { UpdateEventSheet } from '@/components/event/manage/update-event-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Event } from '@/types/events';
import { getEventByEventIdOptions } from '@/api/client/@tanstack/react-query.gen';
import { getEventStatus } from '@/lib/events-utils';
import { formatTimePadded } from '@/lib/utils';

export default function ManageSingleEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Fetch event data from API
  const {
    data: eventData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    ...getEventByEventIdOptions({
      path: {
        event_id: eventId
      }
    }),
    enabled: !!eventId,
    retry: false
  });

  const handleUpdateEvent = () => {
    setIsSheetOpen(false);
    // Refetch event data after update
    refetch();
  };

  // Check if user has permission to manage this event
  useEffect(() => {
    if (!isLoading && eventData?.data && !eventData.data.can_edit) {
      router.push('/forbidden');
    }
  }, [isLoading, eventData, router]);

  if (isLoading) {
    return <ManageEventSkeleton />;
  }

  if (isError || !eventData?.data) {
    return <EventNotFound />;
  }

  // Don't render if user doesn't have permission (will redirect)
  if (!eventData.data.can_edit) {
    return <ManageEventSkeleton />;
  }

  // Transform API data to Event type
  const apiEvent = eventData.data;
  const startDate = apiEvent.start_time ? new Date(apiEvent.start_time) : new Date();
  const endDate = apiEvent.end_time ? new Date(apiEvent.end_time) : new Date();

  // Determine if event has started
  const now = new Date();
  const isEventStarted = startDate <= now;
  const isEventDone = apiEvent.is_done || false;

  const event: Event = {
    id: apiEvent.id || '',
    name: apiEvent.title || 'Untitled Event',
    description: apiEvent.description || '',
    location: apiEvent.location || '',
    department: apiEvent.department || '',
    startDate: startDate,
    endDate: endDate,
    startTime: apiEvent.all_day ? 'All Day' : formatTimePadded(startDate),
    endTime: apiEvent.all_day ? '' : formatTimePadded(endDate),
    capacity: apiEvent.capacity || 'unlimited',
    checkOutCount: apiEvent.checkout_count || 0,
    checkInCount: apiEvent.checkin_count || 0,
    status: getEventStatus(apiEvent),
    checkOutRequired: apiEvent.check_out_required || false
  };

  if (isLoading) {
    return <ManageEventSkeleton />;
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Hero Section */}
      <HeroSection event={event} setIsSheetOpen={setIsSheetOpen} />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Tabs Section */}
        <Tabs defaultValue="details" className="space-y-4 sm:space-y-6">
          <div className="w-full overflow-x-auto">
            <TabsList className="bg-muted text-muted-foreground inline-flex h-10 w-full min-w-max items-center justify-start gap-x-1 rounded-lg p-1 sm:h-11 sm:w-auto sm:justify-center sm:gap-x-2">
              <TabsTrigger value="details" className="rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm">
                <BarChart3 className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                Details
              </TabsTrigger>

              <TabsTrigger value="attendees" className="rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm">
                <UserCheck className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                Attendees
              </TabsTrigger>

              <TabsTrigger value="check-in" className="rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm">
                <UserCheck className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                Check In
              </TabsTrigger>

              <TabsTrigger value="check-out" className="rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm">
                <UserCheck className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                Check Out
              </TabsTrigger>

              <TabsTrigger value="organizers" className="rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm">
                <UserCheck className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                Organizers
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details">
            <EventDetails event={event} />
          </TabsContent>

          <TabsContent value="check-in">
            <EventCheckInScanner eventId={event.id} isEventDone={isEventDone} isEventStarted={isEventStarted} />
          </TabsContent>

          <TabsContent value="check-out">
            <EventCheckOutScanner eventId={event.id} isEventDone={isEventDone} isEventStarted={isEventStarted} />
          </TabsContent>

          <TabsContent value="organizers">
            <EventOrganizers eventId={eventId} />
          </TabsContent>

          <TabsContent value="attendees">
            <EventAttendees eventId={eventId} checkOutRequired={event.checkOutRequired} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Update Event Sheet */}
      <UpdateEventSheet event={event} open={isSheetOpen} onOpenChange={setIsSheetOpen} onUpdate={handleUpdateEvent} />
    </div>
  );
}
