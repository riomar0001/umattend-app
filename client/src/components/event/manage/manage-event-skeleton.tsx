import { Skeleton } from '@/components/ui/skeleton';

export default function ManageEventSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      {/* Hero skeleton */}
      <section className="border-border border-b">
        <div className="container mx-auto max-w-4xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
          {/* Top bar */}
          <div className="mb-7 flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>

          {/* Date block + title */}
          <div className="flex items-start gap-4 sm:gap-7">
            <div className="flex-shrink-0 space-y-2 text-right">
              <Skeleton className="ml-auto h-12 w-10 sm:h-16 sm:w-14" />
              <Skeleton className="ml-auto h-2 w-7" />
              <Skeleton className="ml-auto h-2 w-5" />
            </div>
            <div className="bg-border/40 w-px self-stretch" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-4/5 sm:h-10" />
            </div>
          </div>

          {/* Meta details card */}
          <div className="border-border/60 mt-6 overflow-hidden rounded-xl border">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3.5 ${i < 3 ? 'border-border/40 border-b' : ''}`}>
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="ml-auto h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab nav skeleton */}
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="border-border mb-6 flex gap-6 border-b pb-px">
          {[80, 72, 72, 80, 80].map((w, i) => (
            <Skeleton key={i} className={`h-4 w-${w / 4} mb-px`} style={{ width: w }} />
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-border rounded-xl border p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-12" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Meta badges card */}
        <div className="border-border mt-3 rounded-xl border px-5 py-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>

        {/* About card */}
        <div className="border-border mt-3 rounded-xl border px-5 py-5">
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </main>
    </div>
  );
}
