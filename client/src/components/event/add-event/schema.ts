import { z } from 'zod';
import { parseTimeToMinutes } from '@/lib/utils';

export const createEventSchema = z
  .object({
    title: z.string().min(1, 'Event title is required').max(140, 'Title is too long'),
    description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description is too long'),
    department: z.string().min(1, 'Department is required'),
    location: z.string().min(3, 'Location is required').max(140, 'Location is too long'),
    startDate: z.date(),
    startTime: z.string(),
    endDate: z.date(),
    endTime: z.string(),
    isUnlimitedCapacity: z.boolean().default(true),
    capacity: z.number().int().positive().optional().nullable(),
    check_out_required: z.boolean().default(false),
    all_day: z.boolean().default(false)
  })
  .refine((data) => data.isUnlimitedCapacity || data.capacity != null, {
    message: 'Capacity is required when not unlimited',
    path: ['capacity']
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(data.startDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate >= today;
    },
    { message: 'Start date cannot be in the past', path: ['startDate'] }
  )
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      ctx.addIssue({ code: 'custom', message: 'End date cannot be before start date', path: ['endDate'] });
      return;
    }

    if (end.getTime() === start.getTime()) {
      const startMinutes = parseTimeToMinutes(data.startTime);
      const endMinutes = parseTimeToMinutes(data.endTime);
      if (endMinutes <= startMinutes) {
        ctx.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['endTime'] });
      }
    }
  });

export type CreateEventFormValues = z.infer<typeof createEventSchema>;
