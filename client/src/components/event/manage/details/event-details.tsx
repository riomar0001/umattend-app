import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Event } from '@/types/events';
import { formatDate } from '@/lib/utils';

export default function EventDetails({ event }: { event: Event }) {
  const attendeeCount = event.checkOutRequired ? event.checkOutCount : event.checkInCount;
  const capacityPercentage = event.capacity === 'unlimited' ? 0 : Math.round((event.checkInCount / (event.capacity as number)) * 100);

  const statusBadgeClass =
    event.status === 'upcoming'
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
      : event.status === 'ongoing'
        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
        : 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400';

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats grid — 2 cols on mobile, 4 on lg */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card className="border-border bg-card/80 hover:border-primary/40 p-3 backdrop-blur-sm transition-colors sm:p-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-primary/10 rounded-lg p-2 sm:p-2.5">
              <Calendar className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-[10px] font-medium sm:text-xs">Date</p>
              <div className="text-xs leading-tight sm:text-sm">
                <p className="text-foreground font-semibold">From {formatDate(event.startDate)}</p>
                <p className="text-muted-foreground">To {formatDate(event.endDate)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/80 hover:border-primary/40 p-3 backdrop-blur-sm transition-colors sm:p-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-primary/10 rounded-lg p-2 sm:p-2.5">
              <Clock className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-[10px] font-medium sm:text-xs">Time</p>
              <div className="text-xs leading-tight sm:text-sm">
                <p className="text-foreground font-semibold">From {event.startTime}</p>
                {event.endTime && <p className="text-muted-foreground">To {event.endTime}</p>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/80 hover:border-primary/40 p-3 backdrop-blur-sm transition-colors sm:p-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-primary/10 rounded-lg p-2 sm:p-2.5">
              <MapPin className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-[10px] font-medium sm:text-xs">Location</p>
              <p className="text-foreground line-clamp-2 text-xs leading-tight font-semibold sm:text-sm">{event.location || 'TBD'}</p>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card/80 hover:border-primary/40 p-3 backdrop-blur-sm transition-colors sm:p-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-primary/10 rounded-lg p-2 sm:p-2.5">
              <Users className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-[10px] font-medium sm:text-xs">Attendance</p>
              <p className="text-foreground text-xs leading-tight font-semibold sm:text-sm">
                {attendeeCount}
                {event.capacity !== 'unlimited' && ` / ${event.capacity}`}
              </p>
              {event.capacity !== 'unlimited' && (
                <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(capacityPercentage, 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Meta badges */}
      <Card className="border-border bg-card/80 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-muted-foreground text-[10px] sm:text-xs">Status</span>
            <Badge variant="outline" className={`text-[9px] font-bold tracking-wide uppercase sm:text-[10px] ${statusBadgeClass}`}>
              {event.status === 'ongoing' && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />}
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>

          {event.department && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-muted-foreground text-[10px] sm:text-xs">Department</span>
              <Badge variant="outline" className="text-[9px] font-medium sm:text-[10px]">
                {event.department}
              </Badge>
            </div>
          )}

          {event.checkOutRequired && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-muted-foreground text-[10px] sm:text-xs">Requirement</span>
              <Badge variant="outline" className="text-[9px] font-medium sm:text-[10px]">
                Check-out required
              </Badge>
            </div>
          )}

          {event.capacity !== 'unlimited' && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-muted-foreground text-[10px] sm:text-xs">Capacity</span>
              <Badge
                variant="outline"
                className={`text-[9px] font-medium sm:text-[10px] ${
                  capacityPercentage >= 90
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                    : capacityPercentage >= 70
                      ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300'
                      : ''
                }`}
              >
                {capacityPercentage}% full
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* About */}
      <Card className="border-border bg-card/80 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
        <h2 className="text-foreground mb-3 text-sm font-bold tracking-tight sm:text-base">About this event</h2>
        {event.description ? (
          <p className="text-foreground/80 text-sm leading-relaxed break-words whitespace-pre-wrap">{event.description}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No description provided.</p>
        )}
      </Card>
    </div>
  );
}
