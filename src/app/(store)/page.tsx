/**
 * The home page.
 *
 * A Server Component that does every read up front and hands each section a
 * finished, serialisable payload. Nothing below fetches its own data, and no
 * section is a client component unless it needs to be — the interactive leaves
 * are the hero's WebGL stage, the pointer-reactive category tiles, the product
 * rails and the newsletter form. Everything else is HTML.
 *
 * The store layout owns `<main id="main">`, so this page deliberately renders
 * no `<main>` of its own, and the footer belongs to the chrome area.
 *
 * Section order is fixed by the brief:
 *   1 Hero (3D)            7 Built by Yalman
 *   2 Featured products    8 New arrivals
 *   3 Build your own PC    9 Deals
 *   4 Shop by category    10 Customer reviews
 *   5 Gaming PCs          11 Visit the store
 *   6 Why Yalman          12 Stock alerts
 */

import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import { JsonLd } from "@/components/content/JsonLd";
import { newsletterSchema } from "@/components/content/forms";
import { SamplePricingNote } from "@/components/ui";
import { BuildYourPC } from "@/components/home/BuildYourPC";
import {
  BuiltByYalman,
  type ShowcaseCardData,
} from "@/components/home/BuiltByYalman";
import { DealsStrip } from "@/components/home/DealsStrip";
import { FeaturedGamingPCs } from "@/components/home/FeaturedGamingPCs";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Hero } from "@/components/home/Hero";
import { NewArrivals } from "@/components/home/NewArrivals";
import type { NewsletterState } from "@/components/home/NewsletterSignup";
import type { HomeCategory } from "@/components/home/ShopByCategory";
import { StoreLocation } from "@/components/home/StoreLocation";
import { TrustSection, type HomeReview } from "@/components/home/TrustSection";
import { WhyYalman } from "@/components/home/WhyYalman";
import { getCategoryTree, getFeaturedProducts, getProducts } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import type { ProductCardData } from "@/lib/filters";
import { pageMetadata, websiteJsonLd } from "@/lib/seo";

/**
 * Stock levels, sale prices and the deals rail are all per-request facts. A
 * home page captured at build time would show yesterday's availability, which
 * for a single physical shop is worse than no number at all.
 */
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Deferred client sections                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The two interactive sections that live well below the fold are pulled in
 * through `next/dynamic`, which puts their client code in its own chunk instead
 * of the route's initial hydration payload. `ssr` is left on — deliberately.
 * These sections still render as server HTML, so the category links are in the
 * document for a crawler and the signup form works before any JavaScript
 * arrives; only their *hydration* is deferred, which is the part that costs the
 * visitor something. Turning SSR off here would trade real content for a
 * spinner nobody scrolls far enough to see.
 *
 * (`dynamic` is already the name of this route's rendering-mode export, hence
 * the import alias.)
 */
const ShopByCategory = dynamicImport(
  () => import("@/components/home/ShopByCategory"),
);

