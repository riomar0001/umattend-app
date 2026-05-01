import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileSkeleton() {
  return (
    <div className="bg-neutral-100">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Hero Profile Card Skeleton */}
        <div className="border-border from-card to-card/50 relative mb-10 overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.08),transparent_60%)]" />
          <div className="relative px-8 py-12">
            <div className="flex flex-col items-start gap-10 lg:flex-row">
              {/* Left Column Skeleton */}
              <div className="flex w-full flex-col items-center justify-between gap-8 lg:w-80">
                <div className="flex flex-col items-center gap-5">
                  <Skeleton className="h-36 w-36 rounded-full" />
                  <div className="w-full space-y-3 text-center">
                    <Skeleton className="mx-auto h-4 w-20" />
                    <Skeleton className="mx-auto h-8 w-48" />

                    <Skeleton className="mx-auto h-4 w-56" />
                    <Skeleton className="mx-auto h-4 w-64" />
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="border-border bg-background/90 min-w-0 rounded-xl border p-4 text-center shadow-sm">
                    <Skeleton className="mx-auto mb-2 h-7 w-12" />
                    <Skeleton className="mx-auto h-3 w-16" />
                  </div>
                  <div className="border-border bg-background/90 min-w-0 rounded-xl border p-4 text-center shadow-sm">
                    <Skeleton className="mx-auto mb-2 h-7 w-12" />
                    <Skeleton className="mx-auto h-3 w-20" />
                  </div>
                </div>
              </div>
              {/* Right Column Skeleton */}
              <div className="flex w-full flex-1 flex-col gap-8">
                {/* QR Code Card Skeleton */}
                <div className="border-border bg-background/90 rounded-xl border p-6 shadow-lg">
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <Skeleton className="h-44 w-44 flex-shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </div>
                {/* Quick Info Cards Skeleton */}
                <div className="grid gap-4">
                  <div className="border-border bg-background/90 flex min-w-0 items-center gap-3 rounded-xl border p-4 shadow-sm">
                    <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <div className="border-border bg-background/90 flex min-w-0 items-center gap-3 rounded-xl border p-4 shadow-sm">
                    <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Past Events Skeleton */}
        <div className="mt-14">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-9 w-20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="border-border bg-card flex flex-col justify-center rounded-xl border px-6 py-5 shadow-md">
                <div className="flex flex-col gap-2">
                  <Skeleton className="mb-1 h-6 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
