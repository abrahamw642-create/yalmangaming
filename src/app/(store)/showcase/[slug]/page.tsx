/**
 * `/showcase/[slug]` — one machine from the bench, in full.
 *
 * Everything on this page is a `ShowcaseBuild` column. The part list is the row
 * and nothing else: no invented benchmark figures, no build time, no warranty
 * duration. Where the same machine also exists as a sellable `Product` (the
 * seeded prebuilts do), the page links to it by *exact name match* rather than
 * guessing at a slug — a wrong link here would send someone to buy a different
 * computer.
 *
 * No `Product` structured data is emitted. Google's Product markup wants an
 * `Offer` with a price and an availability, and both would be a claim the store
 * has not confirmed: the figure is seeded sample data. Breadcrumb and WebPage
 * markup describe the page truthfully, so that is all this emits.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero } from "@/components/content/PageHero";
import { TalkToUs, WhatsAppButton } from "@/components/content/StoreInfo";
import {
  getShowcaseBuild,
  getShowcaseBuilds,
  neighbours,
  orderedParts,
  parseShowcaseParts,
  partLabel,
  tierTone,
} from "@/components/content/showcase";
import {
  Badge,
  ButtonLink,
  Card,
  Price,
  SamplePricingNote,
  StockIndicator,
} from "@/components/ui";
import { searchProducts } from "@/lib/catalog";
import type { ProductCardData } from "@/lib/filters";
import { breadcrumbJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";

/** Stock and pricing on the linked product are per-request facts. */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const build = await getShowcaseBuild(slug);

  if (!build) {
    return pageMetadata({
      title: "Build not found",
      description: "This build is no longer listed on the Yalman Gaming site.",
      path: `/showcase/${slug}`,
      noIndex: true,
    });
  }

  const parts = parseShowcaseParts(build.components);
  const cpu = parts.find((p) => p.kind === "cpu")?.name;
  const gpu = parts.find((p) => p.kind === "gpu")?.name;

  // Written from the row rather than a template: the two parts a buyer scans
  // for are the processor and the card, so they go in the description.
  const spec = [cpu, gpu].filter(Boolean).join(" + ");
  const description =
    [
      build.tagline ?? build.description?.slice(0, 110),
      spec ? `${spec}.` : null,
      `A gaming PC built by Yalman Gaming in Hafeez Centre, Lahore${
        build.target ? ` for ${build.target.toLowerCase()}` : ""
      }.`,
    ]
      .filter(Boolean)
      .join(" ") || `${build.name} — a gaming PC built by Yalman Gaming, Lahore.`;

  return pageMetadata({
    title: `${build.name} — ${build.tier ? `${build.tier} ` : ""}Gaming PC Build`,
    description,
    path: `/showcase/${build.slug}`,
    keywords: [
      "gaming PC Lahore",
      ...(gpu ? [`${gpu} PC Lahore`] : []),
      ...(build.tier ? [`${build.tier.toLowerCase()} gaming PC Pakistan`] : []),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function ShowcaseBuildPage({ params }: PageProps) {
  const { slug } = await params;

  // One query for the list (neighbours + a "more builds" rail) and one lookup
  // for this row. The table holds a handful of rows, so this is cheaper than
  // the round trips a cleverer approach would cost.
  const [build, builds] = await Promise.all([
    getShowcaseBuild(slug),
    getShowcaseBuilds(),
  ]);

  if (!build) notFound();

  const parts = orderedParts(parseShowcaseParts(build.components));
  const { previous, next } = neighbours(builds, build.slug);
  const sellable = await findSellableProduct(build.name);

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Built by Yalman", href: "/showcase" },
    { label: build.name },
  ];

  const whatsappMessage = `Hi Yalman Gaming — I am interested in the ${build.name} build from your website.`;

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: build.name,
            description:
              build.tagline ??
              build.description ??
              `${build.name}, a gaming PC built by Yalman Gaming in Lahore.`,
            path: `/showcase/${build.slug}`,
          }),
          breadcrumbJsonLd(crumbs),
        ]}
      />

      <PageHero
        eyebrow={build.tier ? `${build.tier} build` : "From the bench"}
        title={build.name}
        crumbs={crumbs}
        lede={build.tagline}
        actions={
          <>
            <ButtonLink href="/builder" variant="primary" size="lg">
              BUILD SOMETHING LIKE IT
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/quote" variant="outline" size="lg">
              ASK FOR A QUOTE
            </ButtonLink>
            <WhatsAppButton message={whatsappMessage} size="lg" />
          </>
        }
        aside={
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              {build.tier && <Badge tone={tierTone(build.tier)}>{build.tier}</Badge>}
              {build.target && <Badge tone="cyan">{build.target}</Badge>}
            </div>

            <div className="mt-4">
              {build.price !== null ? (
                <>
                  <p className="eyebrow mb-1.5">As specified</p>
                  <Price
                    price={build.price}
                    samplePrice={build.samplePrice}
                    size="xl"
                  />
                </>
              ) : (
                <p className="text-sm text-silver">
                  Price on request — call the shop and we will work it out with
                  you.
                </p>
              )}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-ash">
              Component prices move. Confirm the current figure with the shop
              before you travel.
            </p>
          </Card>
        }
      />

      <div className="container-page py-12 md:py-16">
        {build.price !== null && build.samplePrice && (
          <SamplePricingNote className="mb-8 max-w-3xl" />
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-12">
          <div className="min-w-0">
            {build.description && (
              <section aria-labelledby="why-this-build">
                <h2
                  id="why-this-build"
                  className="font-display text-xl font-semibold text-chrome sm:text-2xl"
                >
                  Why this one
                </h2>
                <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-silver">
                  {build.description}
                </p>
              </section>
            )}

            <section className="mt-12" aria-labelledby="parts">
              <h2
                id="parts"
                className="font-display text-xl font-semibold text-chrome sm:text-2xl"
              >
                Every part in it
              </h2>

              {parts.length === 0 ? (
                <p className="mt-4 text-sm text-ash">
                  The component list for this build has not been recorded yet.
                  Call the shop and we will read it out.
                </p>
              ) : (
                <dl className="mt-5 divide-y divide-[var(--color-line)] border-y border-line">
                  {parts.map((part) => (
                    <div
                      key={`${part.kind}-${part.name}`}
                      className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:gap-6"
                    >
                      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ash sm:w-40 sm:shrink-0">
                        {partLabel(part.kind)}
                      </dt>
                      <dd className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-chrome">
                        {part.name}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ash">
                Every part above is something we stock and fit. Swap any of them
                in the builder and it will re-check socket, clearance and
                wattage as you go.
              </p>
            </section>

            {sellable && (
              <section className="mt-12" aria-labelledby="buy-assembled">
                <h2
                  id="buy-assembled"
                  className="font-display text-xl font-semibold text-chrome sm:text-2xl"
                >
                  Buy it assembled
                </h2>
                <Card className="mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-chrome">
                      {sellable.name}
                    </p>
                    {sellable.headline && (
                      <p className="mt-1 text-sm leading-relaxed text-silver">
                        {sellable.headline}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <Price
                        price={sellable.price}
                        salePrice={sellable.salePrice}
                        samplePrice={sellable.samplePrice}
                        size="md"
                      />
                      <StockIndicator
                        stock={sellable.stock}
                        lowStockAt={sellable.lowStockAt ?? 3}
                        showCount
                      />
                    </div>
                  </div>
                  <ButtonLink
                    href={`/product/${sellable.slug}`}
                    variant="secondary"
                    size="md"
                    className="shrink-0"
                  >
                    View this PC
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                </Card>
              </section>
            )}
          </div>

          {/* --- Aside: other builds -------------------------------------- */}
          <aside className="mt-12 lg:sticky lg:top-28 lg:mt-0">
            <p className="eyebrow mb-3">Other builds</p>
            <ul className="space-y-2">
              {builds
                .filter((other) => other.slug !== build.slug)
                .map((other) => (
                  <li key={other.id}>
                    <Link
                      href={`/showcase/${other.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-white/[0.02]"
                    >
                      <Cpu
                        className="h-4 w-4 shrink-0 text-ash"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold text-chrome transition-colors group-hover:text-white">
                          {other.name}
                        </span>
                        {other.target && (
                          <span className="block truncate text-xs text-ash">
                            {other.target}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>

            <ButtonLink
              href="/showcase"
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
            >
              See all builds
            </ButtonLink>
          </aside>
        </div>

        {/* --- Previous / next ------------------------------------------- */}
        {(previous || next) && (
          <nav
            aria-label="Other builds"
            className="mt-14 grid gap-3 border-t border-line pt-8 sm:grid-cols-2"
          >
            {previous ? (
              <Link
                href={`/showcase/${previous.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-line px-4 py-3.5 transition-colors hover:border-line-strong"
              >
                <ArrowLeft
                  className="h-4 w-4 shrink-0 text-ash transition-colors group-hover:text-cyan"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-ash">A step down</span>
                  <span className="block truncate font-display text-sm font-semibold text-chrome">
                    {previous.name}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}

            {next && (
              <Link
                href={`/showcase/${next.slug}`}
                className="group flex items-center justify-end gap-3 rounded-xl border border-line px-4 py-3.5 text-right transition-colors hover:border-line-strong sm:col-start-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-ash">A step up</span>
                  <span className="block truncate font-display text-sm font-semibold text-chrome">
                    {next.name}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-ash transition-colors group-hover:text-cyan"
                  aria-hidden="true"
                />
              </Link>
            )}
          </nav>
        )}

        <TalkToUs
          className="mt-12"
          title={`Want the ${build.name}, changed?`}
          description="Different card, more storage, a quieter case — tell us what you would change and we will price it before you commit to anything."
          message={whatsappMessage}
        />

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ash">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Prefer to see it in person? We are on the 3rd floor of Hafeez Centre.
        </p>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sellable twin                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Finds the catalogue product that *is* this machine.
 *
 * Matched on an exact, case-insensitive name and a `prebuilt` kind — never on a
 * fuzzy search hit. Linking a visitor to a different computer because two names
 * shared a word would be worse than not linking at all, so a near miss returns
 * nothing.
 */
async function findSellableProduct(
  name: string,
): Promise<ProductCardData | null> {
  const results = await searchProducts(name, 8);
  const needle = name.trim().toLowerCase();
  return (
    results.find(
      (item) => item.kind === "prebuilt" && item.name.trim().toLowerCase() === needle,
    ) ?? null
  );
}
