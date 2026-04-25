'use client';

import { format } from 'date-fns';
import { MapPin, FileText, Users, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { postEventMutation } from '@/api/client/@tanstack/react-query.gen';
import { DepartmentAndPrograms } from '@/lib/department-and-program';
import { generateTimeOptions, getDefaultStartTime, addOneHour, parseTimeToMinutes } from '@/lib/utils';

// Form validation schema

const createEventSchema = z
  .object({
    title: z.string().min(1, 'Event title is required').max(140, 'Title is too long'),
    description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description is too long'),
    department: z.string().min(10, 'Department is required'),
    location: z.string().min(10, 'Location is required').max(140, 'Location is too long'),
    startDate: z.date(),
    startTime: z.string(),
    endDate: z.date(),
    endTime: z.string(),
    isUnlimitedCapacity: z.boolean().default(true),
    capacity: z.number().int().positive().optional().nullable(),
    check_out_required: z.boolean().default(false),
    all_day: z.boolean().default(false)
  })
  .refine(
    (data) => {
      return data.isUnlimitedCapacity || data.capacity != null;
    },
    {
      message: 'Capacity is required when not unlimited',
      path: ['capacity']
    }
  )
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(data.startDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate >= today;
    },
    {
      message: 'Start date cannot be in the past',
      path: ['startDate']
    }
  )
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    // Normalize to midnight for date comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if end date is before start date
    if (end < start) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date cannot be before start date',
        path: ['endDate']
      });
      return;
    }

    // Check time only if dates are the same
    if (end.getTime() === start.getTime()) {
      const startMinutes = parseTimeToMinutes(data.startTime);
      const endMinutes = parseTimeToMinutes(data.endTime);

      if (endMinutes <= startMinutes) {
        ctx.addIssue({
          code: 'custom',
          message: 'End time must be after start time',
          path: ['endTime']
        });
      }
    }
  });

type CreateEventFormValues = z.infer<typeof createEventSchema>;

