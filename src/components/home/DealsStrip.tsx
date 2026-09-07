/**
 * Section 9 — Deals.
 *
 * Anything the catalogue flags `onDeal` or that carries a real sale price. The
 * headline figure is computed from the products actually on screen rather than
 * written: "up to 18% off" is only ever true because a card below it is 18% off.
 *
 * No countdown and no "ends soon". The store has not given an end date for any
 * offer, and a timer that resets on refresh is the oldest lie in retail.
 */

import { ArrowRight, Tag } from "lucide-react";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductCardData } from "@/lib/filters";
import { discountPercent } from "@/lib/utils";
import { Reveal } from "./Reveal";

export function DealsStrip({ products }: { products: ProductCardData[] }) {
  // Only claim a discount that is visible on this page.
  const best = products.reduce((max, product) => {
    const off = discountPercent(product) ?? 0;
    return off > max ? off : max;
  }, 0);

  return (
    <section
      id="deals"
      aria-labelledby="deals-heading"
      className="relative isolate overflow-hidden border-y border-[var(--color-line)] bg-carbon py-20 md:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 -z-10 h-[28rem] w-[28rem] rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(245,158,11,0.26), transparent 70%)",
        }}
      />

      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Current offers"
            title={<span id="deals-heading">Deals</span>}
            description={
              best > 0
                ? `Discounted right now — up to ${best}% off the listed price. Availability changes daily.`
                : "Everything currently discounted or flagged as an offer. Availability changes daily."
            }
            action={
              <ButtonLink href="/deals" variant="outline" size="md">
                ALL DEALS
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          {products.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Tag className="h-8 w-8" aria-hidden="true" />}
              title="No deals running right now"
              description="Nothing in the catalogue is discounted at the moment. Ask us on WhatsApp what is moving this week — prices move faster than this page does."
              action={
                <ButtonLink href="/shop" variant="secondary" size="md">
                  BROWSE THE SHOP
                </ButtonLink>
              }
            />
          )}
        </Reveal>
      </div>
    </section>
  );
}

export default DealsStrip;
