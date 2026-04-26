import React from 'react';
import { MapPin, UsersRound, AlertTriangle, ArrowUpRight, ChevronsLeft, Settings, Clock, EyeOff, CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { EventCardData, EventStatus } from '@/types/events';
import { Button } from '../ui/button';
import { SheetDescription, SheetTitle } from '../ui/sheet';

interface EventDetailsProps {
  event: EventCardData & { apiId?: string; eventStatus?: EventStatus };
  onClose?: () => void;
}

const EventDetails = ({ event, onClose }: EventDetailsProps) => {
  const router = useRouter();

  const { id, apiId, title, description, dayOfWeek, date, startTime, endTime, hasLocation = false, location, checkin_count, checkout_count, is_draft, can_edit } =
    event;

  const eventStatus = event.eventStatus || 'upcoming';
  const eventId = apiId || id;

  const dateParts = date ? date.split(' ') : [];
  const monthAbbr = dateParts[0] || '';
  const dayNum = dateParts[1]?.replace(',', '') || '';

  const statusConfig = {
    upcoming: { label: 'Upcoming', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ongoing: { label: 'Live Now', color: 'text-green-600', bg: 'bg-green-500/10' },
    completed: { label: 'Completed', color: 'text-neutral-400', bg: 'bg-neutral-500/10' }
  };
  const { label: statusLabel, color: statusColor, bg: statusBg } = statusConfig[eventStatus];

  const attendeeText =
    eventStatus === 'upcoming' ? 'No attendees yet' : eventStatus === 'ongoing' ? `${checkin_count} attending` : `${checkout_count} attended`;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-border flex flex-shrink-0 items-center justify-between border-b px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ChevronsLeft className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        <div className="flex items-center gap-5">
          {can_edit && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/events/${eventId}/manage`)}>
              <Settings className="h-3.5 w-3.5" />
              Manage
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/events/${eventId}`)}>
            View event
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden px-6 pb-8 pt-7">
          {/* Background gradient */}
          <div className="from-primary/[0.12] via-primary/[0.04] pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent" />

          {/* Decorative SVG */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" fill="none">
            <circle cx="110%" cy="-10%" r="220" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1.5" />
            <circle cx="110%" cy="-10%" r="150" stroke="oklch(0.85 0.18 95 / 0.14)" strokeWidth="1.5" />
            <circle cx="110%" cy="-10%" r="80" stroke="oklch(0.85 0.18 95 / 0.10)" strokeWidth="1.5" />
            <circle cx="90%" cy="14%" r="3" fill="oklch(0.85 0.18 95 / 0.70)" />
            <circle cx="95%" cy="28%" r="2" fill="oklch(0.85 0.18 95 / 0.50)" />
            <line x1="-5%" y1="78%" x2="40%" y2="78%" stroke="oklch(0.85 0.18 95 / 0.12)" strokeWidth="1" strokeDasharray="4 8" />
            <line x1="-5%" y1="86%" x2="30%" y2="86%" stroke="oklch(0.85 0.18 95 / 0.08)" strokeWidth="1" strokeDasharray="4 8" />
          </svg>

          {/* Draft banner */}
          {is_draft && (
            <div className="relative mb-5 flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/30">
              <EyeOff className="h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Draft — only visible to you</p>
            </div>
          )}

          {/* Status badge */}
          <div className="relative mb-5 flex items-center gap-2">
            {eventStatus === 'ongoing' && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase ${statusColor} ${statusBg}`}>
              {is_draft ? 'Draft' : statusLabel}
            </span>
          </div>

          {/* Date + title */}
          <div className="relative flex items-start gap-4">
            {/* Date block */}
            <div className="flex-shrink-0 text-right">
              <div className="text-foreground text-5xl leading-none font-black tracking-tighter">{dayNum}</div>
              <div className="text-muted-foreground mt-1 text-[9px] font-bold tracking-widest uppercase">{monthAbbr}</div>
              <div className="text-muted-foreground/50 mt-0.5 text-[8px] tracking-wide uppercase">{dayOfWeek?.slice(0, 3)}</div>
            </div>

            {/* Hairline */}
            <div className="bg-border/50 mt-1 w-px self-stretch" />

            {/* Title */}
            <div className="min-w-0 flex-1 pt-1">
              <SheetTitle className="text-foreground text-xl leading-tight font-black tracking-tighter break-words sm:text-4xl">{title}</SheetTitle>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="border-border border-t px-6 py-6">
          <div className="space-y-5">
            {/* Time */}
            <div className="flex items-start gap-3">
              <div className="bg-muted mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <div className="space-y-0.5 pt-0.5">
                <p className="text-foreground text-sm font-medium">
                  {dayOfWeek}, {date}
                </p>
                <p className="text-muted-foreground text-sm">
                  {startTime}
                  {endTime ? ` – ${endTime}` : ''}
                </p>
              </div>
            </div>

            {/* Location */}
            {hasLocation ? (
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md">
                  <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                </div>
                <p className="text-foreground pt-1 text-sm break-words">{location}</p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="pt-1 text-sm text-amber-600 dark:text-amber-400">Location not set</p>
              </div>
            )}

            {/* Attendees */}
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md">
                <UsersRound className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <p className="text-muted-foreground text-sm">{attendeeText}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="border-border border-t px-6 py-6">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              <p className="text-foreground text-xs font-semibold tracking-widest uppercase">About</p>
            </div>
            <SheetDescription className="text-foreground/75 text-sm leading-relaxed break-words whitespace-pre-wrap sm:text-[0.9375rem]">
              {description}
            </SheetDescription>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-6" />
      </div>
    </div>
  );
};

export default EventDetails;
