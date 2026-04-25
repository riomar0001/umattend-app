'use client';

import { MapPin, Clock, Users, Edit, ChevronLeft, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/types/events';

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

export default function HeroSection({ event, setIsSheetOpen }: { event: Event; setIsSheetOpen: (open: boolean) => void }) {
  const router = useRouter();
  const { label: statusLabel, className: statusClassName } = statusConfig[event.status] ?? statusConfig.upcoming;

  const dayNum = event.startDate.getDate().toString();
  const monthAbbr = event.startDate.toLocaleString('en', { month: 'short' }).toUpperCase();
  const dayOfWeek = event.startDate.toLocaleString('en', { weekday: 'long' });

  const attendeeText =
    event.status === 'upcoming'
      ? 'No attendees yet'
      : event.status === 'ongoing'
        ? `${event.checkInCount} attending`
        : `${event.checkOutRequired ? event.checkOutCount : event.checkInCount} attended`;

  return (
    <section className="relative border-b border-border backdrop-blur-[2px]">
      <div className="container mx-auto max-w-4xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
        {/* Top bar: back nav + edit button */}
        <div className="mb-7 flex items-center justify-between">
          <button
            onClick={() => router.push(`/events/${event.id}`)}
            className="group flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Event
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Shield className="h-3 w-3" />
              Manage mode
            </span>
            <Button size="sm" onClick={() => setIsSheetOpen(true)} className="gap-2 font-semibold">
              <Edit className="h-3.5 w-3.5" />
              Edit Event
            </Button>
          </div>
        </div>

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
              {event.status === 'ongoing' && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
              )}
              {statusLabel}
            </Badge>
            <h1 className="text-foreground text-2xl font-black leading-tight tracking-tighter sm:text-3xl lg:text-4xl">
              {event.name}
            </h1>
          </div>
        </div>

        {/* Meta details card */}
        <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm divide-y divide-border/40">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Clock className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Time</span>
            <span className="ml-auto text-sm text-foreground/80">
              {event.startTime}
              {event.endTime ? ` – ${event.endTime}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Location</span>
            <span className="ml-auto max-w-[60%] text-right text-sm text-foreground/80 line-clamp-1">
              {event.location || 'TBD'}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Users className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Attendees</span>
            <span className="ml-auto text-sm text-foreground/80">{attendeeText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
