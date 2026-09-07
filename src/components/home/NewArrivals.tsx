/**
 * Section 8 — New arrivals.
 *
 * Products the catalogue flags as new. The page passes them in already sorted;
 * if nothing carries the flag it falls back to the most recently added stock,
 * and tells the reader which of the two it is looking at via `fallback` — a
 * rail headed "just landed" that is silently showing six-month-old parts would
 * be a small lie repeated on every visit.
 */

import { ArrowRight } from "lucide-react";
import { ButtonLink, SectionHeading } from "@/components/ui";
import type { ProductCardData } from "@/lib/filters";
import { ProductRail } from "./ProductRail";
import { Reveal } from "./Reveal";

export function NewArrivals({
  products,
  fallback = false,
}: {
  products: ProductCardData[];
  /** True when nothing is flagged new and these are simply the newest rows. */
  fallback?: boolean;
}) {
  if (!products.length) return null;

  return (
    <section
      id="new-arrivals"
      aria-labelledby="new-arrivals-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow={fallback ? "Latest in the catalogue" : "Just landed"}
            title={
              <span id="new-arrivals-heading">
                {fallback ? "Newest hardware" : "New arrivals"}
              </span>
            }
            description={
              fallback
                ? "The most recent additions to the catalogue. Stock moves quickly — call the shop before you travel."
                : "Freshly added to the shelves at Hafeez Centre. Stock moves quickly — call before you travel."
            }
            action={
              <ButtonLink href="/shop?sort=newest" variant="outline" size="md">
                SEE WHAT&rsquo;S NEW
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          <ProductRail
            products={products}
            label={fallback ? "Newest hardware" : "New arrivals"}
            priorityCount={0}
          />
        </Reveal>
      </div>
    </section>
  );
}

export default NewArrivals;
