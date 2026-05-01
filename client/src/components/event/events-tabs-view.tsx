'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import EventContent from '@/components/event/event-content';
import EventContentEmpty from '@/components/event/event-content-empty';
import EventDetails from '@/components/event/event-details';
import EventsSkeleton from '@/components/event/events-skeleton';
import PastEventContentEmpty from '@/components/event/past-event-content-empty';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getEventOptions, getEventPastOptions } from '@/api/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/error-utils';
import { transformEventData } from '@/lib/events-utils';
import { useAuthStore } from '@/store/authStore';

interface EventsTabsViewProps {
  defaultTab: 'upcoming' | 'past';
}

export default function EventsTabsView({ defaultTab }: EventsTabsViewProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>(defaultTab);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isOrganizer = user?.role && ['admin', 'organizer', 'csg'].includes(user.role);

  const {
    data: eventsData,
    isLoading: isUpcomingLoading,
    isError: isUpcomingError,
    error: upcomingError
  } = useQuery({
    ...getEventOptions(),
    retry: false
  });

  const {
    data: pastEventsData,
    isLoading: isPastLoading,
    isError: isPastError,
    error: pastError
  } = useQuery({
    ...getEventPastOptions(),
    retry: false
  });

  useEffect(() => {
    if (isUpcomingError) toast.error(getErrorMessage(upcomingError, 'Failed to load events'));
  }, [isUpcomingError, upcomingError]);

  useEffect(() => {
    if (isPastError) toast.error(getErrorMessage(pastError, 'Failed to load past events'));
  }, [isPastError, pastError]);

  const events = eventsData?.data || [];
  const allUpcoming = events.map(transformEventData).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const liveEvents = allUpcoming.filter((e) => e.eventStatus === 'ongoing');
  const upcomingEvents = allUpcoming.filter((e) => e.eventStatus === 'upcoming');
  const pastEvents = (pastEventsData?.data || []).map(transformEventData);

  const allEvents = [...allUpcoming, ...pastEvents];
  const selectedEvent = allEvents.find((e) => e.apiId === selectedEventId);

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsSheetOpen(true);
  };

  const handleTabChange = (value: string) => {
    const tab = value as 'upcoming' | 'past';
    setActiveTab(tab);
    window.history.replaceState(null, '', tab === 'past' ? '/events/past' : '/events');
  };

  return (
    <div className="bg-background relative">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="from-primary/[0.15] via-primary/[0.06] dark:from-primary/[0.22] dark:via-primary/[0.08] absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <circle cx="100%" cy="0" r="520" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="390" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="260" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="130" stroke="oklch(0.85 0.18 95 / 0.14)" strokeWidth="1.5" />
          <circle cx="87%" cy="11%" r="3.5" fill="oklch(0.85 0.18 95 / 0.75)" />
          <circle cx="92%" cy="21%" r="2" fill="oklch(0.85 0.18 95 / 0.60)" />
          <circle cx="96%" cy="34%" r="2.5" fill="oklch(0.85 0.18 95 / 0.50)" />
          <circle cx="84%" cy="6%" r="2" fill="oklch(0.85 0.18 95 / 0.45)" />
          <line x1="62%" y1="46%" x2="104%" y2="46%" stroke="oklch(0.85 0.18 95 / 0.32)" strokeWidth="1" strokeDasharray="5 9" />
          <line x1="68%" y1="50%" x2="104%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1" strokeDasharray="5 9" />
          <line x1="74%" y1="54%" x2="104%" y2="54%" stroke="oklch(0.85 0.18 95 / 0.16)" strokeWidth="1" strokeDasharray="5 9" />
          <circle cx="0" cy="100%" r="400" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="260" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="130" style={{ stroke: 'var(--dec-n3)' }} strokeWidth="1.5" />
          <circle cx="100%" cy="100%" r="180" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <line x1="7%" y1="20%" x2="11%" y2="20%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9%" y1="18%" x2="9%" y2="22%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3%" y1="55%" x2="6%" y2="55%" stroke="oklch(0.85 0.18 95 / 0.45)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4.5%" y1="53.5%" x2="4.5%" y2="56.5%" stroke="oklch(0.85 0.18 95 / 0.45)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="76%" y1="84%" x2="80%" y2="84%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="78%" y1="82%" x2="78%" y2="86%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="48%" y1="90%" x2="51%" y2="90%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="49.5%" y1="88.5%" x2="49.5%" y2="91.5%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <main className="relative container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Page header */}
        <div className="mb-10 sm:mb-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h1 className="text-foreground text-4xl font-black tracking-tighter sm:text-5xl">Events</h1>
            {isOrganizer && (
              <Link href="/events/new">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer font-medium">
                  <Plus size={15} />
                  Create Event
                </Button>
              </Link>
            )}
          </div>
          <div className="bg-border h-px" />
        </div>

        {/* Live Events */}
        {!isUpcomingLoading && liveEvents.length > 0 && (
          <section className="mb-10">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <h2 className="text-xs font-bold tracking-widest text-green-600 uppercase">Live Now</h2>
            </div>
            <div className="flex flex-col gap-y-5">
              {liveEvents.map((event, index) => (
                <EventContent
                  key={event.apiId}
                  event={event}
                  index={index}
                  isLast={index === liveEvents.length - 1}
                  onCardClick={() => handleEventClick(event.apiId)}
                  onManageClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event.apiId);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {!isUpcomingLoading && liveEvents.length > 0 && <div className="bg-border mb-10 h-px" />}

        {/* Upcoming / Past tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="rounded-md p-2 backdrop-blur-sm">
          <TabsList className="mb-6 grid h-10 w-full grid-cols-2 rounded-none border-b-2 bg-transparent backdrop-blur-xs">
            <TabsTrigger
              value="upcoming"
              className="hover:text-foreground data-[state=active]:border-primary cursor-pointer rounded-none border-b-2 border-transparent bg-transparent text-sm font-medium transition-all duration-200 data-[state=active]:shadow-none"
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="hover:text-foreground data-[state=active]:border-primary cursor-pointer rounded-none border-b-2 border-transparent bg-transparent text-sm font-medium transition-all duration-200 data-[state=active]:shadow-none"
            >
              Past
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="upcoming"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-4 data-[state=active]:duration-300"
          >
            {isUpcomingLoading ? (
              <EventsSkeleton />
            ) : upcomingEvents.length > 0 ? (
              <div className="flex flex-col gap-y-5">
                {upcomingEvents.map((event, index) => (
                  <EventContent
                    key={event.apiId}
                    event={event}
                    index={index}
                    isLast={index === upcomingEvents.length - 1}
                    onCardClick={() => handleEventClick(event.apiId)}
                    onManageClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event.apiId);
                    }}
                  />
                ))}
              </div>
            ) : (
              <EventContentEmpty />
            )}
          </TabsContent>

          <TabsContent
            value="past"
            className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-4 data-[state=active]:duration-300"
          >
            {isPastLoading ? (
              <EventsSkeleton />
            ) : pastEvents.length > 0 ? (
              <div className="flex flex-col gap-y-5">
                {pastEvents.map((event, index) => (
                  <EventContent
                    key={event.apiId}
                    event={event}
                    index={index}
                    isLast={index === pastEvents.length - 1}
                    onCardClick={() => handleEventClick(event.apiId)}
                    onManageClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event.apiId);
                    }}
                  />
                ))}
              </div>
            ) : (
              <PastEventContentEmpty />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" hideClose>
          {selectedEvent && <EventDetails event={selectedEvent} onClose={() => setIsSheetOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
