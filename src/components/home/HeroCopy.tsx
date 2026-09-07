/**
 * The hero's type block.
 *
 * A Server Component on purpose. It is passed into `ScrollExplode` as
 * `children`, so the H1, the sub-line, both calls to action and the rating all
 * exist in the server-rendered HTML — none of the page's most important copy
 * waits on the WebGL bundle, and none of it is trapped inside a client
 * component that a crawler has to execute to see.
 *
 * Every figure here comes from `@/lib/site`. Nothing about the store is
 * hard-coded in this file.
 */

import { MapPin, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { businessHours, ratings, storeAddress } from "@/lib/site";
import { cn } from "@/lib/utils";

export function HeroCopy({ className }: { className?: string }) {
  const google = ratings.google;

  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="eyebrow flex items-center gap-2">
        <span className="inline-block h-px w-8 bg-cyan/60" aria-hidden="true" />
        {storeAddress.building} · {storeAddress.city}
      </p>

      <h1
        className={cn(
          "mt-5 font-display font-bold uppercase tracking-[-0.02em] text-chrome-gradient",
          // Fluid down to a 360px phone and up to a wide desktop without a
          // stack of breakpoints. `svh`-safe because it is type, not layout.
          "text-[clamp(2.25rem,9vw,5.75rem)] leading-[0.94]",
        )}
      >
        Build the machine
        <br />
        you actually want.
      </h1>

      <p className="mt-6 max-w-xl text-base leading-relaxed text-silver sm:text-lg">
        Gaming PCs, premium components and custom builds engineered for
        performance.
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* The single brightest element on the page, by design. */}
        <ButtonLink href="/builder" size="xl" className="w-full sm:w-auto">
          BUILD YOUR PC
        </ButtonLink>
        <ButtonLink
          href="/shop"
          variant="outline"
          size="xl"
          className="w-full sm:w-auto"
        >
          SHOP COMPONENTS
        </ButtonLink>
      </div>

      {/* Trust line. Aggregate store rating — never a per-product figure. */}
      <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-ember text-ember"
                strokeWidth={1.5}
              />
            ))}
          </span>
          <span className="tnum font-mono font-semibold text-chrome">
            {google.score.toFixed(1)}
          </span>
          <span className="text-ash">
            from{" "}
            <span className="tnum font-mono text-silver">{google.count}</span>{" "}
            {google.label} reviews
          </span>
        </span>

        <span className="hidden h-4 w-px bg-line-strong sm:inline-block" aria-hidden="true" />

        {/* `businessHours.summary` reads "Open now — closes at 9 PM". Only the
            closing half is rendered: no opening time was ever confirmed, so
            "open now" is a claim about the current moment that this page cannot
            make truthfully. `StoreDetails` makes the same cut. */}
        <span className="flex items-center gap-2 text-ash">
          <MapPin className="h-4 w-4 text-cyan" aria-hidden="true" />
          {storeAddress.building}, {storeAddress.block} — closes at{" "}
          {businessHours.closingTime}
        </span>
      </div>
    </div>
  );
}

export default HeroCopy;
