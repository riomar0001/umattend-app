import { Skeleton } from '@/components/ui/skeleton';

export default function EventsSkeleton() {
  return (
    <div>
      {[1, 2, 3, 4, 5].map((i, index) => (
        <div key={i} className={`flex items-stretch ${index < 4 ? 'border-b border-border/60' : ''}`}>
          {/* Left bar placeholder */}
          <div className="w-0.5 flex-shrink-0 self-stretch bg-transparent" />

          {/* Date column */}
          <div className="flex w-12 flex-shrink-0 flex-col justify-center py-5 pl-2 sm:w-20 sm:pl-4">
            <Skeleton className="ml-auto h-8 w-7 sm:h-12 sm:w-10" />
            <Skeleton className="ml-auto mt-1.5 h-2 w-4" />
            <Skeleton className="ml-auto mt-1 h-2 w-3" />
          </div>

          {/* Hairline */}
          <div className="mx-3 w-px flex-shrink-0 self-stretch bg-border/40 sm:mx-5" />

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-center py-5 pr-3 sm:pr-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="mb-2.5 h-[18px] w-3/4 sm:h-5" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-28 sm:w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
