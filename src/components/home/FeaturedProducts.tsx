/**
 * Section 2 — Featured products.
 *
 * A Server Component. The tiles themselves are client leaves (`ProductCard`
 * owns the tilt, quick view and add-to-cart), but the list is rendered on the
 * server so the products are real HTML on first paint.
 *
 * Products come from `getFeaturedProducts`, which already pushes sold-out
 * items down and tops the rail up with the best-rated stock if Yalman has not
 * flagged enough — so this component never has to reason about a half-empty
 * rail.
 */

import { ArrowRight } from "lucide-react";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";
import type { ProductCardData } from "@/lib/filters";
import { ProductRail } from "./ProductRail";
import { Reveal } from "./Reveal";

export function FeaturedProducts({
  products,
}: {
  products: ProductCardData[];
}) {
  return (
    <section
      id="featured"
      aria-labelledby="featured-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Handpicked"
            title={<span id="featured-heading">Featured hardware</span>}
            description="The parts we are recommending across the counter this month — in stock at Hafeez Centre."
            action={
              <ButtonLink href="/shop" variant="outline" size="md">
                BROWSE THE SHOP
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          {products.length ? (
            <ProductRail products={products} label="Featured hardware" />
          ) : (
            <EmptyState
              title="Nothing is flagged as featured yet"
              description="The full catalogue is still there — start in the shop or configure a build from scratch."
              action={
                <ButtonLink href="/shop" variant="secondary" size="md">
                  OPEN THE SHOP
                </ButtonLink>
              }
            />
          )}
        </Reveal>
      </div>
    </section>
  );
}

export default FeaturedProducts;
