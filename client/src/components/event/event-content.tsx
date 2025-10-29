import React from 'react';
import { MapPin, TriangleAlert, UsersRound } from 'lucide-react';
import type { EventCardData, EventStatus } from '@/types/events';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { getStatusColor } from '@/lib/events-utils';

interface EventContentProps {
  event: EventCardData & { eventStatus?: EventStatus };
  index: number;
  isLast?: boolean;
  onCardClick?: () => void;
  onManageClick?: (e: React.MouseEvent) => void;
}

const EventContent = ({ event, isLast = false, onCardClick }: EventContentProps) => {
  const { title, date, dayOfWeek, startTime, endTime, location, hasLocation = false, checkin_count, checkout_count } = event;
  const eventStatus = event.eventStatus || 'upcoming';

  return (
    <div className="flex gap-3 sm:gap-6">
      <div className="w-16 flex-shrink-0 pt-1 sm:w-24">
        <div className="text-foreground text-xs font-medium sm:text-sm">{date}</div>
        <div className="text-muted-foreground text-[10px] sm:text-xs">{dayOfWeek}</div>
      </div>

      <div className="relative flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-neutral-700" />
        {!isLast && <div className="mx-auto mt-1 flex-1 border-l-2 border-neutral-200" aria-hidden />}
      </div>

      <Card
        className="hover:bg-primary/10 focus-within:bg-primary/10 mb-4 flex flex-1 cursor-pointer rounded-2xl shadow-md transition-all duration-200 ease-in-out focus-within:scale-[1.025] focus-within:shadow-xl hover:scale-[1.025] hover:shadow-xl sm:mb-6"
        onClick={onCardClick}
      >
        <CardContent className="flex h-full flex-col justify-between px-8 pr-5 sm:py-3">
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="mb-1 flex items-center gap-x-3">
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-muted-foreground text-xs sm:text-sm">
                  {startTime} - {endTime}
                </span>
                <Badge variant="outline" className={`border text-xs ${getStatusColor(eventStatus)}`}>
                  {eventStatus === 'ongoing' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />}
                  {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1)}
                </Badge>
              </div>
            </div>
            <h3 className="text-foreground mb-2 text-lg leading-tight font-semibold">{title}</h3>
            <div className="mb-1 flex flex-col gap-4 sm:flex-row">
              {hasLocation ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                  <MapPin size={14} />
                  <span className="line-clamp-1">{location}</span>
                </div>
              ) : (
                <div className="text-primary flex items-center gap-2 text-xs sm:text-sm">
                  <TriangleAlert size={14} />
                  <span className="font-medium">Location Missing</span>
                </div>
              )}
              <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                <UsersRound size={14} />
                <span>
                  {eventStatus === 'upcoming' && 'No Attendees'}
                  {eventStatus === 'ongoing' && `${checkin_count} Attending`}
                  {eventStatus === 'completed' && `${checkout_count} Attended`}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventContent;
