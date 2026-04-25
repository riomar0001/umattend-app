'use client';

import { Calendar, MapPin, Clock, Users, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import EventNotFound from '@/components/event/manage/event-not-found';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiEventData } from '@/types/events';
import { getEventByEventIdOptions } from '@/api/client/@tanstack/react-query.gen';
import { getEventStatus, getAttendanceStatus } from '@/lib/events-utils';
import { formatDate, formatTime } from '@/lib/utils';

const EventDetailsSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section Skeleton */}
      <section className="border-border bg-muted/30 border-b">
        <div className="pt-2" />
        <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
              <div className="flex-1 space-y-4">
                {/* Title Skeleton */}
                <Skeleton className="h-10 w-3/4 bg-neutral-200 md:h-12 lg:h-14" />

                {/* Meta Info Skeleton */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded bg-neutral-200" />
                    <Skeleton className="h-4 w-40 bg-neutral-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded bg-neutral-200" />
                    <Skeleton className="h-4 w-32 bg-neutral-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded bg-neutral-200" />
                    <Skeleton className="h-4 w-28 bg-neutral-200" />
                  </div>
                </div>

                {/* Location Skeleton */}
                <div className="flex items-start gap-2">
                  <Skeleton className="mt-0.5 h-4 w-4 rounded bg-neutral-200" />
                  <Skeleton className="h-4 w-48 bg-neutral-200" />
                </div>

                {/* Button Skeleton */}
                <div className="pt-2">
                  <Skeleton className="h-10 w-32 bg-neutral-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Skeleton */}
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Status Card Skeleton */}
          <Card className="border-primary/20 bg-primary/5 border-2">
            <CardContent className="flex items-start gap-4 p-6">
              <Skeleton className="h-12 w-12 rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48 bg-neutral-200" />
                <Skeleton className="h-4 w-64 bg-neutral-200" />
              </div>
            </CardContent>
          </Card>

          {/* About Event Skeleton */}
          <section className="space-y-4">
            <Skeleton className="h-8 w-40 bg-neutral-200" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full bg-neutral-200" />
              <Skeleton className="h-4 w-full bg-neutral-200" />
              <Skeleton className="h-4 w-5/6 bg-neutral-200" />
            </div>
          </section>

          <Separator />
        </div>
      </main>
    </div>
  );
};

export default function EventDetailsPage() {
  const router = useRouter();

  const params = useParams();
  const eventId = params?.id as string;

  // Fetch event data using the API
  const {
    data: eventData,
    isLoading,
    isError
  } = useQuery({
    ...getEventByEventIdOptions({
      path: {
        event_id: eventId
      }
    }),
    enabled: !!eventId,
    retry: false
  });

  const event = eventData?.data as ApiEventData | undefined;

  const attendanceStatus = event ? getAttendanceStatus(event) : 'did_not_attend';

  if (isLoading || !event) {
    return <EventDetailsSkeleton />;
  }

  if (isError) {
    return <EventNotFound />;
  }

  const eventStatus = getEventStatus(event);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top spotlight gradient — emanating from above the hero */}
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/[0.18] via-primary/[0.06] to-transparent dark:from-primary/[0.26] dark:via-primary/[0.09]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />

        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          {/* Spotlight arcs emanating from top-center — event detail feel */}
          <ellipse cx="50%" cy="-10%" rx="500" ry="380" stroke="oklch(0.85 0.18 95 / 0.30)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="380" ry="280" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="260" ry="180" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />

          {/* Vertical accent lines — flanking the content */}
          <line x1="8%" y1="0%" x2="8%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="5%" y1="0%" x2="5%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="92%" y1="0%" x2="92%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="95%" y1="0%" x2="95%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />

          {/* Accent dots — scattered top area */}
          <circle cx="18%" cy="8%" r="3" fill="oklch(0.85 0.18 95 / 0.80)" />
          <circle cx="78%" cy="6%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="12%" cy="18%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="86%" cy="16%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />

          {/* Bottom-left arc */}
          <circle cx="0" cy="100%" r="300" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="160" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Cross marks */}
          <line x1="3%" y1="30%" x2="7%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5%" y1="28%" x2="5%" y2="32%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="93%" y1="28%" x2="97%" y2="28%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="95%" y1="26%" x2="95%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="46%" y1="88%" x2="50%" y2="88%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="48%" y1="86.5%" x2="48%" y2="89.5%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Hero Section */}
      <section className="border-border bg-muted/30 relative border-b backdrop-blur-[2px]">
        <div className="pt-2" />
        <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
              {/* Event Info */}
              <div className="flex-1 space-y-4">
                <div className="space-y-3">
                  <Badge
                    variant="outline"
                    className={`w-fit border ${
                      eventStatus === 'upcoming'
                        ? 'border-blue-200 bg-blue-100 text-blue-700'
                        : eventStatus === 'ongoing'
                          ? 'border-green-200 bg-green-100 text-green-700'
                          : 'border-gray-200 bg-gray-100 text-gray-700'
                    }`}
                  >
                    {eventStatus === 'ongoing' && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-600" />}
                    {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1)}
                  </Badge>
                  <h1 className="text-foreground text-3xl font-bold tracking-tight text-balance md:text-4xl lg:text-5xl">{event.title}</h1>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{event.start_time && formatDate(event.start_time)}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {event.start_time && formatTime(event.start_time)} - {event.end_time && formatTime(event.end_time)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{event.check_out_required ? event.checkout_count || 0 : event.checkin_count || 0} Attended</span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-foreground font-medium">{event.location}</p>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {event.can_edit ||
                    (eventStatus !== 'upcoming' && (
                      <>
                        {attendanceStatus === 'attended' ? (
                          <Badge className="bg-green-100 px-4 py-2 text-sm text-green-800">✓ Attended</Badge>
                        ) : attendanceStatus === 'partially_attended' ? (
                          <Badge className="bg-yellow-100 px-4 py-2 text-sm text-yellow-800">⚠ Partially Attended</Badge>
                        ) : (
                          <Badge className="bg-neutral-200 px-4 py-2 text-sm">Did Not Attend</Badge>
                        )}
                      </>
                    ))}
                  {event.can_edit && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 font-semibold shadow-sm transition-shadow hover:shadow"
                      onClick={() => router.push(`/events/${event.id}/manage`)}
                    >
                      <Settings className="h-4 w-4" />
                      Manage Event
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Status Card - Show based on attendance status */}
          {attendanceStatus === 'attended' && (
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="flex items-start gap-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
                <div>
                  <h3 className="text-foreground font-semibold">Attendance Confirmed</h3>
                  <p className="text-muted-foreground text-sm">
                    {event.check_out_required
                      ? 'You have successfully checked in and checked out. Thank you for attending!'
                      : 'You have successfully checked in. Thank you for attending!'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {attendanceStatus === 'partially_attended' && (
            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardContent className="flex items-start gap-4">
                <AlertTriangle className="h-12 w-12 text-yellow-600" />
                <div>
                  <h3 className="text-foreground font-semibold">Checked In</h3>
                  <p className="text-muted-foreground text-sm">Don&apos;t forget to check out when you leave to complete your attendance!</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* About Event */}
          <section className="space-y-4">
            <h2 className="text-foreground text-2xl font-bold">About Event</h2>
            <div className="prose prose-sm text-foreground/90 max-w-none leading-relaxed break-words">
              <p className="break-words whitespace-pre-wrap">{event.description}</p>
            </div>
          </section>

          <Separator />
        </div>
      </main>
    </div>
  );
}
