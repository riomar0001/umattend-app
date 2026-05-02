'use client';

import { useEffect } from 'react';
import { AxiosError } from 'axios';
import { Building2, GraduationCap, Mail, User, Hash, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { postUserOnboardingMutation, getUserOptions, postAuthLogoutMutation } from '@/api/client/@tanstack/react-query.gen';
import type { PostUserOnboardingError } from '@/api/client/types.gen';
import { DepartmentAndPrograms } from '@/lib/department-and-program';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

interface OnboardingFormData {
  department: string;
  program: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isDoneOnboarding = useAuthStore((state) => state.isDoneOnboarding);
  const user = useAuthStore((state) => state.user);
  const replaceAccessToken = useAuthStore((state) => state.replaceAccessToken);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);

  // Fetch user data to ensure we have the latest info (but not during onboarding submission)
  const { data: userData, refetch: refetchUser } = useQuery({
    ...getUserOptions(),
    enabled: isAuthenticated() && !isDoneOnboarding(), // Disable after onboarding is done
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false
  });

  // Update user data in store when fetched (merge with existing JWT data)
  useEffect(() => {
    if (userData?.success && userData?.data?.user) {
      const apiUser = userData.data.user;
      const currentUser = useAuthStore.getState().user; // ✅ Get user from store directly

      // Merge API data with existing JWT data (preserve student_id from JWT)
      updateUser({
        user_id: apiUser.id,
        student_id: currentUser?.student_id, // Keep from JWT
        umindanao_email: apiUser.umindanao_email || currentUser?.umindanao_email,
        name: apiUser.name || currentUser?.name,
        department: apiUser.department || currentUser?.department,
        program: apiUser.program || currentUser?.program,
        role: (apiUser.role as 'student' | 'admin' | 'csg' | 'instructor' | 'organizer') || currentUser?.role || 'student',
        done_onboarding: apiUser.done_onboarding ?? currentUser?.done_onboarding ?? false,
        profile_picture: currentUser?.profile_picture || ''
      });
    }
  }, [userData, updateUser]); // ✅ Removed 'user' from dependencies

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { isValid }
  } = useForm<OnboardingFormData>({
    mode: 'onChange',
    defaultValues: {
      department: '',
      program: ''
    }
  });

  const selectedDepartment = watch('department');
  const selectedProgram = watch('program');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/');
    }

    if (isDoneOnboarding()) {
      router.push('/events');
    }
  }, [isAuthenticated, router, isDoneOnboarding]);

  const logoutMutation = useMutation({
    mutationFn: postAuthLogoutMutation().mutationFn,
    onSuccess: () => {
      logout();
      router.push('/');
      toast.success('Logged out successfully');
    },
    onError: () => {
      logout();
      router.push('/');
      toast.info('Logged out');
    }
  });

  const onboardingMutation = useMutation({
    ...postUserOnboardingMutation(),
    onSuccess: async (data) => {
      if (data.success && data.data?.access_token) {
        replaceAccessToken(data.data.access_token);

        // Fetch updated user data to get profile picture and other info
        const userDataResponse = await refetchUser();

        if (userDataResponse.data?.success && userDataResponse.data?.data?.user) {
          const apiUser = userDataResponse.data.data.user as {
            id?: string;
            umindanao_email?: string;
            name?: string;
            department?: string;
            program?: string;
            profile_picture?: string;
            done_onboarding?: boolean;
            role?: string;
          };
          const currentUser = useAuthStore.getState().user;

          // Update user with complete profile including profile picture
          updateUser({
            user_id: apiUser.id,
            student_id: currentUser?.student_id,
            umindanao_email: apiUser.umindanao_email || currentUser?.umindanao_email,
            name: apiUser.name || currentUser?.name,
            department: apiUser.department || currentUser?.department,
            program: apiUser.program || currentUser?.program,
            role: (apiUser.role as 'student' | 'admin' | 'csg' | 'instructor' | 'organizer') || currentUser?.role || 'student',
            done_onboarding: apiUser.done_onboarding ?? currentUser?.done_onboarding ?? false,
            profile_picture: apiUser.profile_picture || currentUser?.profile_picture || ''
          });
        }

        toast.success('Profile completed successfully!', {
          description: 'Welcome to the event management system.'
        });

        // Redirect to events page after a short delay to ensure state is updated
        setTimeout(() => {
          router.push('/events');
        }, 800);
      } else {
        toast.error('Onboarding failed', {
          description: 'Invalid response from server. Please try again.'
        });
      }
    },
    onError: (error: AxiosError<PostUserOnboardingError>) => {
      const errorMessage = error?.response?.data?.message || 'Failed to complete profile. Please try again.';
      toast.error('Onboarding failed', {
        description: errorMessage
      });
    }
  });

  const departments = Object.keys(DepartmentAndPrograms);
  const programs = selectedDepartment ? DepartmentAndPrograms[selectedDepartment as keyof typeof DepartmentAndPrograms] : [];

  const handleDepartmentChange = (value: string) => {
    setValue('department', value, { shouldValidate: true });
    setValue('program', '', { shouldValidate: true }); // Reset program when department changes
  };

  const handleProgramChange = (value: string) => {
    setValue('program', value, { shouldValidate: true });
  };

  const onSubmit = (data: OnboardingFormData) => {
    onboardingMutation.mutate({
      body: {
        department: data.department,
        program: data.program
      }
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate({});
  };

  // Student data from auth store
  const studentData = {
    name: user?.name || 'User',
    idNumber: user?.student_id?.toString() || 'N/A',
    email: user?.umindanao_email || 'N/A'
  };

  return (
    <div className="bg-background min-h-screen">
      <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-12 sm:py-16">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-foreground text-2xl font-semibold sm:text-3xl">Complete Your Profile</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
            Help us personalize your experience by providing your academic information
          </p>
        </div>

        <Card className="border-border border shadow-sm">
          <CardHeader className="border-border space-y-1 border-b pb-6">
            <CardTitle className="text-foreground text-xl font-semibold">Academic Information</CardTitle>
            <CardDescription className="text-muted-foreground">Your information is securely stored and will only be used for event management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="bg-muted/30 border-border/50 rounded-lg border p-6">
              <div className="flex flex-col items-start gap-6 sm:flex-row">
                <div className="flex-shrink-0">
                  <Avatar className="border-border h-20 w-20 border-2 shadow-sm">
                    <AvatarImage src={user?.profile_picture || undefined} alt={studentData.name} />
                    <AvatarFallback className="bg-foreground text-background text-xl font-semibold">{getInitials(studentData.name)}</AvatarFallback>
                  </Avatar>
                </div>

                <div className="grid w-full flex-1 grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                      <User className="h-3.5 w-3.5" />
                      Full Name
                    </Label>
                    <p className="text-foreground text-base font-semibold">{studentData.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                      <Hash className="h-3.5 w-3.5" />
                      Student ID
                    </Label>
                    <p className="text-foreground font-mono text-base font-semibold">{studentData.idNumber}</p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                      <Mail className="h-3.5 w-3.5" />
                      University Email
                    </Label>
                    <p className="text-foreground text-sm font-medium break-all">{studentData.email}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="department" className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="text-primary h-4 w-4" />
                  Department
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedDepartment} onValueChange={handleDepartmentChange}>
                  <SelectTrigger
                    id="department"
                    className="sborder-border hover:border-foreground/20 bg-background !h-auto w-full text-left text-sm break-words !whitespace-normal transition-colors [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal"
                  >
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] md:w-full">
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept} className="cursor-pointer !items-start py-3 text-sm leading-normal !whitespace-normal">
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="program" className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="text-primary h-4 w-4" />
                  Program
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedProgram} onValueChange={handleProgramChange} disabled={!selectedDepartment}>
                  <SelectTrigger
                    id="program"
                    className="border-border hover:border-foreground/20 bg-background !h-auto w-full text-left text-sm break-words !whitespace-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-2 [&>span]:text-left [&>span]:leading-normal [&>span]:break-words [&>span]:whitespace-normal"
                  >
                    <SelectValue placeholder={selectedDepartment ? 'Select your program' : 'Please select a department first'} />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] md:w-full">
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
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 pt-4">
                {!onboardingMutation.isPending ? (
                  <>
                    <Button
                      type="submit"
                      disabled={!isValid || onboardingMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 w-full text-base font-semibold shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      size="lg"
                    >
                      Continue to Dashboard
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-muted-foreground hover:text-foreground focus:ring-primary inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm font-medium transition-colors hover:underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4 py-6">
                    <div className="relative">
                      <div className="border-muted border-t-primary h-12 w-12 animate-spin rounded-full border-3" />
                    </div>
                    <p className="text-foreground text-sm font-medium">Setting up your profile...</p>
                  </div>
                )}
              </div>
            </form>

            <p className="text-muted-foreground pt-2 text-center text-xs leading-relaxed">
              By continuing, you agree to our <button className="text-foreground font-medium hover:underline">Terms of Service</button> and{' '}
              <button className="text-foreground font-medium hover:underline">Privacy Policy</button>
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            Need assistance?{' '}
            <a href="/contact" className="text-foreground font-medium hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
