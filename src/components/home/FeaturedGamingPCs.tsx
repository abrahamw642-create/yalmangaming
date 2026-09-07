/**
 * Section 5 — Featured gaming PCs.
 *
 * The prebuilt machines, i.e. products of kind `prebuilt`. Rendered as a grid
 * rather than a rail: there are only a handful of them and they are the most
 * considered purchase on the page, so they get room instead of a scrollbar.
 *
 * The last cell is not a product — it is the escape hatch for the visitor who
 * has just read four fixed specifications and thought "none of those". That is
 * the whole argument for the builder, so it belongs here rather than three
 * sections later.
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductCardData } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

export function FeaturedGamingPCs({
  products,
}: {
  products: ProductCardData[];
}) {
  return (
    <section
      id="gaming-pcs"
      aria-labelledby="gaming-pcs-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Ready to play"
            title={<span id="gaming-pcs-heading">Gaming PCs</span>}
            description="Complete machines we assemble ourselves — every one benchmarked and stress tested before it leaves the bench."
            action={
              <ButtonLink href="/shop/gaming-pcs" variant="outline" size="md">
                ALL GAMING PCS
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
              <ConfigureTile />
            </div>
          ) : (
            <EmptyState
              title="No prebuilt machines listed right now"
              description="We can still spec one with you — configure it part by part, or tell us the budget and the games."
              action={
                <ButtonLink href="/builder" size="md">
                  BUILD YOUR PC
                </ButtonLink>
              }
            />
          )}
        </Reveal>
      </div>
    </section>
  );
}

/** "None of these" — the builder pitch, sized and shaped like a product tile. */
function ConfigureTile() {
  return (
    <article
      className={cn(
        "group relative isolate flex flex-col justify-between overflow-hidden rounded-2xl p-6",
        "border border-cyan/25 bg-gradient-to-b from-cyan/[0.07] to-transparent",
        "transition-all duration-300 hover:border-cyan/45 hover:shadow-glow-xs",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 -z-10 h-36 w-36 rounded-full bg-cyan/20 blur-3xl"
      />

      <div>
        <Sparkles className="h-7 w-7 text-cyan" strokeWidth={1.5} aria-hidden="true" />
        <h3 className="mt-5 font-display text-lg font-semibold leading-tight text-chrome">
          None of these quite right?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-silver">
          Change any part of any of them, or start from an empty case. The
          builder checks the fit and the wattage as you go.
        </p>
      </div>

      <ButtonLink href="/builder" size="md" className="mt-6 w-full">
        BUILD YOUR PC
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </ButtonLink>
    </article>
  );
}

export default FeaturedGamingPCs;
