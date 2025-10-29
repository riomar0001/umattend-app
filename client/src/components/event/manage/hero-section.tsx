import { Calendar, MapPin, Users, Clock, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/events';
import { formatDate } from '@/lib/utils';

export default function HeroSeciont({ event, setIsSheetOpen }: { event: Event; setIsSheetOpen: (open: boolean) => void }) {
  return (
    <section className="border-border bg-muted/30 border-b">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            {/* Event Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-foreground text-3xl leading-none font-bold tracking-tight text-balance md:text-4xl lg:text-5xl">{event.name}</h1>
                    </div>
                  </div>
                  <Button onClick={() => setIsSheetOpen(true)} className="shrink-0 cursor-pointer gap-2 rounded-lg font-medium">
                    <Edit className="h-4 w-4" />
                    Edit Event
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(event.startDate)}</span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    {' '}
                    {event.startTime} - {event.endTime}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {event.status === 'upcoming' && 'No Attendees'}
                    {event.status === 'ongoing' && `${event.checkInCount} Attending`}
                    {event.status === 'completed' && `${event.checkOutCount} Attended`}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-foreground font-medium">{event.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
