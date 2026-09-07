import { Skeleton } from "@/components/ui";

/** Product detail skeleton — gallery left, buy box right, specs below. */
export default function ProductLoading() {
  return (
    <div className="container-page py-8 md:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading product…</span>

      <Skeleton className="h-3 w-64" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-4 w-28" />

          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-13 w-full rounded-xl" />
            <Skeleton className="h-13 w-full rounded-xl" />
            <Skeleton className="h-13 w-full rounded-xl" />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-4">
        <Skeleton className="h-6 w-44" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-2xl" />
        ))}
      </div>
    </div>
  );
}
