import React from 'react';
import { MapPin, TriangleAlert, UsersRound, EyeOff } from 'lucide-react';
import type { EventCardData, EventStatus } from '@/types/events';

interface EventContentProps {
  event: EventCardData & { eventStatus?: EventStatus };
  index: number;
  isLast?: boolean;
  onCardClick?: () => void;
  onManageClick?: (e: React.MouseEvent) => void;
}

const statusConfig = (status: EventStatus) => {
  switch (status) {
    case 'upcoming':
      return { label: 'Upcoming', color: 'text-blue-500' };
    case 'ongoing':
      return { label: 'Live', color: 'text-green-600' };
    case 'completed':
      return { label: 'Completed', color: 'text-neutral-400' };
    default:
      return { label: 'Upcoming', color: 'text-blue-500' };
  }
};

const EventContent = ({ event, isLast = false, onCardClick }: EventContentProps) => {
  const { title, date, dayOfWeek, startTime, endTime, endDate, location, hasLocation = false, checkin_count, checkout_count, is_draft } = event;
  const eventStatus = event.eventStatus || 'upcoming';

  const dateParts = date ? date.split(' ') : [];
  const monthAbbr = dateParts[0] || '';
  const dayNum = dateParts[1]?.replace(',', '') || '';

  const { label: statusLabel, color: statusColor } = statusConfig(eventStatus);
  const attendeeText =
    eventStatus === 'upcoming' ? 'No attendees yet' : eventStatus === 'ongoing' ? `${checkin_count} attending` : `${checkout_count} attended`;

  return (
    <div
      className={`group relative flex cursor-pointer items-stretch border backdrop-blur-md dark:border-neutral-800 ${!isLast ? 'border-border/60 border-b' : ''}`}
      onClick={onCardClick}
    >
      {/* Base gradient */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-100/80 via-neutral-50/40 to-transparent dark:from-neutral-800/50 dark:via-neutral-800/20 dark:to-transparent"
        aria-hidden
      />
      {/* Hover gradient */}
      <div
        className="from-primary/[0.08] via-primary/[0.03] pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />

      {/* Left bar — amber for drafts, primary on hover otherwise */}
      <div
        className={`relative z-10 w-0.5 flex-shrink-0 self-stretch transition-colors duration-300 ${is_draft ? 'bg-amber-400/70' : 'group-hover:bg-primary bg-transparent'}`}
      />

      {/* Date column */}
      <div className="relative z-10 flex w-12 flex-shrink-0 flex-col justify-center py-5 pl-2 text-right sm:w-20 sm:pl-4">
        <div className="text-foreground text-[1.9rem] leading-none font-black tracking-tighter sm:text-[3rem]">{dayNum}</div>
        <div className="text-muted-foreground mt-1 text-[9px] font-bold tracking-widest uppercase">{monthAbbr}</div>
        <div className="text-muted-foreground/50 text-[8px] tracking-wide uppercase">{dayOfWeek?.slice(0, 3)}</div>
      </div>

      {/* Hairline separator */}
      <div className="bg-border/40 group-hover:bg-primary/30 relative z-10 mx-3 w-px flex-shrink-0 self-stretch transition-colors duration-300 sm:mx-5" />

      {/* Content */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center py-5 pr-3 sm:pr-4">
        {/* Status · time */}
        <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {is_draft ? (
            <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">Draft</span>
          ) : (
            <span className={`text-[10px] font-bold tracking-widest uppercase ${statusColor}`}>{statusLabel}</span>
          )}
          <span className="text-border/60 text-[10px]">·</span>
          <span className="text-xs">
            <span className="text-foreground/80 font-semibold">From</span> <span className="text-foreground/80 font-medium">{startTime}</span>
            {endTime && (
              <span className="text-muted-foreground">
                {' '}
                · <span className="font-medium">To</span> {endTime}, {endDate}
              </span>
            )}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-foreground group-hover:text-primary/90 mb-2.5 text-base leading-snug font-semibold tracking-tight break-words transition-colors duration-300 sm:text-[1.05rem]">
          {title}
        </h3>

        {/* Location + attendees */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {hasLocation ? (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="max-w-[140px] truncate sm:max-w-none">{location}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <TriangleAlert size={11} className="flex-shrink-0" />
              Location missing
            </span>
          )}
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <UsersRound size={11} className="flex-shrink-0" />
            {attendeeText}
          </span>
        </div>

        {/* Draft indicator */}
        {is_draft && (
          <div className="mt-2 flex items-center gap-1.5">
            <EyeOff size={11} className="flex-shrink-0 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-500">Only visible to you</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventContent;
