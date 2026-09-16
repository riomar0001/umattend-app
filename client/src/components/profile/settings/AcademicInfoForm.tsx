'use client';

import { useEffect } from 'react';
import { AxiosError } from 'axios';
import { Building2, GraduationCap, Hash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { putUserMutation } from '@/api/client/@tanstack/react-query.gen';
import type { PutUserError } from '@/api/client/types.gen';
import { DepartmentAndPrograms } from '@/lib/department-and-program';
import { STUDENT_ID_DIGITS, STUDENT_ID_PATTERN, STUDENT_ID_RULE_MESSAGE } from '@/lib/student-id';
import { hasStudentId, useAuthStore } from '@/store/authStore';

const academicInfoSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  program: z.string().min(1, 'Program is required'),
  student_id: z.string().regex(STUDENT_ID_PATTERN, STUDENT_ID_RULE_MESSAGE)
});

type AcademicInfoFormValues = z.infer<typeof academicInfoSchema>;

export const AcademicInfoForm = () => {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const replaceAccessToken = useAuthStore((state) => state.replaceAccessToken);
  const queryClient = useQueryClient();

  // Blank rather than '0' when there is none on file, so the field reads as
  // empty and not as an ID the account already has.
  const storedStudentId = hasStudentId(user?.student_id) ? String(user.student_id) : '';

  const form = useForm<AcademicInfoFormValues>({
    resolver: zodResolver(academicInfoSchema),
    defaultValues: {
      department: user?.department || '',
      program: user?.program || '',
      student_id: storedStudentId
    }
  });

  const selectedDepartment = form.watch('department');
  const departments = Object.keys(DepartmentAndPrograms);
  const programs = selectedDepartment ? DepartmentAndPrograms[selectedDepartment as keyof typeof DepartmentAndPrograms] : [];

  // Reset form when user data changes
  useEffect(() => {
    if (user?.department && user?.program) {
      form.reset({
        department: user.department,
        program: user.program,
        student_id: storedStudentId
      });
    }
  }, [user?.department, user?.program, storedStudentId, form]);

  const updateAcademicInfoMutation = useMutation({
    ...putUserMutation(),
    onSuccess: (data) => {
      if (data.success && data.data?.user) {
        const apiUser = data.data.user;

        // The ID number lives in the access token, so the store has to be fed
        // from the reissued one — merging the response alone would leave the
        // profile and QR code showing the number the user just replaced.
        if (data.data.access_token) {
          replaceAccessToken(data.data.access_token);
        } else {
          updateUser({
            user_id: apiUser.id,
            student_id: apiUser.student_id ?? user?.student_id,
            umindanao_email: apiUser.umindanao_email || user?.umindanao_email,
            name: apiUser.name || user?.name,
            department: apiUser.department || '',
            program: apiUser.program || '',
            role: user?.role || 'student',
            done_onboarding: apiUser.done_onboarding ?? user?.done_onboarding ?? false,
            profile_picture: user?.profile_picture || ''
          });
        }

        // Invalidate user-related queries
        queryClient.invalidateQueries({ queryKey: ['getUser'] });

        toast.success('Academic information updated successfully!');
        form.reset({
          department: apiUser.department || '',
          program: apiUser.program || '',
          student_id: hasStudentId(apiUser.student_id) ? String(apiUser.student_id) : ''
        });
      }
    },
    onError: (error: AxiosError<PutUserError>) => {
      // A 409 names the ID number, so it belongs on that field rather than in
      // a toast the user cannot act on.
      const message = error?.response?.data?.message;

      if (error?.response?.status === 409 && message) {
        form.setError('student_id', { type: 'server', message });
        return;
      }

      toast.error('Failed to update academic information', {
        description: message || error.message || 'Please try again later'
      });
    }
  });

  const handleDepartmentChange = (value: string) => {
    form.setValue('department', value, { shouldValidate: true });
    form.setValue('program', '', { shouldValidate: true });
  };

  const onSubmit = (data: AcademicInfoFormValues) => {
    const trimmedStudentId = data.student_id.trim();

    updateAcademicInfoMutation.mutate({
      body: {
        department: data.department,
        program: data.program,
        // Sent only when it actually changed. The server would accept a no-op
        // write, but leaving it out keeps an unchanged ID off the unique index
        // and out of the reissued token's way.
        ...(trimmedStudentId !== storedStudentId ? { student_id: Number(trimmedStudentId) } : {})
      }
    });
  };

  const isDirty = form.formState.isDirty;
  const isValid = form.formState.isValid;

  return (
    <Card className="border-border border shadow-sm">
      <CardHeader className="border-border border-b pb-4">
        <CardTitle className="text-foreground text-lg font-semibold">Academic Information</CardTitle>
        <CardDescription className="text-muted-foreground">Update your ID number, department and program information</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Hash className="text-primary h-4 w-4" />
                    ID Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={STUDENT_ID_DIGITS}
                      placeholder="e.g. 576804"
                      aria-invalid={Boolean(form.formState.errors.student_id)}
                      className="border-border bg-background font-mono text-base"
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground text-xs">
                    Used to record your attendance and to generate your QR code. It must be {STUDENT_ID_DIGITS} digits and cannot already belong to another
                    account.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="text-primary h-4 w-4" />
                    Department
                  </FormLabel>
                  <Select value={field.value} onValueChange={handleDepartmentChange}>
                    <FormControl>
                      <SelectTrigger className="border-border hover:border-foreground/20 bg-background !h-auto w-full text-left text-sm break-words !whitespace-normal transition-colors [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal">
                        <SelectValue placeholder="Select your department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-w-[calc(100vw-2rem)] md:max-w-md">
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

            <FormField
              control={form.control}
              name="program"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <GraduationCap className="text-primary h-4 w-4" />
                    Program
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.clearErrors('program');
                    }}
                    disabled={!selectedDepartment}
                  >
                    <FormControl>
                      <SelectTrigger className="border-border hover:border-foreground/20 bg-background !h-auto w-full text-left text-sm break-words !whitespace-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal">
                        <SelectValue placeholder={selectedDepartment ? 'Select your program' : 'Please select a department first'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-w-[calc(100vw-2rem)] md:max-w-md">
                      {programs.map((program) => (
                        <SelectItem
                          key={program}
                          value={program}
                          className="h-auto min-h-fit cursor-pointer !items-start py-3 text-sm leading-normal break-words !whitespace-normal"
                        >
                          {program}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={!isDirty || updateAcademicInfoMutation.isPending}
                className="border-border hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || !isValid || updateAcademicInfoMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {updateAcademicInfoMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
