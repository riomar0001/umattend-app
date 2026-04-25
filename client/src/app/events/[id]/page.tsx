'use client';

import { MapPin, Clock, Users, Settings, AlertTriangle, CheckCircle, ChevronLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import EventNotFound from '@/components/event/manage/event-not-found';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiEventData } from '@/types/events';
import { getEventByEventIdOptions } from '@/api/client/@tanstack/react-query.gen';
import { getEventStatus, getAttendanceStatus } from '@/lib/events-utils';
import { formatDate, formatTime } from '@/lib/utils';

const EventDetailsSkeleton = () => (
  <div className="min-h-screen bg-background">
    <section className="border-b border-border">
      <div className="container mx-auto max-w-4xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
        <Skeleton className="h-4 w-16" />
        <div className="mt-7 flex items-start gap-5 sm:gap-8">
          <div className="flex-shrink-0 space-y-2 text-right">
            <Skeleton className="ml-auto h-12 w-10 sm:h-16 sm:w-14" />
            <Skeleton className="ml-auto h-2 w-7" />
            <Skeleton className="ml-auto h-2 w-5" />
          </div>
          <div className="w-px self-stretch bg-border/40" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-4/5 sm:h-10" />
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <Skeleton className="mt-6 h-8 w-32" />
      </div>
    </section>
    <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </main>
  </div>
);

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id as string;

  const { data: eventData, isLoading, isError } = useQuery({
    ...getEventByEventIdOptions({ path: { event_id: eventId } }),
    enabled: !!eventId,
    retry: false
  });

  const event = eventData?.data as ApiEventData | undefined;
  const attendanceStatus = event ? getAttendanceStatus(event) : 'did_not_attend';

  if (isLoading || !event) return <EventDetailsSkeleton />;
  if (isError) return <EventNotFound />;

  const eventStatus = getEventStatus(event);

  const statusConfig = {
    upcoming: {
      label: 'Upcoming',
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
    },
    ongoing: {
      label: 'Live now',
      className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
    },
    completed: {
      label: 'Completed',
      className: 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400'
    }
  };
  const { label: statusLabel, className: statusClassName } = statusConfig[eventStatus];

  const startDate = event.start_time ? new Date(event.start_time) : null;
  const dayNum = startDate ? startDate.getDate().toString() : '—';
  const monthAbbr = startDate ? startDate.toLocaleString('en', { month: 'short' }).toUpperCase() : '';
  const dayOfWeek = startDate ? startDate.toLocaleString('en', { weekday: 'long' }) : '';
  const attendeeCount = event.check_out_required ? event.checkout_count || 0 : event.checkin_count || 0;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decorative */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/[0.18] via-primary/[0.06] to-transparent dark:from-primary/[0.26] dark:via-primary/[0.09]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <ellipse cx="50%" cy="-10%" rx="500" ry="380" stroke="oklch(0.85 0.18 95 / 0.30)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="380" ry="280" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="260" ry="180" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />
          <line x1="8%" y1="0%" x2="8%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="5%" y1="0%" x2="5%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="92%" y1="0%" x2="92%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="95%" y1="0%" x2="95%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />
          <circle cx="18%" cy="8%" r="3" fill="oklch(0.85 0.18 95 / 0.80)" />
          <circle cx="78%" cy="6%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="12%" cy="18%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="86%" cy="16%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="0" cy="100%" r="300" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="160" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <line x1="3%" y1="30%" x2="7%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5%" y1="28%" x2="5%" y2="32%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="93%" y1="28%" x2="97%" y2="28%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="95%" y1="26%" x2="95%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="46%" y1="88%" x2="50%" y2="88%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="48%" y1="86.5%" x2="48%" y2="89.5%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Hero */}
      <section className="relative border-b border-border backdrop-blur-[2px]">
        <div className="container mx-auto max-w-4xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
          {/* Back nav */}
          <button
            onClick={() => router.push('/events')}
            className="group mb-7 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Events
          </button>

          {/* Date block + title row */}
          <div className="flex items-start gap-4 sm:gap-7">
            {/* Date block */}
            <div className="flex-shrink-0 text-right">
              <div className="text-foreground text-5xl font-black leading-none tracking-tighter sm:text-6xl">{dayNum}</div>
              <div className="text-muted-foreground mt-1 text-[9px] font-bold uppercase tracking-widest">{monthAbbr}</div>
              <div className="text-muted-foreground/50 text-[8px] uppercase tracking-wide">{dayOfWeek.slice(0, 3)}</div>
            </div>

            {/* Hairline */}
            <div className="w-px self-stretch bg-border/50" />

            {/* Badge + title */}
            <div className="min-w-0 flex-1 space-y-3">
              <Badge
                variant="outline"
                className={`w-fit border text-[10px] font-bold uppercase tracking-widest ${statusClassName}`}
              >
                {eventStatus === 'ongoing' && (
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
                )}
                {statusLabel}
              </Badge>
              <h1 className="text-foreground text-2xl font-black leading-tight tracking-tighter sm:text-3xl lg:text-4xl">
                {event.title}
              </h1>
            </div>
          </div>

          {/* Meta details */}
          <div className="mt-6 w-auto overflow-hidden rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm divide-y divide-border/40">
            {startDate && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Clock className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Time</span>
                <span className="ml-auto text-sm text-foreground/80">
                  {formatTime(event.start_time!)}
                  {event.end_time && ` – ${formatTime(event.end_time)}`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Location</span>
              <span className="ml-auto  text-right text-sm text-foreground/80 line-clamp-1">{event.location || 'TBD'}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Users className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Attendees</span>
              <span className="ml-auto text-sm text-foreground/80">{attendeeCount}</span>
            </div>
          </div>

          {/* CTA row */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {event.can_edit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 font-semibold"
                onClick={() => router.push(`/events/${event.id}/manage`)}
              >
                <Settings className="h-3.5 w-3.5" />
                Manage Event
              </Button>
            )}

            {eventStatus !== 'upcoming' && (
              <>
                {attendanceStatus === 'attended' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
                    <CheckCircle className="h-3 w-3" />
                    Attended
                  </span>
                )}
                {attendanceStatus === 'partially_attended' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
                    <AlertTriangle className="h-3 w-3" />
                    Partially Attended
                  </span>
                )}
                {attendanceStatus === 'did_not_attend' && !event.can_edit && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                    Did Not Attend
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="relative container mx-auto max-w-4xl px-4 py-8 backdrop-blur-sm sm:px-6 sm:py-10">
        <div className="space-y-8">
          {/* Attendance banner */}
          {attendanceStatus === 'attended' && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/80 px-4 py-4 backdrop-blur-sm dark:border-green-800 dark:bg-green-950/30 sm:gap-4 sm:px-5">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400 sm:h-5 sm:w-5" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Attendance confirmed</p>
                <p className="mt-0.5 text-sm text-green-700 dark:text-green-400">
                  {event.check_out_required
                    ? 'You checked in and checked out successfully.'
                    : 'You checked in successfully. Thanks for attending!'}
                </p>
              </div>
            </div>
          )}

          {attendanceStatus === 'partially_attended' && (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50/80 px-4 py-4 backdrop-blur-sm dark:border-yellow-800 dark:bg-yellow-950/30 sm:gap-4 sm:px-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400 sm:h-5 sm:w-5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Checked in</p>
                <p className="mt-0.5 text-sm text-yellow-700 dark:text-yellow-400">
                  Don&apos;t forget to check out when you leave to complete your attendance.
                </p>
              </div>
            </div>
          )}

          {/* Date detail */}
          {startDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-xs font-medium tracking-wide">{formatDate(event.start_time!)}</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
          )}

          {/* About */}
          {event.description ? (
            <section className="rounded-xl border border-border/50 bg-background/50 px-5 py-6 backdrop-blur-sm sm:px-6">
              <h2 className="text-foreground mb-4 text-lg font-bold tracking-tight sm:text-xl">About this event</h2>
              <p className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap break-words sm:text-[0.9375rem]">
                {event.description}
              </p>
            </section>
          ) : (
            <section className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/50 py-10 text-center backdrop-blur-sm">
              <p className="text-muted-foreground text-sm">No description provided for this event.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
