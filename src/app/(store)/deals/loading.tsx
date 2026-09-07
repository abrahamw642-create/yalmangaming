import { Skeleton } from "@/components/ui";

/**
 * Listing skeleton. Mirrors the real layout's column widths so nothing shifts
 * when the data lands.
 */
export default function DealsLoading() {
  return (
    <div className="container-page py-8 md:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading products…</span>

      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-5 h-10 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden flex-col gap-6 lg:flex">
          {[0, 1, 2, 3].map((section) => (
            <div key={section} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-9 w-36" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="metal flex flex-col gap-3 rounded-2xl p-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
