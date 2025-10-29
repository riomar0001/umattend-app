import React from 'react';
import { MapPin, UsersRound, AlertTriangle, ArrowUpRight, ChevronsLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { EventCardData, EventStatus } from '@/types/events';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';

interface EventDetailsProps {
  event: EventCardData & { apiId?: string; eventStatus?: EventStatus };
  onClose?: () => void;
}

const EventDetails = ({ event, onClose }: EventDetailsProps) => {
  const router = useRouter();

  const { id, apiId, title, description, dayOfWeek, date, startTime, endTime, hasLocation = false, location, checkin_count, checkout_count } = event;

  const eventStatus = event.eventStatus || 'upcoming';

  // Use apiId (UUID) for routing if available, otherwise fall back to numeric id
  const eventId = apiId || id;

  return (
    <div className="space-y-8">
      <SheetHeader className="border-border border-b">
        <div className="flex items-center justify-between space-x-3">
          <Button className="hover:text-primary !h-8 cursor-pointer !py-1 hover:bg-stone-800" onClick={onClose}>
            <ChevronsLeft />
          </Button>
          <div className="flex items-center gap-2">
            {event.can_edit && (
              <Button className="hover:text-primary !h-8 cursor-pointer !py-1 hover:bg-stone-800" onClick={() => router.push(`/events/${eventId}/manage`)}>
                <Settings className="h-4 w-4" />
                Manage
              </Button>
            )}
            <Button className="hover:text-primary !h-8 cursor-pointer !py-1 hover:bg-stone-800" onClick={() => router.push(`/events/${eventId}`)}>
              Event Page
              <ArrowUpRight />
            </Button>
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-8 px-6 py-4">
        {/* Title and Guest Count */}
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
          <SheetTitle className="text-3xl leading-tight font-bold tracking-tight">{title}</SheetTitle>
          <div className="flex items-center gap-2">
            <UsersRound className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm">
              {' '}
              <span>
                {eventStatus === 'upcoming' && 'No Attendees'}
                {eventStatus === 'ongoing' && `${checkin_count} Attending`}
                {eventStatus === 'completed' && `${checkout_count} Attended`}
              </span>
            </span>
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-5">
          {/* Date and Time */}
          <div className="flex items-center gap-4">
            <div className="bg-background ring-border flex h-12 w-12 flex-shrink-0 flex-col overflow-hidden rounded-lg shadow-sm ring-1">
              <div className="bg-foreground flex items-center justify-center py-0.5">
                <span className="text-background text-[9px] font-bold tracking-wide uppercase">{date?.split(',')[0]?.slice(0, 3) || 'APR'}</span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <span className="text-foreground text-base leading-none font-medium">{date?.split(' ')[1] || '5'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-foreground text-base font-semibold">
                {dayOfWeek}, {date}
              </div>
              <div className="text-muted-foreground text-sm">
                {startTime} - {endTime}
              </div>
            </div>
          </div>

          {/* Location */}
          {hasLocation ? (
            <div className="flex items-center gap-4">
              <div className="bg-background ring-border flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg shadow-sm ring-1">
                <MapPin className="text-foreground h-5 w-5" strokeWidth={2} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-foreground text-base font-medium">{location?.split(',')[0] || location}</div>
                {/* <div className="text-muted-foreground text-sm">{location?.includes(',') ? location.split(',').slice(1).join(',').trim() : ''}</div> */}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 ring-primary/20 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ring-1">
                <AlertTriangle className="text-primary h-5 w-5" strokeWidth={2} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-primary text-base font-semibold">Location Missing</div>
                <div className="text-muted-foreground text-sm">No location provided</div>
              </div>
            </div>
          )}
        </div>

        {description && (
          <div className="border-border border-t pt-6">
            <SheetDescription className="text-foreground text-base leading-relaxed break-words whitespace-pre-wrap">{description}</SheetDescription>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetails;
