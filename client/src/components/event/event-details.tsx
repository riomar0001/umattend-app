import React from 'react';
import { MapPin, UsersRound, AlertTriangle, ArrowUpRight, ChevronsLeft, Settings, Clock, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { EventCardData, EventStatus } from '@/types/events';
import { Button } from '../ui/button';
import { SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';

interface EventDetailsProps {
  event: EventCardData & { apiId?: string; eventStatus?: EventStatus };
  onClose?: () => void;
}

const EventDetails = ({ event, onClose }: EventDetailsProps) => {
  const router = useRouter();

  const { id, apiId, title, description, dayOfWeek, date, startTime, endTime, hasLocation = false, location, checkin_count, checkout_count, is_draft } = event;

  const eventStatus = event.eventStatus || 'upcoming';
  const eventId = apiId || id;

  const statusConfig = {
    upcoming: { label: 'Upcoming', color: 'text-blue-500' },
    ongoing: { label: 'Live now', color: 'text-green-600' },
    completed: { label: 'Completed', color: 'text-neutral-400' }
  };
  const { label: statusLabel, color: statusColor } = statusConfig[eventStatus];

  const attendeeText =
    eventStatus === 'upcoming' ? 'No attendees yet' : eventStatus === 'ongoing' ? `${checkin_count} attending` : `${checkout_count} attended`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader className="border-border border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <div className="flex items-center gap-1">
            {event.can_edit && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/events/${eventId}/manage`)}>
                <Settings className="h-3.5 w-3.5" />
                Manage
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/events/${eventId}`)}>
              View event
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Draft banner */}
        {is_draft && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/30">
            <EyeOff className="h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Draft — only visible to you</p>
          </div>
        )}

        {/* Status label */}
        {is_draft ? (
          <p className="mb-3 text-[10px] font-bold tracking-widest text-amber-500 uppercase">Draft</p>
        ) : (
          <p className={`mb-3 text-[10px] font-bold tracking-widest uppercase ${statusColor}`}>{statusLabel}</p>
        )}

        {/* Title */}
        <SheetTitle className="mb-8 text-2xl leading-tight font-black tracking-tighter break-words sm:text-[1.85rem]">{title}</SheetTitle>

        {/* Metadata */}
        <div className="border-border space-y-4 border-t pt-6">
          <div className="flex items-start gap-3">
            <Clock className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-foreground text-sm font-medium">
                {dayOfWeek}, {date}
              </p>
              <p className="text-muted-foreground text-sm">
                {startTime}
                {endTime ? ` – ${endTime}` : ''}
              </p>
            </div>
          </div>

          {hasLocation ? (
            <div className="flex items-start gap-3">
              <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="text-foreground text-sm break-words">{location}</p>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="text-sm text-amber-600">Location not set</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <UsersRound className="text-muted-foreground h-4 w-4 flex-shrink-0" />
            <p className="text-muted-foreground text-sm">{attendeeText}</p>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="border-border mt-8 border-t pt-6">
            <SheetDescription className="text-foreground/80 text-sm leading-relaxed break-words whitespace-pre-wrap sm:text-[0.9375rem]">
              {description}
            </SheetDescription>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetails;
