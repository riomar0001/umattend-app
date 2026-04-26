'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Form } from '@/components/ui/form';
import { DateTimeSection } from '../../../components/event/add-event/datetime-section';
import { DetailsSection } from '../../../components/event/add-event/details-section';
import { OptionsSection } from '../../../components/event/add-event/options-section';
import { PreviewSidebar } from '../../../components/event/add-event/preview-sidebar';
import { createEventSchema, CreateEventFormValues } from '../../../components/event/add-event/schema';
import { TitleInput } from '../../../components/event/add-event/title-input';
import { postEventMutation, patchEventByEventIdDraftMutation } from '@/api/client/@tanstack/react-query.gen';
import { DepartmentAndPrograms } from '@/lib/department-and-program';
import { generateTimeOptions, getDefaultStartTime, addOneHour } from '@/lib/utils';

export default function CreateEventPage() {
  const router = useRouter();
  const timeOptions = generateTimeOptions();
  const departments = Object.keys(DepartmentAndPrograms);
  const defaultStartTime = getDefaultStartTime();
  const defaultEndTime = addOneHour(defaultStartTime);

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [savedAsDraft, setSavedAsDraft] = useState(false);

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

  const watchedValues = form.watch();

  const saveDraft = useMutation({
    ...patchEventByEventIdDraftMutation(),
    onSuccess: () => {
      setSavedAsDraft(true);
      toast.success('Event saved as draft');
      router.push('/events');
    },
    onError: () => {
      toast.error('Event created but could not be saved as draft');
      setIsSavingDraft(false);
    }
  });

  const createEvent = useMutation({
    ...postEventMutation()
  });

  const buildPayload = (data: CreateEventFormValues) => {
    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      const [hoursStr, minutes] = time.split(':');
      let hours = parseInt(hoursStr);
      if (period === 'PM' && hours !== 12) hours += 12;
      else if (period === 'AM' && hours === 12) hours = 0;
      return { hours, minutes: parseInt(minutes) };
    };

    const startDateTime = new Date(data.startDate);
    const { hours: sh, minutes: sm } = parseTime(data.startTime);
    startDateTime.setHours(sh, sm, 0, 0);

    const endDateTime = new Date(data.endDate);
    const { hours: eh, minutes: em } = parseTime(data.endTime);
    endDateTime.setHours(eh, em, 0, 0);

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

    if (!data.isUnlimitedCapacity && data.capacity) {
      payload.capacity = data.capacity;
    }

    return payload;
  };

  const handleApiError = (error: { response?: { status?: number; data?: unknown }; message?: string }) => {
    const status = error.response?.status;
    const errorData = error.response?.data;
    let errorMessage = 'Failed to create event';

    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      errorMessage = String((errorData as { message: unknown }).message);
    } else if (error.message) {
      errorMessage = error.message;
    }

    if (status === 403) {
      toast.error('You do not have permission to create events');
    } else if (status === 401) {
      toast.error('Please log in to create events');
      router.push('/');
    } else {
      toast.error(errorMessage);
    }
  };

  const onInvalid = () => {
    toast.error('Please fill in all required fields');
  };

  const handlePublish = form.handleSubmit((data) => {
    setIsPublishing(true);
    createEvent.mutate(
      { body: buildPayload(data) },
      {
        onSuccess: () => {
          toast.success('Event published successfully!');
          router.push('/events');
        },
        onError: (error) => {
          handleApiError(error);
          setIsPublishing(false);
        }
      }
    );
  }, onInvalid);

  const handleSaveDraft = form.handleSubmit((data) => {
    setIsSavingDraft(true);
    createEvent.mutate(
      { body: buildPayload(data) },
      {
        onSuccess: (response) => {
          const eventId = response?.data?.id;
          if (eventId) {
            saveDraft.mutate({ path: { event_id: eventId } });
          } else {
            toast.error('Could not save as draft');
            setIsSavingDraft(false);
          }
        },
        onError: (error) => {
          handleApiError(error);
          setIsSavingDraft(false);
        }
      }
    );
  }, onInvalid);

  return (
    <div className="bg-background relative min-h-screen">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="from-primary/[0.18] via-primary/[0.07] dark:from-primary/[0.26] dark:via-primary/[0.10] absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral-100/70 to-transparent dark:from-neutral-900/60" />

        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <line x1="-5%" y1="0%" x2="40%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1" strokeDasharray="5 16" />
          <line x1="5%" y1="0%" x2="50%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.15)" strokeWidth="1" strokeDasharray="5 16" />
          <line x1="15%" y1="0%" x2="60%" y2="50%" stroke="oklch(0.85 0.18 95 / 0.10)" strokeWidth="1" strokeDasharray="5 16" />

          <circle cx="100%" cy="0" r="440" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="300" stroke="oklch(0.85 0.18 95 / 0.16)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="160" stroke="oklch(0.85 0.18 95 / 0.12)" strokeWidth="1.5" />

          <circle cx="88%" cy="9%" r="3.5" fill="oklch(0.85 0.18 95 / 0.85)" />
          <circle cx="93%" cy="20%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="78%" cy="5%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="22%" cy="4%" r="2.5" fill="oklch(0.85 0.18 95 / 0.50)" />

          <circle cx="0" cy="100%" r="350" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="200" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          <line x1="7%" y1="18%" x2="11%" y2="18%" stroke="oklch(0.85 0.18 95 / 0.60)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9%" y1="16%" x2="9%" y2="20%" stroke="oklch(0.85 0.18 95 / 0.60)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="55%" y1="8%" x2="58%" y2="8%" stroke="oklch(0.85 0.18 95 / 0.45)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="56.5%" y1="6.5%" x2="56.5%" y2="9.5%" stroke="oklch(0.85 0.18 95 / 0.45)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Form {...form}>
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            {/* Left: form */}
            <div className="space-y-8">
              <TitleInput control={form.control} />

              <DateTimeSection control={form.control} form={form} timeOptions={timeOptions} />

              <DetailsSection control={form.control} departments={departments} />

              <OptionsSection control={form.control} form={form} />

              {/* Bottom action row */}
              <div className="flex items-center gap-3 pt-2 pb-10">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isPublishing}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted flex-1 rounded-xl border py-3 text-sm font-medium transition-colors disabled:opacity-50 sm:flex-none sm:px-8"
                >
                  {isSavingDraft ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSavingDraft || isPublishing}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-xl py-3 text-sm font-semibold shadow-md transition-all hover:shadow-lg disabled:opacity-50 sm:flex-none sm:px-8"
                >
                  {isPublishing ? 'Publishing…' : 'Publish Event →'}
                </button>
              </div>
            </div>

            {/* Right: preview sidebar — desktop only */}
            <div className="hidden lg:block">
              <PreviewSidebar values={watchedValues} isDraft={savedAsDraft} />
            </div>
          </div>
        </Form>
      </main>
    </div>
  );
}
