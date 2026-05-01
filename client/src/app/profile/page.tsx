'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Mail, Users, Settings, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import QRCodeStyling, { Options } from 'qr-code-styling';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import ProfileSkeleton from '@/components/profile/profile-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getUserAttendanceTokenOptions, getUserAttendedEventsOptions, getUserHostedEventsOptions } from '@/api/client/@tanstack/react-query.gen';
import { getErrorMessage } from '@/lib/error-utils';
import { formatEventDateRange, getInitials, toTitleCase } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);

  const ref = useRef<HTMLDivElement>(null);

  const canHostEvents = user?.role && ['admin', 'csg', 'organizer'].includes(user.role.toLowerCase());

  const {
    data: attendedEventsData,
    isLoading: isLoadingAttended,
    isError: isAttendedError,
    error: attendedError
  } = useQuery({
    ...getUserAttendedEventsOptions(),
    enabled: !!user,
    retry: false
  });

  const {
    data: hostedEventsData,
    isLoading: isLoadingHosted,
    isError: isHostedError,
    error: hostedError
  } = useQuery({
    ...getUserHostedEventsOptions(),
    enabled: !!user && !!canHostEvents,
    retry: false
  });

  useEffect(() => {
    if (isAttendedError) toast.error(getErrorMessage(attendedError, 'Failed to load attended events'));
  }, [isAttendedError, attendedError]);

  useEffect(() => {
    if (isHostedError) toast.error(getErrorMessage(hostedError, 'Failed to load hosted events'));
  }, [isHostedError, hostedError]);

  const {
    data: tokenData,
    isError: isTokenError,
    isLoading: isTokenLoading,
    refetch: refetchToken
  } = useQuery({
    ...getUserAttendanceTokenOptions(),
    enabled: !!user,
    refetchInterval: 3540000,
    retry: false
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRefetch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refetchToken(), 500);
  };

  const attendanceToken = tokenData?.data?.token ?? '';

  const options: Options = useMemo(
    () => ({
      type: 'canvas',
      shape: 'square',
      width: 1000,
      height: 1000,
      margin: 30,
      qrOptions: {
        mode: 'Byte',
        errorCorrectionLevel: 'L'
      },
      imageOptions: {
        saveAsBlob: true,
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 0
      },
      dotsOptions: { type: 'rounded', color: '#1B1212', roundSize: true },
      backgroundOptions: { round: 0, color: '#fdfcf1' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#1B1212' },
      cornersDotOptions: { type: 'dot', color: '#1B1212' },
      data: attendanceToken
    }),
    [attendanceToken]
  );

  const qrCode = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new QRCodeStyling(options);
    }
    return null;
  }, [options]);

  useEffect(() => {
    if (!qrCode || !ref.current) return;
    ref.current.innerHTML = '';
    qrCode.append(ref.current);
    qrCode.update(options);
  }, [qrCode, options]);

  const [activeTab, setActiveTab] = useState('attended');

  // Extract events from API responses
  const attendedEvents = attendedEventsData?.data?.events || [];
  const hostedEvents = hostedEventsData?.data?.events || [];

  const handlclickHostedEvent = (eventId: string) => {
    window.location.href = `/events/${eventId}/manage`;
  };

  const handlclickAttendedEvent = (eventId: string) => {
    window.location.href = `/events/${eventId}`;
  };

  if (!user) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="bg-background relative">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top gradient wash */}
        <div className="from-primary/[0.16] via-primary/[0.06] dark:from-primary/[0.24] dark:via-primary/[0.09] absolute inset-x-0 top-0 h-80 bg-gradient-to-b to-transparent" />
        {/* Bottom gradient wash */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/70 to-transparent dark:from-neutral-900/60" />

        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          {/* Top-right: identity arcs — large, personal */}
          <circle cx="100%" cy="0" r="560" stroke="oklch(0.85 0.18 95 / 0.30)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="420" stroke="oklch(0.85 0.18 95 / 0.24)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="280" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />
          <circle cx="100%" cy="0" r="140" stroke="oklch(0.85 0.18 95 / 0.14)" strokeWidth="1.5" />

          {/* Accent dots */}
          <circle cx="85%" cy="8%" r="4" fill="oklch(0.85 0.18 95 / 0.85)" />
          <circle cx="91%" cy="18%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="95%" cy="30%" r="3" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="82%" cy="4%" r="2" fill="oklch(0.85 0.18 95 / 0.60)" />

          {/* Diagonal accent lines — left side, giving movement */}
          <line x1="-5%" y1="25%" x2="25%" y2="55%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="6 14" />
          <line x1="-5%" y1="35%" x2="20%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="6 14" />

          {/* Bottom-left arc */}
          <circle cx="0" cy="100%" r="360" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="200" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Bottom-right subtle arc */}
          <circle cx="100%" cy="100%" r="220" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Cross marks */}
          <line x1="8%" y1="22%" x2="12%" y2="22%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10%" y1="20%" x2="10%" y2="24%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="4%" y1="60%" x2="7%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.50)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5.5%" y1="58.5%" x2="5.5%" y2="61.5%" stroke="oklch(0.85 0.18 95 / 0.50)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="74%" y1="82%" x2="78%" y2="82%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="76%" y1="80%" x2="76%" y2="84%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />

          <line x1="50%" y1="92%" x2="53%" y2="92%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="51.5%" y1="90.5%" x2="51.5%" y2="93.5%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <main className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Hero Profile Card */}
        <div className="border-border from-card to-card/50 relative mb-10 overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.08),transparent_60%)]" />
          <div className="relative px-8 py-12">
            <div className="flex flex-col items-start gap-10 lg:flex-row">
              {/* Left Column - Avatar and Basic Info */}
              <div className="flex w-full flex-col items-center justify-between gap-8 lg:w-80">
                <div className="flex flex-col items-center gap-5">
                  <Avatar className="border-background ring-primary/20 h-36 w-36 border-4 shadow-xl ring-2">
                    <AvatarImage src={user?.profile_picture || undefined} />
                    <AvatarFallback className="bg-foreground text-background text-xl font-semibold">{getInitials(user?.name || '')}</AvatarFallback>
                  </Avatar>
                  <div className="w-full text-center lg:text-left">
                    <h1 className="text-foreground mb-2 text-center text-2xl font-bold sm:text-3xl">{toTitleCase(user?.name || '')}</h1>
                    <p className="text-muted-foreground mb-1 text-center text-sm font-bold">{user?.student_id}</p>
                    <p className="text-muted-foreground mb-2 text-center text-sm">{user?.department}</p>
                    <p className="text-muted-foreground mb-2 text-center text-sm">{user?.program}</p>
                    <div className="mt-4 flex justify-center">
                      <Link href="/profile/settings">
                        <Button variant="outline" size="sm" className="border-border hover:bg-muted gap-2">
                          <Settings className="h-4 w-4" />
                          Account Settings
                        </Button>
                      </Link>
                    </div>
                    {/* Stats Cards */}
                  </div>
                </div>
                <div className={`grid w-full gap-3 ${canHostEvents ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {canHostEvents && (
                    <div className="border-border bg-background/90 min-w-0 rounded-xl border p-4 text-center shadow-sm transition-shadow hover:shadow-md">
                      <div className="text-foreground mb-1 text-xl font-bold">{isLoadingHosted ? '...' : hostedEvents.length}</div>
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Hosted</div>
                    </div>
                  )}

                  <div className="border-border bg-background/90 min-w-0 rounded-xl border p-4 text-center shadow-sm transition-shadow hover:shadow-md">
                    <div className="text-foreground mb-1 text-xl font-bold">{isLoadingAttended ? '...' : attendedEvents.length}</div>
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Attended</div>
                  </div>
                </div>
              </div>
              {/* Right Column - QR Code and Actions */}
              <div className="flex w-full flex-1 flex-col gap-8">
                {/* QR Code Card */}
                <div className="border-border bg-background/90 rounded-xl border p-4 shadow-lg">
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <div className="flex flex-col items-center gap-3">
                      <style>{`.qr-container canvas, .qr-container svg { width: 100% !important; height: auto !important; display: block; border-radius: 14px !important;}`}</style>

                      {isTokenLoading ? (
                        <div className="border-primary/30 flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed sm:min-w-[190px]">
                          <Spinner className="size-8" />
                        </div>
                      ) : isTokenError ? (
                        <button
                          onClick={handleRefetch}
                          className="border-primary/30 text-muted-foreground hover:text-foreground hover:bg-muted flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed transition-colors sm:min-w-[190px]"
                        >
                          <RefreshCw className="h-8 w-8" />
                        </button>
                      ) : (
                        <div
                          ref={ref}
                          className="qr-container border-primary/30 pointer-events-none aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed select-none sm:max-w-[190px]"
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-foreground mb-2 text-xl font-bold">Your Digital Pass</h3>
                      <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                        Use this QR code to check in and out of events. Event organizers can scan it to verify your attendance.
                      </p>
                    </div>
                  </div>
                  <div className="bg-primary/40 mt-5 rounded-md p-2">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      This QR code updates periodically for security reasons. Always use the latest version shown in your account.
                    </p>
                  </div>
                </div>
                {/* Quick Info Cards */}
                <div className="grid gap-4">
                  <div className="border-border bg-background/90 hover:border-primary/50 flex min-w-0 items-center gap-3 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <Mail className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Email</div>
                      <div className="text-foreground text-sm font-semibold break-all">{user?.umindanao_email}</div>
                    </div>
                  </div>
                  <div className="border-border bg-background/90 hover:border-primary/50 flex min-w-0 items-center gap-3 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <Users className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Member Type</div>
                      <div className="text-foreground text-sm font-semibold">{toTitleCase(user?.role || '')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {canHostEvents && (
            <TabsList className="text-muted-foreground mb-6 inline-flex h-11 w-full items-center justify-center gap-x-2 rounded-lg p-1 sm:w-96">
              <TabsTrigger value="attended" className="rounded-md px-3 py-2 text-sm font-medium sm:px-4">
                <Calendar className="mr-2 h-4 w-4" />
                Attended Events
              </TabsTrigger>
              <TabsTrigger value="hosted" className="rounded-md px-3 py-2 text-sm font-medium sm:px-4">
                <Calendar className="mr-2 h-4 w-4" />
                Hosted Events
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="attended" className="space-y-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-bold">Attended Events</h2>
            </div>

            {isLoadingAttended ? (
              <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-lg border p-8 py-12 text-center">
                <div className="text-muted-foreground text-sm">Loading attended events...</div>
              </div>
            ) : attendedEvents.length === 0 ? (
              <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-lg border p-8 py-12 text-center">
                <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="text-foreground mb-2 text-lg font-semibold">No attended events yet</h3>
                <p className="text-muted-foreground text-sm">Events you attend will appear here</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {attendedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="group border-border bg-card hover:border-primary/50 relative cursor-pointer overflow-hidden rounded-xl border shadow-md transition-all duration-300 hover:shadow-xl"
                    onClick={() => event.id && handlclickAttendedEvent(event.id)}
                  >
                    <div className="flex flex-col gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-foreground group-hover:text-primary mb-2 truncate text-lg font-bold transition-colors">{event.title}</h3>
                        <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                          <div className="from-primary/20 to-primary/5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br">
                            <div className="bg-primary h-2 w-2 rounded-full" />
                          </div>
                          <span className="truncate">By {event.created_by || 'Unknown'}</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Calendar className="text-primary h-4 w-4" />
                          <span>{formatEventDateRange(event.start_time, event.end_time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {canHostEvents && (
            <TabsContent value="hosted" className="space-y-4">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-foreground text-2xl font-bold">Hosted Events</h2>
              </div>

              {isLoadingHosted ? (
                <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-lg border p-8 py-12 text-center">
                  <div className="text-muted-foreground text-sm">Loading hosted events...</div>
                </div>
              ) : hostedEvents.length === 0 ? (
                <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-lg border p-8 py-12 text-center">
                  <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                  <h3 className="text-foreground mb-2 text-lg font-semibold">No hosted events yet</h3>
                  <p className="text-muted-foreground mb-4 text-sm">Create your first event to get started</p>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Create Event</Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {hostedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="group border-border bg-card hover:border-primary/50 relative cursor-pointer overflow-hidden rounded-xl border shadow-md transition-all duration-300 hover:shadow-xl"
                      onClick={() => event.id && handlclickHostedEvent(event.id)}
                    >
                      <div className="flex flex-col gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-foreground group-hover:text-primary mb-2 truncate text-lg font-bold transition-colors">{event.title}</h3>
                          <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                            <div className="from-primary/20 to-primary/5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br">
                              <div className="bg-primary h-2 w-2 rounded-full" />
                            </div>
                            <span className="truncate">By {event.created_by || 'Unknown'}</span>
                          </div>
                          <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                            <Calendar className="text-primary h-4 w-4" />
                            <span>{formatEventDateRange(event.start_time, event.end_time)}</span>
                          </div>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <Users className="text-primary h-3 w-3" />
                            <span>{event.attendees || 0} attendees</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ProfilePage;
