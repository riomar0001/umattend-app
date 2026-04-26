'use client';

import { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { CreateEventFormValues } from './schema';

interface TitleInputProps {
  control: Control<CreateEventFormValues>;
}

export function TitleInput({ control }: TitleInputProps) {
  return (
    <FormField
      control={control}
      name="title"
      render={({ field }) => (
        <FormItem className="space-y-1">
          <FormControl>
            <textarea
              {...field}
              placeholder="Untitled Event"
              className="text-foreground placeholder:text-muted-foreground/25 min-h-16 w-full resize-none border-0 bg-transparent text-5xl leading-tight font-bold shadow-none focus:outline-none sm:text-6xl"
              rows={1}
              onInput={(e) => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
              }}
            />
          </FormControl>
          <FormMessage className="bg-background/30 w-auto rounded-4xl p-1 px-5 text-sm backdrop-blur-md" />
        </FormItem>
      )}
    />
  );
}
