'use client';

import { format } from 'date-fns';
import { CalendarDays, MapPin, Building2, Users, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateEventFormValues } from './schema';

interface PreviewSidebarProps {
  values: Partial<CreateEventFormValues>;
  isDraft?: boolean;
}

export function PreviewSidebar({ values, isDraft = false }: PreviewSidebarProps) {
  const { title, startDate, startTime, endDate, endTime, location, department, isUnlimitedCapacity, capacity } = values;

  const hasTitle = !!title?.trim();
  const hasDate = !!startDate;

  const formatDate = (date?: Date) => {
    if (!date) return null;
    try {
      return format(date, 'EEE, MMM d, yyyy');
    } catch {
      return null;
    }
  };

  return (
    <div className="sticky top-[100px] space-y-4">
      <div className="bg-card border-border overflow-hidden rounded-2xl border backdrop-blur-md">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Eye className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Preview</span>
          </div>
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                isDraft
                  ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                  : 'border-primary/30 bg-primary/10 text-primary'
              }
            >
              {isDraft ? 'Draft' : 'New Event'}
            </Badge>
          </div>

          {/* Title */}
          <div className="min-h-[3rem]">
            {hasTitle ? (
              <h2 className="text-foreground line-clamp-3 text-xl leading-tight font-bold">{title}</h2>
            ) : (
              <div className="space-y-2">
                <div className="bg-border/60 h-5 w-3/4 animate-pulse rounded-md" />
                <div className="bg-border/60 h-5 w-1/2 animate-pulse rounded-md" />
              </div>
            )}
          </div>

          {/* Date/time */}
          <div className="space-y-1.5">
            {hasDate ? (
              <>
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="text-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-foreground text-sm">
                    <p className="font-semibold">
                      <span className="text-primary font-bold">From</span> {formatDate(startDate)}
                      {startTime && ` at ${startTime}`}
                    </p>
                    {(endDate || endTime) && (
                      <p className="text-muted-foreground text-xs">
                        <span className="font-medium">To</span>{' '}
                        {endDate && startDate && endDate.toDateString() !== startDate.toDateString()
                          ? `${formatDate(endDate)}${endTime ? ` at ${endTime}` : ''}`
                          : endTime
                            ? `${endTime}`
                            : formatDate(endDate!)}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <CalendarDays className="text-border h-4 w-4 shrink-0" />
                <div className="bg-border/60 h-4 w-32 animate-pulse rounded-md" />
              </div>
            )}
          </div>

          {/* Location */}
          {location?.trim() ? (
            <div className="flex items-start gap-2.5">
              <MapPin className="text-foreground mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-foreground line-clamp-2 text-sm">{location}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <MapPin className="text-border h-4 w-4 shrink-0" />
              <div className="bg-border/60 h-4 w-24 animate-pulse rounded-md" />
            </div>
          )}

          {/* Department */}
          {department?.trim() ? (
            <div className="flex items-start gap-2.5">
              <Building2 className="text-foreground mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-foreground line-clamp-2 text-xs">{department}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Building2 className="text-border h-4 w-4 shrink-0" />
              <div className="bg-border/60 h-4 w-28 animate-pulse rounded-md" />
            </div>
          )}

          {/* Capacity */}
          <div className="flex items-center gap-2.5">
            <Users className="text-foreground h-4 w-4 shrink-0" />
            <p className="text-muted-foreground text-xs">
              {isUnlimitedCapacity ? 'Unlimited capacity' : capacity ? `${capacity} attendees max` : 'Capacity not set'}
            </p>
          </div>
        </div>
      </div>

      {/* Completion checklist */}
      <div className="bg-card border-border rounded-2xl border p-4 backdrop-blur-md">
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">Checklist</p>
        <ul className="space-y-2">
          {[
            { label: 'Event title', done: !!title?.trim() },
            { label: 'Date & time', done: !!startDate && !!startTime },
            { label: 'Location', done: !!location?.trim() },
            { label: 'Description', done: (values.description?.length ?? 0) >= 10 },
            { label: 'Department', done: !!department?.trim() }
          ].map(({ label, done }) => (
            <li key={label} className="flex items-center gap-2">
              <div
                className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${done ? 'border-primary bg-primary' : 'border-border bg-transparent'}`}
              >
                {done && (
                  <svg viewBox="0 0 10 10" className="h-full w-full p-0.5">
                    <path
                      d="M2 5l2.5 2.5 3.5-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary-foreground"
                    />
                  </svg>
                )}
              </div>
              <span className={`text-xs ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
