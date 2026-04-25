'use client';

import { useState } from 'react';
import { useRef, useEffect, useMemo } from 'react';
import { Calendar, Mail, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import QRCodeStyling, { Options } from 'qr-code-styling';
import { useQuery } from '@tanstack/react-query';
import ProfileSkeleton from '@/components/profile/profile-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getUserAttendedEventsOptions, getUserHostedEventsOptions } from '@/api/client/@tanstack/react-query.gen';
import { formatEventDateRange, getInitials, toTitleCase } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);

  const ref = useRef<HTMLDivElement>(null);

  // Check if user can host events (admin, csg, organizer roles)
  const canHostEvents = user?.role && ['admin', 'csg', 'organizer'].includes(user.role.toLowerCase());

  // Fetch attended events
  const { data: attendedEventsData, isLoading: isLoadingAttended } = useQuery({
    ...getUserAttendedEventsOptions(),
    enabled: !!user,
    retry: false
  });

  // Fetch hosted events (only for users with appropriate roles)
  const { data: hostedEventsData, isLoading: isLoadingHosted } = useQuery({
    ...getUserHostedEventsOptions(),
    enabled: !!user && !!canHostEvents,
    retry: false
  });

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hour = String(now.getHours()).padStart(2, '0');
  const QRCode =
    typeof window !== 'undefined'
      ? btoa(`${month}${date}${year}${hour}${String(user?.student_id)}`)
      : '';

  const options: Options = useMemo(
    () => ({
      type: 'canvas',
      shape: 'square',
      width: 1000,
      height: 1000,
      margin: 0,
      qrOptions: {
        mode: 'Byte',
        errorCorrectionLevel: 'H'
      },
      imageOptions: {
        saveAsBlob: true,
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 0
      },
      dotsOptions: { type: 'rounded', color: '#1B1212', roundSize: true },
      backgroundOptions: { round: 0, color: '#fdfcf1' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#36454F' },
      cornersDotOptions: { type: 'dot', color: '#36454F' },
      data: `${QRCode}`
    }),
    [QRCode]
  );

  const qrCode = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new QRCodeStyling(options);
    }
    return null;
  }, [options]);

  useEffect(() => {
    if (!qrCode) return;
    if (ref.current && !ref.current.hasChildNodes()) {
      qrCode.append(ref.current);
    }
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
    <div className="min-h-screen bg-neutral-100">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
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
                    <div className="flex-shrink-0">
                      <style>{`.qr-container canvas, .qr-container svg { width: 100% !important; height: auto !important; display: block; border-radius: 14px !important;}`}</style>

                      <div
                        ref={ref}
                        className="qr-container border-primary/30 pointer-events-none aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed select-none sm:max-w-[190px]"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      />
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
            <TabsList className="text-muted-foreground mb-6 inline-flex h-11 w-full items-center justify-center gap-x-2 rounded-lg bg-neutral-200 p-1 sm:w-96">
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
