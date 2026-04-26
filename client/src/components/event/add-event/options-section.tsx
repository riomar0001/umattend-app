'use client';

import { LogOut, Users } from 'lucide-react';
import { Control, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SectionLabel } from './datetime-section';
import { CreateEventFormValues } from './schema';

interface OptionsSectionProps {
  control: Control<CreateEventFormValues>;
  form: UseFormReturn<CreateEventFormValues>;
}

export function OptionsSection({ control, form }: OptionsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionLabel index={3} icon={<Users className="text-foreground h-4 w-4" />} title="Options" />

      <div className="bg-card border-border divide-border divide-y rounded-2xl border shadow-sm backdrop-blur-sm">
        {/* Capacity */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-foreground/8 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Users className="text-foreground h-4 w-4" />
            </div>
            <div className="flex flex-1 items-center justify-between gap-3">
              <span className="text-foreground text-sm font-medium">Capacity</span>
              <FormField
                control={control}
                name="isUnlimitedCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                        className="h-7 rounded-full px-3 text-xs font-medium transition-colors"
                      >
                        {field.value ? 'Unlimited' : 'Limited'}
                      </Button>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {!form.watch('isUnlimitedCapacity') && (
            <div className="mt-3 pl-11">
              <FormField
                control={control}
                name="capacity"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="Max attendees"
                        className="focus-visible:border-primary focus-visible:ring-primary/20 h-9 transition-colors"
                        min="1"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Check-out Required */}
        <FormField
          control={control}
          name="check_out_required"
          render={({ field }) => (
            <FormItem className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-foreground/8 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <LogOut className="text-foreground h-4 w-4" />
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div>
                    <FormLabel className="text-foreground text-sm font-medium">Check-out Required</FormLabel>
                    <p className="text-muted-foreground mt-0.5 text-xs">Attendees must check out when leaving</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
