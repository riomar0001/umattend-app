'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import EventContent from '@/components/event/event-content';
import EventContentEmpty from '@/components/event/event-content-empty';
import EventDetails from '@/components/event/event-details';
import EventsSkeleton from '@/components/event/events-skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { getEventOptions } from '@/api/client/@tanstack/react-query.gen';
import { transformEventData } from '@/lib/events-utils';

export default function DashboardPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: eventsData, isLoading } = useQuery({
    ...getEventOptions(),
    retry: false
  });

  const events = eventsData?.data || [];
  const transformedEvents = events.map(transformEventData).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const selectedEvent = transformedEvents.find((event) => event.apiId === selectedEventId);

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsSheetOpen(true);
  };

  return (
    <div className="bg-background relative min-h-screen">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top gradient wash */}
        <div className="from-primary/[0.15] via-primary/[0.06] dark:from-primary/[0.22] dark:via-primary/[0.08] absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent" />
        {/* Bottom gradient wash */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />

        {/* SVG decorative layer */}
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          {/* Top-right: concentric arcs radiating from corner — primary/yellow */}
          <circle cx="100%" cy="0" r="520" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="390" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="260" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="130" stroke="oklch(0.85 0.18 95 / 0.14)" strokeWidth="1.5" />

          {/* Accent dots near top-right rings */}
          <circle cx="87%" cy="11%" r="3.5" fill="oklch(0.85 0.18 95 / 0.75)" />
          <circle cx="92%" cy="21%" r="2" fill="oklch(0.85 0.18 95 / 0.60)" />
          <circle cx="96%" cy="34%" r="2.5" fill="oklch(0.85 0.18 95 / 0.50)" />
          <circle cx="84%" cy="6%" r="2" fill="oklch(0.85 0.18 95 / 0.45)" />

          {/* Dashed lines — right edge, mid-page */}
          <line x1="62%" y1="46%" x2="104%" y2="46%" stroke="oklch(0.85 0.18 95 / 0.32)" strokeWidth="1" strokeDasharray="5 9" />
          <line x1="68%" y1="50%" x2="104%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1" strokeDasharray="5 9" />
          <line x1="74%" y1="54%" x2="104%" y2="54%" stroke="oklch(0.85 0.18 95 / 0.16)" strokeWidth="1" strokeDasharray="5 9" />

          {/* Bottom-left: neutral arcs — use CSS vars so they adapt to dark mode */}
          <circle cx="0" cy="100%" r="400" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="260" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="130" style={{ stroke: 'var(--dec-n3)' }} strokeWidth="1.5" />

          {/* Bottom-right arc */}
          <circle cx="100%" cy="100%" r="180" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Plus marks */}
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
          <div className="mb-6 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <h1 className="text-foreground text-4xl font-black tracking-tighter sm:text-5xl">Events</h1>
            <nav className="flex items-center gap-6 pb-px">
              <Link
                href="/events"
                className="text-foreground after:bg-primary relative text-sm font-semibold after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:content-['']"
                onClick={(e) => e.stopPropagation()}
              >
                Upcoming
              </Link>
              <Link href="/events/past" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Past
              </Link>
            </nav>
          </div>
          <div className="bg-border h-px" />
        </div>

        {isLoading ? (
          <EventsSkeleton />
        ) : transformedEvents.length > 0 ? (
          <div className="flex flex-col gap-y-5">
            {transformedEvents.map((event, index) => (
              <EventContent
                key={event.apiId}
                event={event}
                index={index}
                isLast={index === transformedEvents.length - 1}
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
      </main>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" hideClose>
          {selectedEvent && <EventDetails event={selectedEvent} onClose={() => setIsSheetOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
