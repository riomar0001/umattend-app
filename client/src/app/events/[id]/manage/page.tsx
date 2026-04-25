'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Users, UserCheck, UserX, Shield } from 'lucide-react';
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

  const {
    data: eventData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    ...getEventByEventIdOptions({ path: { event_id: eventId } }),
    enabled: !!eventId,
    retry: false
  });

  const handleUpdateEvent = () => {
    setIsSheetOpen(false);
    refetch();
  };

  useEffect(() => {
    if (!isLoading && eventData?.data && !eventData.data.can_edit) {
      router.push('/forbidden');
    }
  }, [isLoading, eventData, router]);

  if (isLoading) return <ManageEventSkeleton />;
  if (isError || !eventData?.data) return <EventNotFound />;
  if (!eventData.data.can_edit) return <ManageEventSkeleton />;

  const apiEvent = eventData.data;
  const startDate = apiEvent.start_time ? new Date(apiEvent.start_time) : new Date();
  const endDate = apiEvent.end_time ? new Date(apiEvent.end_time) : new Date();
  const now = new Date();
  const isEventStarted = startDate <= now;
  const isEventDone = apiEvent.is_done || false;

  const event: Event = {
    id: apiEvent.id || '',
    name: apiEvent.title || 'Untitled Event',
    description: apiEvent.description || '',
    location: apiEvent.location || '',
    department: apiEvent.department || '',
    startDate,
    endDate,
    startTime: apiEvent.all_day ? 'All Day' : formatTimePadded(startDate),
    endTime: apiEvent.all_day ? '' : formatTimePadded(endDate),
    capacity: apiEvent.capacity || 'unlimited',
    checkOutCount: apiEvent.checkout_count || 0,
    checkInCount: apiEvent.checkin_count || 0,
    status: getEventStatus(apiEvent),
    checkOutRequired: apiEvent.check_out_required || false
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decorative */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/[0.15] via-primary/[0.05] to-transparent dark:from-primary/[0.22] dark:via-primary/[0.07]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <circle cx="100%" cy="0" r="600" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="420" stroke="oklch(0.85 0.18 95 / 0.16)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="240" stroke="oklch(0.85 0.18 95 / 0.12)" strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="380" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="220" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <line x1="3%" y1="28%" x2="7%" y2="28%" stroke="oklch(0.85 0.18 95 / 0.55)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5%" y1="26%" x2="5%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.55)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="88%" cy="10%" r="3" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="93%" cy="22%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
        </svg>
      </div>

      <HeroSection event={event} setIsSheetOpen={setIsSheetOpen} />

      <main className="relative container mx-auto max-w-4xl px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-8">
        <Tabs defaultValue="details">
          {/* Underline tab nav */}
          <div className="mb-6 overflow-x-auto">
            <TabsList className="h-auto w-max min-w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger
                value="details"
                className="relative h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Details
              </TabsTrigger>

              <TabsTrigger
                value="attendees"
                className="relative h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <Users className="h-3.5 w-3.5" />
                Attendees
              </TabsTrigger>

              <TabsTrigger
                value="check-in"
                className="relative h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Check In
              </TabsTrigger>

              <TabsTrigger
                value="check-out"
                className="relative h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <UserX className="h-3.5 w-3.5" />
                Check Out
              </TabsTrigger>

              <TabsTrigger
                value="organizers"
                className="relative h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
              >
                <Shield className="h-3.5 w-3.5" />
                Organizers
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details">
            <EventDetails event={event} />
          </TabsContent>

          <TabsContent value="attendees">
            <EventAttendees eventId={eventId} checkOutRequired={event.checkOutRequired} />
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
        </Tabs>
      </main>

      <UpdateEventSheet event={event} open={isSheetOpen} onOpenChange={setIsSheetOpen} onUpdate={handleUpdateEvent} />
    </div>
  );
}