const NewsletterSignup = dynamicImport(
  () => import("@/components/home/NewsletterSignup"),
);

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Gaming PCs & Custom PC Builder in Lahore",
    // Written for a person deciding whether to click, not for a crawler
    // counting keywords. It says what the shop is, where it is, and what you
    // can do here — which happens to be the same thing the query is asking.
    description:
      "Yalman Gaming builds and sells gaming PCs, graphics cards, processors and accessories from Hafeez Centre, Gulberg III, Lahore. Configure a custom build online with live compatibility and wattage checks, or come in and talk it through.",
    path: "/",
    keywords: [
      "gaming PC Hafeez Centre",
      "custom PC builder Lahore",
      "buy gaming PC Lahore",
      "PC parts Lahore",
      "graphics card Lahore",
      "prebuilt gaming PC Pakistan",
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Newsletter action                                                          */
/* -------------------------------------------------------------------------- */

const NEWSLETTER_THANKS =
  "You're on the list. We'll email you when new stock lands.";

/**
 * Server Action behind the stock-alert form.
 *
 * Defined here rather than in the client component because a Server Action has
 * to live in server code; it is passed down as a prop, which is what lets the
 * form work before — and without — hydration.
 *
 * `upsert` rather than `create`: `NewsletterSignup.email` is unique, and
 * someone signing up twice should be thanked, not shown a database error.
 */
async function subscribeToNewsletter(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  "use server";

  // Honeypot. Only a script fills a field positioned off-screen and hidden
  // from assistive tech, so report success and write nothing — an error would
  // just tell the bot to try a different shape.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim().length > 0) {
    return { status: "ok", message: NEWSLETTER_THANKS };
  }

  const parsed = newsletterSchema.safeParse({
    email: formData.get("email") ?? "",
    website: "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  try {
    await prisma.newsletterSignup.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });
    return { status: "ok", message: NEWSLETTER_THANKS };
  } catch (error) {
    // Never surface a database error to a shopper; give them a way through.
    console.error("[home] newsletter signup failed", error);
    return {
      status: "error",
      message:
        "We could not save that just now. Message us on WhatsApp and we will add you.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

/** Prebuilt machines fill three cells; the fourth is the builder CTA tile. */
const GAMING_PC_COUNT = 3;
const FEATURED_COUNT = 10;
const NEW_ARRIVAL_COUNT = 10;
const DEAL_COUNT = 4;
const SECONDARY_CATEGORY_COUNT = 6;

/** A section that fails to load must not take the whole front door down. */
async function safely<T>(label: string, work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    console.error(`[home] could not load ${label}`, error);
    return fallback;
  }
}

const EMPTY_PRODUCTS: ProductCardData[] = [];

export default async function HomePage() {
  const [
    featured,
    gamingPcs,
    flaggedNew,
    newest,
    deals,
    categoryTree,
    showcase,
    reviews,
  ] = await Promise.all([
    safely("featured products", () => getFeaturedProducts(FEATURED_COUNT), EMPTY_PRODUCTS),
    safely(
      "gaming PCs",
      async () =>
        (await getProducts({ kind: "prebuilt", limit: GAMING_PC_COUNT })).items,
      EMPTY_PRODUCTS,
    ),
    safely(
      "new arrivals",
      async () =>
        (
          await getProducts({
            isNew: true,
            sort: "newest",
            limit: NEW_ARRIVAL_COUNT,
          })
        ).items,
      EMPTY_PRODUCTS,
    ),
    // Fetched alongside rather than after: if nothing carries the "new" flag
    // the rail falls back to the most recently added stock, and one extra
    // query against a 200-row catalogue is cheaper than a second round trip.
    safely(
      "newest products",
      async () =>
        (await getProducts({ sort: "newest", limit: NEW_ARRIVAL_COUNT })).items,
      EMPTY_PRODUCTS,
    ),
    safely(
      "deals",
      async () => (await getProducts({ onDeal: true, limit: DEAL_COUNT })).items,
      EMPTY_PRODUCTS,
    ),
    safely("categories", () => getCategoryTree(), []),
    safely("showcase builds", loadShowcase, [] as ShowcaseCardData[]),
    safely("reviews", loadReviews, [] as HomeReview[]),
  ]);

  const usingNewFallback = flaggedNew.length === 0;
  const newArrivals = usingNewFallback ? newest : flaggedNew;

  /* --- Categories -------------------------------------------------------- */

  // Top-level departments become the large tiles, named with a few of the
  // things inside them so the tile says more than its own heading.
  const primaryCategories: HomeCategory[] = categoryTree.map((node) => ({
    id: node.id,
    name: node.name,
    href: node.href,
    description: node.description,
    kind: node.kind,
    icon: node.icon,
    accent: node.accent,
    productCount: node.productCount,
    highlights: node.children.slice(0, 3).map((child) => child.name),
  }));

  // The compact row underneath is whatever the catalogue itself flags as a
  // featured sub-category and actually has stock behind it — merchandising
  // stays in the database rather than being hard-coded here.
  const secondaryCategories: HomeCategory[] = categoryTree
    .flatMap((node) => node.children)
    .filter((child) => child.featured && child.productCount > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, SECONDARY_CATEGORY_COUNT)
    .map((child) => ({
      id: child.id,
      name: child.name,
      href: child.href,
      description: child.description,
      kind: child.kind,
      icon: child.icon,
      accent: child.accent,
      productCount: child.productCount,
    }));

  /* --- Sample pricing ---------------------------------------------------- */

  const showsSamplePricing =
    [featured, gamingPcs, newArrivals, deals].some((list) =>
      list.some((product) => product.samplePrice),
    ) || showcase.some((build) => build.price !== null && build.samplePrice);

  return (
    <>
      {/* The site-level entry with a search action. The root layout already
          emits the ComputerStore graph, so the rating is not repeated here. */}
      <JsonLd data={websiteJsonLd()} />

      {/* 1 */}
      <Hero />

      {/* 2 */}
      <FeaturedProducts products={featured} />

      {showsSamplePricing && (
        <div className="container-page -mt-8 mb-4 md:-mt-12">
          {/* Once per page, as close as possible to the first prices on it. */}
          <SamplePricingNote className="mx-auto max-w-3xl" />
        </div>
      )}

      {/* 3 */}
      <BuildYourPC />

      {/* 4 */}
      <ShopByCategory
        primary={primaryCategories}
        secondary={secondaryCategories}
      />

      {/* 5 */}
      <FeaturedGamingPCs products={gamingPcs} />

      {/* 6 */}
      <WhyYalman />

      {/* 7 */}
      <BuiltByYalman builds={showcase} />

      {/* 8 */}
      <NewArrivals products={newArrivals} fallback={usingNewFallback} />

      {/* 9 */}
      <DealsStrip products={deals} />

      {/* 10 */}
      <TrustSection reviews={reviews} />

      {/* 11 */}
      <StoreLocation />

      {/* 12 */}
      <NewsletterSignup action={subscribeToNewsletter} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Queries that have no home in `@/lib/catalog`                               */
/* -------------------------------------------------------------------------- */

/**
 * The "Built by Yalman" machines. `sortOrder` is the merchandising order the
 * admin controls; featured rows come first within it.
 */
async function loadShowcase(): Promise<ShowcaseCardData[]> {
  const rows = await prisma.showcaseBuild.findMany({
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    take: 3,
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      tier: true,
      target: true,
      price: true,
      samplePrice: true,
      components: true,
      accent: true,
      imageUrl: true,
    },
  });
  return rows;
}

/**
 * Approved customer reviews.
 *
 * There are none — the seed creates zero `Review` rows on purpose, because the
 * store's 95 reviews live on Google and this site has none of their wording.
 * The query is real anyway: the moment Yalman approves one from the admin it
 * appears on the home page, and until then `TrustSection` renders its designed
 * empty state rather than anything invented.
 */
async function loadReviews(): Promise<HomeReview[]> {
  const rows = await prisma.review.findMany({
    where: { approved: true, rating: { gte: 4 } },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      authorName: true,
      rating: true,
      title: true,
      body: true,
      verified: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    verified: row.verified,
    createdAt: row.createdAt.toISOString(),
    productName: row.product?.name ?? null,
    productSlug: row.product?.slug ?? null,
  }));
}
