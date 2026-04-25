'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { MapPin, FileText, Users, Building2, CalendarIcon, ChevronsLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Event } from '@/types/events';
import { putEventByEventIdMutation } from '@/api/client/@tanstack/react-query.gen';
import { DepartmentAndPrograms } from '@/lib/department-and-program';
import { generateTimeOptions, parseTimeToMinutes, formatDateShort } from '@/lib/utils';

interface UpdateEventSheetProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function UpdateEventSheet({ event, open, onOpenChange, onUpdate }: UpdateEventSheetProps) {
  const [formData, setFormData] = useState(() => ({
    ...event,
    startTime: event.startTime || '12:00 PM', // Default to 12:00 PM if no start time
    endTime: event.endTime || '11:59 PM' // Default to 11:59 PM if no end time
  }));
  const [isUnlimitedCapacity, setIsUnlimitedCapacity] = useState(event.capacity === 'unlimited');
  const [validationErrors, setValidationErrors] = useState<{ endDate?: string; endTime?: string }>({});

  const timeOptions = generateTimeOptions();
  const departments = Object.keys(DepartmentAndPrograms);

  useEffect(() => {
    setFormData({
      ...event,
      startTime: event.startTime || '12:00 PM', // Default to 12:00 PM if no start time
      endTime: event.endTime || '11:59 PM' // Default to 11:59 PM if no end time
    });
    setIsUnlimitedCapacity(event.capacity === 'unlimited');
  }, [event]);

  // Validate dates and times
  useEffect(() => {
    const errors: { endDate?: string; endTime?: string } = {};

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    // Normalize to midnight for date comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Check if end date is before start date
    if (end < start) {
      errors.endDate = 'End date cannot be before start date';
    }

    // Check time only if dates are the same
    if (end.getTime() === start.getTime()) {
      const startMinutes = parseTimeToMinutes(formData.startTime);
      const endMinutes = parseTimeToMinutes(formData.endTime);

      if (endMinutes <= startMinutes) {
        errors.endTime = 'End time must be after start time';
      }
    }

    setValidationErrors(errors);
  }, [formData.startDate, formData.endDate, formData.startTime, formData.endTime]);

  // Mutation for updating event
  const updateEventMutation = useMutation({
    mutationFn: putEventByEventIdMutation().mutationFn,
    onSuccess: () => {
      toast.success('Event updated successfully');
      onUpdate();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update event');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for validation errors
    if (validationErrors.endDate || validationErrors.endTime) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    // Convert time strings back to ISO format
    const parseTime = (dateStr: Date, timeStr: string): string => {
      const date = new Date(dateStr);
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);

      let hour = hours;
      if (period === 'PM' && hours !== 12) hour += 12;
      if (period === 'AM' && hours === 12) hour = 0;

      date.setHours(hour, minutes, 0, 0);
      return date.toISOString();
    };

    const startTime = parseTime(formData.startDate, formData.startTime);
    const endTime = parseTime(formData.endDate, formData.endTime);

    updateEventMutation.mutate({
      path: {
        event_id: event.id
      },
      body: {
        title: formData.name,
        description: formData.description,
        department: formData.department,
        location: formData.location,
        capacity: isUnlimitedCapacity ? undefined : Number(formData.capacity),
        all_day: false,
        start_time: startTime,
        end_time: endTime,
        check_out_required: formData.checkOutRequired,
        is_done: formData.status === 'completed'
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" hideClose={true}>
        <SheetHeader className="border-border border-b px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-4 py-6 sm:px-6">
          {/* Header Title and Description */}
          <div className="space-y-2">
            <SheetTitle className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">Update Event</SheetTitle>
            <SheetDescription className="text-sm sm:text-base">Make changes to your event details. Click save when you&apos;re done.</SheetDescription>
          </div>

          {/* Event Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">
              Event Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-11 shadow-sm"
              placeholder="Enter event name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="text-muted-foreground h-4 w-4" />
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-28 resize-none shadow-sm"
              placeholder="Add event description..."
            />
          </div>

          {/* Date and Time */}
          <div className="bg-background/50 ring-border space-y-4 rounded-lg p-4 shadow-sm ring-1 backdrop-blur-sm sm:p-5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="text-primary/70 h-5 w-5" />
              <Label className="text-base font-semibold">Date & Time</Label>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="bg-background h-11 w-full justify-start text-left font-medium shadow-sm">
                        {formatDateShort(formData.startDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.startDate}
                        onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">Start Time</Label>
                  <Select value={formData.startTime} onValueChange={(value) => setFormData({ ...formData, startTime: value })}>
                    <SelectTrigger className="h-11 shadow-sm">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`bg-background h-11 w-full justify-start text-left font-medium shadow-sm ${
                          validationErrors.endDate ? 'border-red-500' : ''
                        }`}
                      >
                        {formatDateShort(formData.endDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.endDate}
                        onSelect={(date) => date && setFormData({ ...formData, endDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {validationErrors.endDate && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.endDate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">End Time</Label>
                  <Select value={formData.endTime} onValueChange={(value) => setFormData({ ...formData, endTime: value })}>
                    <SelectTrigger className={`h-11 shadow-sm ${validationErrors.endTime ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.endTime && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.endTime}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="text-primary/70 h-4 w-4" />
              Location
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="h-11 shadow-sm"
              placeholder="Enter location or virtual link"
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="department" className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="text-primary/70 h-4 w-4" />
              Department
            </Label>
            <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
              <SelectTrigger className="h-11 w-full shadow-sm">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacity */}
          <div className="bg-background/50 ring-border space-y-3 rounded-lg p-4 shadow-sm ring-1 backdrop-blur-sm sm:p-5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Users className="text-primary/70 h-5 w-5" />
                Capacity
              </Label>
              <button
                type="button"
                onClick={() => setIsUnlimitedCapacity(!isUnlimitedCapacity)}
                className="text-sm font-medium transition-colors hover:underline"
              >
                {isUnlimitedCapacity ? 'Set Limit' : 'Make Unlimited'}
              </button>
            </div>
            {!isUnlimitedCapacity && (
              <Input
                type="number"
                value={formData.capacity === 'unlimited' ? '' : formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number.parseInt(e.target.value) || 0 })}
                className="h-11 shadow-sm"
                placeholder="Enter maximum capacity"
                min="1"
              />
            )}
          </div>

          {/* Check Out Required */}
          <div className="bg-background/50 ring-border flex items-center justify-between rounded-lg p-4 shadow-sm ring-1 backdrop-blur-sm sm:p-5">
            <Label htmlFor="checkout" className="text-base font-semibold">
              Check Out Required
            </Label>
            <Switch id="checkout" checked={formData.checkOutRequired} onCheckedChange={(checked) => setFormData({ ...formData, checkOutRequired: checked })} />
          </div>

          {/* Action Buttons */}
          <div className="border-border flex gap-3 border-t pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 flex-1 shadow-sm transition-shadow hover:shadow">
              Cancel
            </Button>
            <Button type="submit" className="h-11 flex-1 font-semibold shadow-sm transition-shadow hover:shadow">
              Save Changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
