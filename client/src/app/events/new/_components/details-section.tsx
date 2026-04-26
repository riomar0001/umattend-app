'use client';

import { Building2, FileText, MapPin } from 'lucide-react';
import { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionLabel } from './datetime-section';
import { CreateEventFormValues } from './schema';

interface DetailsSectionProps {
  control: Control<CreateEventFormValues>;
  departments: string[];
}

export function DetailsSection({ control, departments }: DetailsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionLabel index={2} icon={<FileText className="text-foreground h-4 w-4" />} title="Details" />

      <div className="bg-card border-border divide-border divide-y rounded-2xl border shadow-sm backdrop-blur-sm">
        {/* Location */}
        <FormField
          control={control}
          name="location"
          render={({ field }) => (
            <FormItem className="space-y-0 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="bg-foreground/8 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <MapPin className="text-foreground h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <FormLabel className="text-foreground text-sm font-medium">Location</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Where is this happening?"
                      className="focus-visible:border-primary focus-visible:ring-primary/20 h-9 transition-colors"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </div>
              </div>
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-0 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="bg-foreground/8 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <FileText className="text-foreground h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <FormLabel className="text-foreground text-sm font-medium">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="What's this event about?"
                      className="focus-visible:border-primary focus-visible:ring-primary/20 min-h-28 transition-colors"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </div>
              </div>
            </FormItem>
          )}
        />

        {/* Department */}
        <FormField
          control={control}
          name="department"
          render={({ field }) => (
            <FormItem className="space-y-0 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="bg-foreground/8 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="text-foreground h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <FormLabel className="text-foreground text-sm font-medium">Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="hover:border-foreground/30 h-9 w-full break-words !whitespace-normal text-sm transition-colors [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal">
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
                  <FormMessage className="text-xs" />
                </div>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