export default function CreateEventPage() {
  const router = useRouter();
  const timeOptions = generateTimeOptions();
  const departments = Object.keys(DepartmentAndPrograms);
  const defaultStartTime = getDefaultStartTime();
  const defaultEndTime = addOneHour(defaultStartTime);

  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema) as never,
    defaultValues: {
      title: '',
      description: '',
      department: '',
      location: '',
      startDate: new Date(),
      startTime: defaultStartTime,
      endDate: new Date(),
      endTime: defaultEndTime,
      isUnlimitedCapacity: true,
      capacity: null,
      check_out_required: false,
      all_day: false
    }
  });

  // Create event mutation
  const createEvent = useMutation({
    ...postEventMutation(),
    onSuccess: () => {
      toast.success('Event created successfully!');
      router.push('/events');
    },
    onError: (error) => {
      const response = error.response;
      const errorData = response?.data;
      let errorMessage = 'Failed to create event';

      if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = String(errorData.message);
      } else if (error.message) {
        errorMessage = error.message;
      }
      const statusCode = response?.status;

      if (statusCode === 403) {
        toast.error('You do not have permission to create events');
      } else if (statusCode === 401) {
        toast.error('Please log in to create events');
        router.push('/');
      } else {
        const { title, description, location } = form.getValues();

        if (description.length > 500) errorMessage = 'Description is too long';
        if (description.length < 20) errorMessage = 'Description is too short';
        if (title.length > 140) errorMessage = 'Title is too long';
        if (title.length < 10) errorMessage = 'Title is too short';
        if (location.length > 140) errorMessage = 'Location is too long';
        if (location.length < 5) errorMessage = 'Location is too short';

        toast.error(errorMessage);
      }
    }
  });

  // Form submission handler
  const onSubmit = (data: CreateEventFormValues) => {
    // Helper function to parse 12-hour time format to 24-hour
    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      const [hoursStr, minutes] = time.split(':');
      let hours = parseInt(hoursStr);

      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return { hours, minutes: parseInt(minutes) };
    };

    // Combine date and time for start and end
    const startDateTime = new Date(data.startDate);
    const { hours: startHours, minutes: startMinutes } = parseTime(data.startTime);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    const endDateTime = new Date(data.endDate);
    const { hours: endHours, minutes: endMinutes } = parseTime(data.endTime);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    // Prepare payload for API - only include capacity if not unlimited
    const payload: {
      title: string;
      description: string;
      department: string;
      location: string;
      capacity?: number;
      all_day: boolean;
      start_time: string;
      end_time: string;
      check_out_required: boolean;
      is_done: boolean;
    } = {
      title: data.title,
      description: data.description,
      department: data.department,
      location: data.location,
      all_day: data.all_day,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      check_out_required: data.check_out_required,
      is_done: false
    };

    // Only add capacity field if it has a value
    if (!data.isUnlimitedCapacity && data.capacity) {
      payload.capacity = data.capacity;
    }

    createEvent.mutate({ body: payload });
  };

  return (
    <div className="bg-background relative min-h-screen">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top gradient wash */}
        <div className="from-primary/[0.15] via-primary/[0.06] dark:from-primary/[0.22] dark:via-primary/[0.08] absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/50" />

        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          {/* Diagonal ruled lines — top half, creation/canvas feel */}
          <line x1="-5%" y1="0%" x2="40%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="5 16" />
          <line x1="5%" y1="0%" x2="50%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="5 16" />
          <line x1="15%" y1="0%" x2="60%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.15)" strokeWidth="1" strokeDasharray="5 16" />

          {/* Top-right arc cluster */}
          <circle cx="100%" cy="0" r="440" stroke="oklch(0.85 0.18 95 / 0.30)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="300" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="160" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />

          {/* Accent dots — scattered across top */}
          <circle cx="88%" cy="9%" r="3.5" fill="oklch(0.85 0.18 95 / 0.85)" />
          <circle cx="93%" cy="20%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="78%" cy="5%" r="2" fill="oklch(0.85 0.18 95 / 0.60)" />
          <circle cx="22%" cy="4%" r="2.5" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="35%" cy="7%" r="1.5" fill="oklch(0.85 0.18 95 / 0.45)" />

          {/* Bottom-left neutral arcs */}
          <circle cx="0" cy="100%" r="350" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="200" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Cross marks */}
          <line x1="7%" y1="18%" x2="11%" y2="18%" stroke="oklch(0.85 0.18 95 / 0.70)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9%" y1="16%" x2="9%" y2="20%" stroke="oklch(0.85 0.18 95 / 0.70)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="55%" y1="8%" x2="58%" y2="8%" stroke="oklch(0.85 0.18 95 / 0.55)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="56.5%" y1="6.5%" x2="56.5%" y2="9.5%" stroke="oklch(0.85 0.18 95 / 0.55)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="3%" y1="58%" x2="6%" y2="58%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4.5%" y1="56.5%" x2="4.5%" y2="59.5%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />

          <line x1="50%" y1="90%" x2="53%" y2="90%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="51.5%" y1="88.5%" x2="51.5%" y2="91.5%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <main className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Header */}
            <div className="mb-12 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link href="/events">
                  <ChevronLeft className="text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer rounded-full transition-colors" />
                </Link>
                <h1 className="text-foreground text-2xl font-semibold sm:text-3xl">Create Event</h1>
              </div>
            </div>

            {/* Event Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea
                      {...field}
                      placeholder="Event name"
                      className="text-foreground placeholder:text-muted-foreground/50 bg-background min-h-20 w-full max-w-2xl resize-none border-0 !text-6xl font-bold shadow-none focus:outline-none focus-visible:ring-transparent"
                      rows={1}
                      onInput={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <div className="border-border bg-card space-y-4 rounded-2xl border p-4 sm:p-6">
              <div className="space-y-4">
                {/* Start Date/Time */}
                <div className="">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <Label className="text-foreground sm:text-md min-w-[60px] text-sm font-medium sm:min-w-[80px]">Start</Label>
                    <div className="flex flex-1 flex-col items-end justify-center">
                      <div className="flex w-full items-center justify-end gap-1">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem className="max-w-[155px] flex-1 !space-y-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="bg-background text-foreground hover:bg-muted hover:border-primary/50 h-9 w-full justify-start rounded-r-none text-left text-xs font-medium shadow-none sm:text-sm"
                                    >
                                      {field.value ? format(field.value, 'EEE, MMM d') : 'Pick date'}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                      field.onChange(date);
                                      form.trigger(['startDate', 'startTime']);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem className="w-[85px] space-y-0 sm:w-[90px]">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="hover:bg-muted hover:border-primary/50 h-9 w-full rounded-l-none text-xs font-medium sm:text-sm [&>svg]:hidden">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[300px]">
                                  {timeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                      {/* Start Date/Time Errors */}
                      <div className="w-full">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={() => (
                            <FormItem className="space-y-0">
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={() => (
                            <FormItem className="space-y-0">
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* End Date/Time */}
                <div className="">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <Label className="text-foreground sm:text-md min-w-[60px] text-sm font-medium sm:min-w-[80px]">End</Label>
                    <div className="flex flex-1 flex-col items-end justify-center">
                      <div className="flex w-full items-center justify-end gap-1">
                        <FormField
                          control={form.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem className="max-w-[155px] flex-1 space-y-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="bg-background text-foreground hover:bg-muted hover:border-primary/50 h-9 w-full justify-start rounded-r-none text-left text-xs font-medium shadow-none sm:text-sm"
                                    >
                                      {field.value ? format(field.value, 'EEE, MMM d') : 'Pick date'}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                      field.onChange(date);
                                      form.trigger(['endDate', 'endTime']);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem className="w-[85px] space-y-0 sm:w-[90px]">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="hover:bg-muted hover:border-primary/50 h-9 w-full rounded-l-none text-xs font-medium sm:text-sm [&>svg]:hidden">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[300px]">
                                  {timeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                      {/* End Date/Time Errors */}
                      <div className="w-full">
                        <FormField
                          control={form.control}
                          name="endDate"
                          render={() => (
                            <FormItem className="space-y-0">
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={() => (
                            <FormItem className="space-y-0">
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className="bg-card space-y-3 rounded-xl border-1 p-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <MapPin className="text-primary h-5 w-5" />
                    </div>
                    <FormLabel className="text-foreground text-sm font-medium">Event Location</FormLabel>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter location or virtual link"
                      className="focus-visible:border-primary focus-visible:ring-primary/20 font-normal transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="bg-card space-y-3 rounded-xl border-1 p-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <FileText className="text-primary h-5 w-5" />
                    </div>
                    <FormLabel className="text-foreground text-sm font-medium">Description</FormLabel>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add event description..."
                      className="focus-visible:border-primary focus-visible:ring-primary/20 min-h-32 font-normal transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Department */}
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem className="bg-card space-y-3 rounded-xl border-1 p-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <FileText className="text-primary h-5 w-5" />
                    </div>
                    <FormLabel className="text-foreground text-sm font-medium">Department</FormLabel>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-border hover:border-foreground/20 bg-background h-12 w-full text-left text-sm break-words !whitespace-normal transition-colors [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal">
                        <SelectValue placeholder="Select your department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      {departments.map((dept) => (
                        <SelectItem
                          key={dept}
                          value={dept}
                          className="h-auto min-h-fit cursor-pointer !items-start py-3 text-sm leading-normal break-words !whitespace-normal"
                        >
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Event Options */}
            <div className="mt-10 space-y-3">
              <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Event Options</h3>

              {/* Capacity */}
              <div className="bg-card space-y-3 rounded-xl border-1 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Users className="text-primary h-5 w-5" />
                    </div>
                    <span className="text-foreground text-sm font-medium">Capacity</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="isUnlimitedCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            className="text-foreground bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors"
                          >
                            {field.value ? 'Unlimited' : 'Limited'}
                          </Button>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {!form.watch('isUnlimitedCapacity') && (
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="Enter maximum capacity"
                            className="focus-visible:border-primary focus-visible:ring-primary/20 font-normal transition-colors"
                            min="1"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Check Out Required */}
              <FormField
                control={form.control}
                name="check_out_required"
                render={({ field }) => (
                  <FormItem className="bg-card space-y-3 rounded-xl border-1 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                          <Users className="text-primary h-5 w-5" />
                        </div>
                        <FormLabel className="text-foreground text-sm font-medium">Check Out Required</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={createEvent.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-10 w-full rounded-xl py-7 text-lg font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              {createEvent.isPending ? 'Creating Event...' : 'Create Event'}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
