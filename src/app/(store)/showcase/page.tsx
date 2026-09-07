/**
 * `/showcase` — Built by Yalman.
 *
 * The machines the shop actually assembles, read straight from the
 * `ShowcaseBuild` table. Nothing on this page is generated copy: the name,
 * tagline, tier, target and component list all come from the row, and the price
 * is seeded sample data so it carries the "sample" marker everywhere it
 * appears.
 *
 * Each card also carries `id={slug}`, because the home page's showcase rail
 * links to `/showcase#<slug>`. That anchor has to keep landing on the right
 * card even though the full spec now lives at `/showcase/<slug>`.
 *
 * The store layout owns `<main id="main">`, so this page renders no `<main>`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cpu, Wrench } from "lucide-react";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero } from "@/components/content/PageHero";
import { TalkToUs } from "@/components/content/StoreInfo";
import {
  accentEdge,
  getShowcaseBuilds,
  headlineParts,
  parseShowcaseParts,
  partLabel,
  tierTone,
  type ShowcaseBuildRecord,
} from "@/components/content/showcase";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Price,
  SamplePricingNote,
} from "@/components/ui";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

/** Availability and sample pricing are per-request facts, not build-time ones. */
export const dynamic = "force-dynamic";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Built by Yalman" }];

export const metadata: Metadata = pageMetadata({
  title: "Built by Yalman — Gaming PC Builds We Assemble in Lahore",
  description:
    "The gaming PC configurations Yalman Gaming builds most often, from a 1080p entry machine to a 4K RTX 5090 workstation. Full part lists for every build — change any part and we will build it your way.",
  path: "/showcase",
  keywords: [
    "gaming PC builds Lahore",
    "prebuilt gaming PC Pakistan",
    "RTX gaming PC Lahore",
    "custom gaming PC Hafeez Centre",
  ],
});

export default async function ShowcasePage() {
  const builds = await getShowcaseBuilds();
  const hasSamplePricing = builds.some((b) => b.price !== null && b.samplePrice);

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Built by Yalman",
            description:
              "Gaming PC configurations assembled by Yalman Gaming in Hafeez Centre, Lahore, with the full component list for each.",
            path: "/showcase",
          }),
          breadcrumbJsonLd(CRUMBS),
          ...(builds.length
            ? [
                itemListJsonLd({
                  name: "Built by Yalman",
                  description:
                    "Gaming PC builds assembled by Yalman Gaming, Lahore.",
                  items: builds.map((build) => ({
                    name: build.name,
                    path: `/showcase/${build.slug}`,
                    description: build.tagline ?? undefined,
                  })),
                }),
              ]
            : []),
        ]}
      />

      <PageHero
        eyebrow="From the bench"
        title="BUILT BY YALMAN"
        crumbs={CRUMBS}
        lede={
          <>
            These are the machines we put together most often — the
            configurations that came out of hundreds of conversations at the
            counter in Hafeez Centre about what a given budget should actually
            buy. Every part is listed. Change any of them and it is still a
            build we will make for you.
          </>
        }
        actions={
          <>
            <ButtonLink href="/builder" variant="primary" size="lg">
              BUILD YOUR PC
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/quote" variant="outline" size="lg">
              ASK FOR A QUOTE
            </ButtonLink>
          </>
        }
      />

      <div className="container-page py-12 md:py-16">
        {builds.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-8 w-8" aria-hidden="true" />}
            title="No builds published yet"
            description="Yalman Gaming has not added any finished machines to the site yet. The custom builder has every part we stock, and we will spec a machine with you over the phone in the meantime."
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <ButtonLink href="/builder" variant="primary" size="md">
                  BUILD YOUR PC
                </ButtonLink>
                <ButtonLink href="/contact" variant="secondary" size="md">
                  Contact the store
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            {hasSamplePricing && <SamplePricingNote className="mb-8 max-w-3xl" />}

            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {builds.map((build) => (
                <li key={build.id}>
                  <ShowcaseCard build={build} />
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center">
              <h2 className="font-display text-xl font-semibold text-chrome">
                None of these is quite it?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-silver">
                Every one of these started as a blank configuration. Open the
                builder, pick the parts you want, and it checks socket, clearance
                and wattage as you go — or tell us the budget and we will do it
                with you.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <ButtonLink href="/builder" variant="primary" size="md">
                  BUILD YOUR PC
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href="/assembly" variant="secondary" size="md">
                  WE BUILD IT FOR YOU
                </ButtonLink>
              </div>
            </div>
          </>
        )}

        <TalkToUs
          className="mt-12"
          title="Want one of these, changed?"
          description="Swap the card, add a second drive, move to a bigger case — tell us what you would change and we will price it."
          message="Hi Yalman Gaming — I saw the builds on your website and I would like to change one of them."
        />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

function ShowcaseCard({ build }: { build: ShowcaseBuildRecord }) {
  const parts = parseShowcaseParts(build.components);
  const headline = headlineParts(parts);
  const href = `/showcase/${build.slug}`;

  return (
    <article
      id={build.slug}
      className={cn(
        "metal group flex h-full scroll-mt-28 flex-col overflow-hidden rounded-2xl",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        accentEdge(build.accent),
      )}
    >
      {/* Line art on a transparent ground: contained with padding, never
          cropped like a photograph. */}
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-line bg-gradient-to-b from-white/[0.03] to-transparent p-6">
        {build.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={build.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Cpu className="h-12 w-12 text-iron" strokeWidth={1.5} aria-hidden="true" />
        )}

        {build.tier && (
          <span className="absolute left-4 top-4">
            <Badge tone={tierTone(build.tier)}>{build.tier}</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-lg font-bold uppercase tracking-tight text-chrome">
          {/* The heading is the card's primary link. The buttons below repeat
              it deliberately rather than wrapping the whole card in an anchor,
              which would swallow them. */}
          <Link href={href} className="transition-colors hover:text-white">
            {build.name}
          </Link>
        </h2>

        {build.tagline && (
          <p className="mt-1.5 text-sm leading-relaxed text-silver">
            {build.tagline}
          </p>
        )}

        {build.target && (
          <p className="tnum mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-cyan">
            {build.target}
          </p>
        )}

        {headline.length > 0 && (
          <dl className="mt-4 space-y-2 border-t border-line pt-4">
            {headline.map((part) => (
              <div key={part.kind} className="flex gap-3 text-xs leading-relaxed">
                <dt className="w-20 shrink-0 font-mono uppercase tracking-wider text-ash">
                  {partLabel(part.kind)}
                </dt>
                <dd className="min-w-0 flex-1 text-silver">{part.name}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-auto pt-6">
          {build.price !== null ? (
            <Price price={build.price} samplePrice={build.samplePrice} size="lg" />
          ) : (
            <p className="text-sm text-ash">Price on request.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={href} variant="secondary" size="sm">
              FULL SPEC
            </ButtonLink>
            <ButtonLink href="/builder" variant="ghost" size="sm">
              BUILD SOMETHING LIKE IT
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
