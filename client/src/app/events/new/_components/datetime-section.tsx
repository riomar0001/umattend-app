'use client';

import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Control, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateEventFormValues } from './schema';

interface DateTimeSectionProps {
  control: Control<CreateEventFormValues>;
  form: UseFormReturn<CreateEventFormValues>;
  timeOptions: string[];
}

export function DateTimeSection({ control, form, timeOptions }: DateTimeSectionProps) {
  const startDate = form.watch('startDate');

  return (
    <div className="space-y-3">
      <SectionLabel index={1} icon={<CalendarDays className="text-foreground h-4 w-4" />} title="When" />

      <div className="bg-card border-border space-y-1 rounded-2xl border shadow-sm backdrop-blur-sm">
        <DateTimeRow
          label="Start"
          dateName="startDate"
          timeName="startTime"
          control={control}
          form={form}
          timeOptions={timeOptions}
          isFirst
          disabledBefore={new Date()}
        />
        <div className="bg-border mx-4 h-px opacity-50" />
        <DateTimeRow label="End" dateName="endDate" timeName="endTime" control={control} form={form} timeOptions={timeOptions} disabledBefore={startDate} />
      </div>
    </div>
  );
}

interface DateTimeRowProps {
  label: string;
  dateName: 'startDate' | 'endDate';
  timeName: 'startTime' | 'endTime';
  control: Control<CreateEventFormValues>;
  form: UseFormReturn<CreateEventFormValues>;
  timeOptions: string[];
  isFirst?: boolean;
  disabledBefore?: Date;
}

function DateTimeRow({ label, dateName, timeName, control, form, timeOptions, isFirst, disabledBefore }: DateTimeRowProps) {
  return (
    <div className={`flex items-center gap-3 px-5 ${isFirst ? 'pt-4 pb-3' : 'pt-3 pb-4'}`}>
      <Label className="text-muted-foreground w-10 shrink-0 text-xs font-medium tracking-wide uppercase">{label}</Label>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <FormField
            control={control}
            name={dateName}
            render={({ field }) => (
              <FormItem className="flex-1 space-y-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="ghost" className="hover:bg-primary/10 h-8 w-full justify-start rounded-lg px-2.5 text-left text-sm font-medium">
                        {field.value ? format(field.value, 'EEE, MMM d') : 'Pick date'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        form.trigger([dateName, timeName]);
                      }}
                      disabled={disabledBefore ? { before: disabledBefore } : undefined}
                    />
                  </PopoverContent>
                </Popover>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={timeName}
            render={({ field }) => (
              <FormItem className="w-[88px] shrink-0 space-y-0">
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="hover:bg-primary/10 border-border/60 h-8 rounded-lg px-2.5 text-sm font-medium shadow-none [&>svg]:hidden">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[280px]">
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
        <div className="space-y-0.5">
          <FormField
            control={control}
            name={dateName}
            render={() => (
              <FormItem className="space-y-0">
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={timeName}
            render={() => (
              <FormItem className="space-y-0">
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}

interface SectionLabelProps {
  index: number;
  icon: React.ReactNode;
  title: string;
}

export function SectionLabel({ index, icon, title }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-foreground/10 text-foreground flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">{index}</div>
      {icon}
      <span className="text-foreground text-xs font-semibold tracking-widest uppercase">{title}</span>
    </div>
  );
}
