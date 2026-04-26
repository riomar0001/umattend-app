'use client';

import { useState } from 'react';
import { MapPin, Clock, Users, Edit, ChevronLeft, Shield, Trash2, Eye, EyeOff, Loader2, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Event } from '@/types/events';
import { deleteEventByEventIdMutation, patchEventByEventIdPostMutation, patchEventByEventIdDraftMutation } from '@/api/client/@tanstack/react-query.gen';

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

export default function HeroSection({ event, setIsSheetOpen, refetch }: { event: Event; setIsSheetOpen: (open: boolean) => void; refetch: () => void }) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

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

  const { mutate: deleteEvent, isPending: isDeleting } = useMutation({
    ...deleteEventByEventIdMutation(),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      router.push('/events');
    }
  });

  const { mutate: postEvent, isPending: isPosting } = useMutation({
    ...patchEventByEventIdPostMutation(),
    onSuccess: () => refetch()
  });

  const { mutate: draftEvent, isPending: isDrafting } = useMutation({
    ...patchEventByEventIdDraftMutation(),
    onSuccess: () => refetch()
  });

  const handleDelete = () => {
    deleteEvent({ path: { event_id: event.id } });
  };

  const nameMatches = confirmName.trim() === event.name.trim();

  return (
    <section className="border-border relative border-b backdrop-blur-[2px]">
      <div className="container mx-auto max-w-4xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
        {/* Top bar: back nav + action buttons */}
        <div className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/events/${event.id}`)}
              className="group text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Event
            </button>
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
              <Shield className="h-3 w-3" />
              Manage mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Primary state action — same shape across draft/posted, color tells the state */}
            {event.is_draft ? (
              <Button
                size="sm"
                onClick={() => postEvent({ path: { event_id: event.id } })}
                disabled={isPosting}
                className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-900 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isPosting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Post event</span>
                <span className="sm:hidden">Post</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => draftEvent({ path: { event_id: event.id } })}
                disabled={isDrafting}
                className="h-8 gap-1.5 border-amber-300 bg-amber-50/60 px-3 text-xs font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-200"
              >
                {isDrafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span>Unpost</span>
              </Button>
            )}

            {/* Secondary toolbar — Edit + overflow grouped in a single segmented surface */}
            <div className="border-border/60 bg-background/40 flex items-center rounded-md border shadow-sm">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsSheetOpen(true)}
                className="hover:bg-muted/70 h-8 gap-1.5 rounded-l-[5px] rounded-r-none border-0 px-2.5 text-xs font-medium"
              >
                <Edit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>

              <div className="bg-border/60 h-4 w-px" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/70 h-8 w-8 rounded-l-none rounded-r-[5px] border-0 p-0"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setIsSheetOpen(true)} className="sm:hidden">
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />
                  <DropdownMenuItem
                    onClick={() => {
                      setConfirmName('');
                      setDeleteDialogOpen(true);
                    }}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:text-red-400 dark:focus:bg-red-400/10 dark:focus:text-red-400"
                  >
                    <Trash2 className="text-destructive mr-2 h-3.5 w-3.5" />
                    Delete event
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Date block + title row */}
        <div className="flex items-start gap-4 sm:gap-7">
          {/* Date block */}
          <div className="flex-shrink-0 text-right">
            <div className="text-foreground text-5xl leading-none font-black tracking-tighter sm:text-6xl">{dayNum}</div>
            <div className="text-muted-foreground mt-1 text-[9px] font-bold tracking-widest uppercase">{monthAbbr}</div>
            <div className="text-muted-foreground/50 text-[8px] tracking-wide uppercase">{dayOfWeek.slice(0, 3)}</div>
          </div>

          {/* Hairline */}
          <div className="bg-border/50 w-px self-stretch" />

          {/* Badge + title */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {event.is_draft ? (
                <Badge
                  variant="outline"
                  className="w-fit border border-amber-300 bg-amber-50 text-[10px] font-bold tracking-widest text-amber-700 uppercase dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                >
                  Draft
                </Badge>
              ) : (
                <Badge variant="outline" className={`w-fit border text-[10px] font-bold tracking-widest uppercase ${statusClassName}`}>
                  {event.status === 'ongoing' && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />}
                  {statusLabel}
                </Badge>
              )}
              {event.is_draft && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  <EyeOff className="h-3 w-3" />
                  Only visible to you
                </span>
              )}
            </div>
            <h1 className="text-foreground text-2xl leading-tight font-black tracking-tighter break-words sm:text-3xl lg:text-4xl">{event.name}</h1>
          </div>
        </div>

        {/* Meta details card */}
        <div className="border-border/60 bg-background/60 divide-border/40 mt-6 divide-y overflow-hidden rounded-xl border backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Clock className="text-primary h-4 w-4 flex-shrink-0" />
            <span className="text-muted-foreground text-xs font-medium">Time</span>
            <span className="text-foreground/80 ml-auto text-sm">
              {event.startTime}
              {event.endTime ? ` – ${event.endTime}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <MapPin className="text-primary h-4 w-4 flex-shrink-0" />
            <span className="text-muted-foreground text-xs font-medium">Location</span>
            <span className="text-foreground/80 ml-auto line-clamp-1 max-w-[60%] text-right text-sm">{event.location || 'TBD'}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Users className="text-primary h-4 w-4 flex-shrink-0" />
            <span className="text-muted-foreground text-xs font-medium">Attendees</span>
            <span className="text-foreground/80 ml-auto text-sm">{attendeeText}</span>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Event</DialogTitle>
            <DialogDescription>
              This action cannot be undone. To confirm, type the event name below:
              <span className="text-foreground mt-1 block font-semibold">{event.name}</span>
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Type event name to confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="mt-1" />
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!nameMatches || isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
