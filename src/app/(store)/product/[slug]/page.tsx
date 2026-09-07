import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  MessageSquare,
  Puzzle,
  ShieldCheck,
} from "lucide-react";

import { AddToBuildButton } from "@/components/shop/AddToBuildButton";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "@/components/shop/Breadcrumbs";
import {
  AddToCartButton,
  BuyNowButton,
  CompareToggleButton,
  WishlistButton,
} from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductRail } from "@/components/shop/ProductGrid";
import {
  SpecificationTable,
  derivedSpecRows,
  mergeSpecRows,
} from "@/components/shop/SpecificationTable";
import { StockAlertForm } from "@/components/shop/StockAlertForm";
import {
  Badge,
  Divider,
  EmptyState,
  Price,
  Rating,
  SamplePricingNote,
  SpecList,
  StockIndicator,
} from "@/components/ui";
import { getProductBySlug, getRelatedProducts, type FullProduct } from "@/lib/catalog";
import { siteConfig } from "@/lib/site";
import { KIND_META, isComponentKind, stockState, type BuilderPart } from "@/lib/types";
import { formatDate, formatPKR } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

// Stock and pricing must be live on a page that takes an order.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }

  const brand = product.brand?.name ? `${product.brand.name} ` : "";
  const description =
    product.headline ??
    product.description?.slice(0, 155) ??
    `${brand}${product.name} at Yalman Gaming, Hafeez Centre, Lahore.`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `${siteConfig.url}/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/product/${product.slug}`,
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 10);

  const meta = isComponentKind(product.kind) ? KIND_META[product.kind] : null;
  const state = stockState(product.stock, product.lowStockAt);
  const soldOut = state === "out-of-stock";

  const specRows = mergeSpecRows(product.specRows, derivedSpecRows(product));
  const notes = compatibilityNotes(product.builderPart);

  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    ...(product.category
      ? [{ label: product.category.name, href: `/shop/${product.category.slug}` }]
      : meta
        ? [{ label: meta.plural, href: `/shop/${product.kind}` }]
        : []),
    { label: product.name },
  ];

  return (
    <div className="container-page py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(product)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
      />

      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        {/* --- Media ------------------------------------------------------ */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery
            images={product.images}
            name={product.name}
            kind={product.kind}
          />
        </div>

        {/* --- Buy box ---------------------------------------------------- */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
              {product.brand?.name && (
                <span className="text-silver">{product.brand.name}</span>
              )}
              {meta && <span>{meta.label}</span>}
              <span className="tnum">SKU {product.sku}</span>
            </p>

            <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-chrome sm:text-3xl">
              {product.name}
            </h1>

            {product.headline && (
              <p className="mt-3 text-base leading-relaxed text-silver">
                {product.headline}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {product.reviewCount > 0 && (
                <Rating value={product.rating} count={product.reviewCount} />
              )}
              {product.isNew && <Badge tone="cyan">New</Badge>}
              {product.onDeal && <Badge tone="ember">Deal</Badge>}
              {product.builderPart.rgb && <Badge tone="violet">RGB</Badge>}
            </div>
          </div>

          <div>
            <Price
              price={product.price}
              salePrice={product.salePrice}
              samplePrice={product.samplePrice}
              size="xl"
            />
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <StockIndicator
                stock={product.stock}
                lowStockAt={product.lowStockAt}
                showCount
              />
              {soldOut && (
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-rose">
                  Out of stock
                </span>
              )}
            </div>
          </div>

          {product.samplePrice && <SamplePricingNote />}

          {/* Warranty is shown only when the catalogue records one — nothing
              about coverage is ever assumed. */}
          {product.warranty && (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm text-silver">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
              <span>
                <span className="font-semibold text-chrome">Warranty:</span>{" "}
                {product.warranty}
              </span>
            </p>
          )}

          {/* --- CTAs ----------------------------------------------------- */}
          {soldOut ? (
            <div id="notify" className="scroll-mt-28">
              <StockAlertForm productId={product.id} productName={product.name} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <AddToCartButton product={product.card} size="lg" />
              <BuyNowButton product={product.card} />
              <AddToBuildButton part={product.builderPart} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <CompareToggleButton
              productId={product.id}
              productName={product.name}
              variant="full"
            />
            <WishlistButton productId={product.id} productName={product.name} />
          </div>

          {/* --- Key specs ------------------------------------------------ */}
          {specRows.length > 0 && (
            <section aria-labelledby="key-specs">
              <h2
                id="key-specs"
                className="mb-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-cyan"
              >
                At a glance
              </h2>
              <SpecList
                rows={specRows.slice(0, 6).map((row) => ({
                  label: row.label,
                  value: row.value,
                }))}
              />
            </section>
          )}
        </div>
      </div>

      {/* --- Long-form ---------------------------------------------------- */}
      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div className="flex flex-col gap-12">
          {product.description && (
            <section aria-labelledby="overview">
              <SectionTitle id="overview">Overview</SectionTitle>
              <div className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-silver">
                {product.description}
              </div>
            </section>
          )}

          {specRows.length > 0 && (
            <section aria-labelledby="specifications">
              <SectionTitle id="specifications">Specifications</SectionTitle>
              <SpecificationTable rows={specRows} className="mt-4" />
            </section>
          )}

          {product.benchmarks.length > 0 && (
            <section aria-labelledby="benchmarks">
              <SectionTitle id="benchmarks" icon={<Activity className="h-4 w-4" />}>
                Measured performance
              </SectionTitle>
              <BenchmarkTable benchmarks={product.benchmarks} />
            </section>
          )}

          <section aria-labelledby="reviews">
            <SectionTitle id="reviews" icon={<MessageSquare className="h-4 w-4" />}>
              Reviews
            </SectionTitle>
            <ReviewList reviews={product.reviews} />
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          {notes.length > 0 && (
            <section aria-labelledby="compatibility">
              <SectionTitle id="compatibility" icon={<Puzzle className="h-4 w-4" />}>
                Compatibility
              </SectionTitle>
              <div className="metal mt-4 rounded-2xl p-4">
                <SpecList rows={notes} />
                <p className="mt-3 text-xs leading-relaxed text-ash">
                  Add this part to a build and the builder checks it against
                  everything else you have picked — socket, clearance, connectors
                  and power draw.
                </p>
                <Link
                  href="/builder"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-line-strong text-xs font-semibold tracking-wide text-chrome transition-colors hover:border-cyan/60 hover:text-white"
                >
                  OPEN THE BUILDER
                </Link>
              </div>
            </section>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-16">
          <Divider />
          <SectionTitle id="related">You may also consider</SectionTitle>
          <ProductRail products={related} className="mt-5" />
        </section>
      )}

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  id,
  children,
  icon,
}: {
  id: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-chrome"
    >
      {icon && <span className="text-cyan">{icon}</span>}
      {children}
    </h2>
  );
}

/**
 * Compatibility facts pulled straight from the structured columns. Nothing is
 * computed or estimated here — the builder does that once there is a whole
 * machine to reason about.
 */
function compatibilityNotes(part: BuilderPart): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value: String(value) });
  };

  switch (part.kind) {
    case "cpu":
      push("Socket", part.socket);
      push("TDP", part.tdp ? `${part.tdp} W` : null);
      push("Integrated graphics", part.integratedGraphics ? "Yes" : "No");
      break;
    case "motherboard":
      push("Socket", part.socket);
      push("Chipset", part.chipset);
      push("Memory", part.memoryType);
      push("DIMM slots", part.memorySlots);
      push("Max memory", part.maxMemoryGb ? `${part.maxMemoryGb} GB` : null);
      push("Form factor", part.formFactor);
      push("M.2 slots", part.m2Slots);
      push("SATA ports", part.sataPorts);
      break;
    case "gpu":
      push("Length", part.gpuLengthMm ? `${part.gpuLengthMm} mm` : null);
      push("Recommended PSU", part.recommendedPsuW ? `${part.recommendedPsuW} W` : null);
      push("Power connectors", part.requiredConnectors?.join(" + ") ?? null);
      push("Board power", part.tdp ? `${part.tdp} W` : null);
      break;
    case "ram":
      push("Type", part.memoryType);
      push("Speed", part.memorySpeed ? `${part.memorySpeed} MT/s` : null);
      push("Kit", part.moduleCount ? `${part.moduleCount} modules` : null);
      push("Capacity", part.capacityGb ? `${part.capacityGb} GB` : null);
      break;
    case "storage":
      push("Interface", part.storageInterface);
      push("Capacity", part.capacityGb ? `${part.capacityGb} GB` : null);
      break;
    case "psu":
      push("Output", part.wattage ? `${part.wattage} W` : null);
      push("Efficiency", part.efficiency);
      push("Form factor", part.psuFormFactor);
      push("Depth", part.psuLengthMm ? `${part.psuLengthMm} mm` : null);
      if (part.providedConnectors) {
        for (const [key, count] of Object.entries(part.providedConnectors)) {
          push(`${key} connectors`, count);
        }
      }
      break;
    case "cooler":
      push("Type", part.coolerType === "aio" ? "Liquid (AIO)" : "Air");
      push("Sockets", part.supportedSockets?.join(", ") ?? null);
      push("Height", part.coolerHeightMm ? `${part.coolerHeightMm} mm` : null);
      push("Radiator", part.radiatorSizeMm ? `${part.radiatorSizeMm} mm` : null);
      push("Rated for", part.coolingCapacityW ? `${part.coolingCapacityW} W` : null);
      break;
    case "case":
      push("Board support", part.supportedFormFactors?.join(", ") ?? null);
      push("Max GPU length", part.maxGpuLengthMm ? `${part.maxGpuLengthMm} mm` : null);
      push(
        "Max cooler height",
        part.maxCoolerHeightMm ? `${part.maxCoolerHeightMm} mm` : null,
      );
      push("Max PSU depth", part.maxPsuLengthMm ? `${part.maxPsuLengthMm} mm` : null);
      if (part.radiatorSupport) {
        for (const [position, size] of Object.entries(part.radiatorSupport)) {
          push(`Radiator — ${position}`, `${size} mm`);
        }
      }
      push("Included fans", part.includedFans);
      push("Dimensions", part.dimensionsMm ? `${part.dimensionsMm} mm` : null);
      break;
    default:
      break;
  }

  return rows;
}

function BenchmarkTable({
  benchmarks,
}: {
  benchmarks: FullProduct["benchmarks"];
}) {
  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-white/[0.03] font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
              <th scope="col" className="px-4 py-2.5 font-medium">Game</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Settings</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Avg FPS</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">1% low</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-2.5 text-chrome">{row.game}</td>
                <td className="tnum px-4 py-2.5 font-mono text-silver">
                  {row.resolution} · {row.preset}
                </td>
                <td className="tnum px-4 py-2.5 text-right font-mono font-semibold text-chrome">
                  {row.avgFps}
                </td>
                <td className="tnum px-4 py-2.5 text-right font-mono text-silver">
                  {row.onePercentLow ?? "—"}
                </td>
                {/* Every figure carries where it came from. A benchmark without
                    a source has no business being on the page. */}
                <td className="px-4 py-2.5 text-xs text-ash">
                  {row.source}
                  {row.cpuContext && (
                    <span className="block text-[0.6875rem]">with {row.cpuContext}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ash">
        Figures are as recorded by the stated source. Your results depend on the
        rest of the system, drivers and in-game settings.
      </p>
    </div>
  );
}

function ReviewList({ reviews }: { reviews: FullProduct["reviews"] }) {
  if (!reviews.length) {
    return (
      <EmptyState
        className="mt-4"
        icon={<MessageSquare className="h-7 w-7" aria-hidden="true" />}
        title="No published reviews for this product yet"
        description="Reviews appear here once Yalman Gaming publishes them."
      />
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-4">
      {reviews.map((review) => (
        <li key={review.id} className="metal rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Rating value={review.rating} size="sm" showValue={false} />
            <p className="text-sm font-semibold text-chrome">{review.authorName}</p>
            {review.verified && (
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-emerald">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified purchase
              </span>
            )}
            <time
              dateTime={review.createdAt.toISOString()}
              className="tnum ml-auto text-xs text-ash"
            >
              {formatDate(review.createdAt)}
            </time>
          </div>
          {review.title && (
            <p className="mt-2 font-display text-sm font-semibold text-chrome">
              {review.title}
            </p>
          )}
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-silver">
            {review.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Structured data                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `Product` structured data.
 *
 * `offers` is emitted **only** when the price is not seeded sample data —
 * publishing a placeholder figure as a machine-readable offer would put a price
 * Yalman Gaming has not confirmed into search results.
 */
function productJsonLd(product: FullProduct) {
  const paying =
    product.salePrice && product.salePrice > 0 && product.salePrice < product.price
      ? product.salePrice
      : product.price;

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description:
      product.headline ?? product.description ?? `${product.name} at ${siteConfig.name}`,
    url: `${siteConfig.url}/product/${product.slug}`,
    ...(product.images.length ? { image: product.images.map((i) => i.url) } : {}),
    ...(product.brand?.name
      ? { brand: { "@type": "Brand", name: product.brand.name } }
      : {}),
    ...(product.category?.name ? { category: product.category.name } : {}),
  };

  if (product.reviewCount > 0 && product.rating > 0) {
    base.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
    };
  }

  if (!product.samplePrice) {
    base.offers = {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: paying,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/product/${product.slug}`,
      seller: { "@type": "Organization", name: siteConfig.name },
    };
  } else {
    // Human-readable price stays on the page; the machine-readable claim does
    // not. `formatPKR` keeps the two consistent for anyone reading the source.
    base.disambiguatingDescription = `Indicative price ${formatPKR(paying)} — confirm with ${siteConfig.name}.`;
  }

  return base;
}
