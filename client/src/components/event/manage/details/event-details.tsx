import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Event } from '@/types/events';
import { formatDate } from '@/lib/utils';

export default function EventDetails({ event }: { event: Event }) {
  const capacityPercentage = event.capacity === 'unlimited' ? 0 : Math.round(((event.checkin_count ?? 0) / event.capacity) * 100);

  return (
    <div className="mb-8 space-y-6">
      {/* Key Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Date Card */}
        <Card className="border-border bg-card hover:border-primary/50 p-5 transition-colors">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <Calendar className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Date</p>
              <p className="text-foreground text-sm leading-tight font-semibold">{formatDate(event?.startDate)}</p>
            </div>
          </div>
        </Card>

        {/* Time Card */}
        <Card className="border-border bg-card hover:border-primary/50 p-5 transition-colors">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <Clock className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Time</p>
              <p className="text-foreground text-sm leading-tight font-semibold">
                {event?.startTime} - {event?.endTime}
              </p>
            </div>
          </div>
        </Card>

        {/* Location Card */}
        <Card className="border-border bg-card hover:border-primary/50 p-5 transition-colors">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <MapPin className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Location</p>
              <p className="text-foreground truncate text-sm leading-tight font-semibold">{event?.location}</p>
            </div>
          </div>
        </Card>

        {/* Attendance Card */}
        <Card className="border-border bg-card hover:border-primary/50 p-5 transition-colors">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <Users className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Attendance</p>
              <p className="text-foreground text-sm leading-tight font-semibold">
                {event?.attendees}
                {event?.capacity !== 'unlimited' && ` / ${event?.capacity}`}
              </p>
              {event?.capacity !== 'unlimited' && (
                <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(capacityPercentage, 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Info */}
      <Card className="border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Status:</span>
            <Badge
              variant="outline"
              className={`rounded-md text-xs font-medium ${
                event.status === 'upcoming'
                  ? 'border-blue-200 bg-blue-100 text-blue-700'
                  : event.status === 'ongoing'
                    ? 'border-green-200 bg-green-100 text-green-700'
                    : event.status === 'completed'
                      ? 'border-gray-200 bg-gray-100 text-gray-700'
                      : 'border-red-200 bg-red-100 text-red-700'
              }`}
            >
              {event.status === 'ongoing' && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-600" />}
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Department:</span>
            <Badge variant="outline" className="rounded-md text-xs font-medium">
              {event?.department}
            </Badge>
          </div>
          {event?.checkOutRequired && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Requirements:</span>
              <Badge variant="outline" className="rounded-md text-xs font-medium">
                Check-out Required
              </Badge>
            </div>
          )}
          {event?.capacity !== 'unlimited' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Capacity Status:</span>
              <Badge
                variant={capacityPercentage >= 90 ? 'destructive' : capacityPercentage >= 70 ? 'secondary' : 'outline'}
                className="rounded-md text-xs font-medium"
              >
                {capacityPercentage}% Full
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* About Event Section */}
      <Card className="border-border bg-card p-6">
        <div className="space-y-4">
          <h2 className="text-foreground text-2xl font-bold">About Event</h2>
          <div className="prose prose-sm text-foreground/90 max-w-none leading-relaxed break-words whitespace-pre-wrap">
            <p>{event?.description}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
