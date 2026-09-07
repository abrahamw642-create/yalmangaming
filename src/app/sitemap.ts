/**
 * `/sitemap.xml`
 *
 * Every URL a crawler should spend budget on: the static pages worth ranking,
 * every active product, every browse category, and every showcased build.
 *
 * What is deliberately absent, and why:
 *
 *  - `/cart`, `/checkout`, `/checkout/success/*` — personal, transient, and
 *    useless as a search result.
 *  - `/build/[shareCode]` — a share link belongs to whoever it was sent to.
 *    Listing them would publish private configurations.
 *  - `/admin/*` and `/api/*` — also disallowed in `robots.ts`.
 *  - Anything in `DRAFT_POLICY_PATHS`. Those pages emit `noindex` while their
 *    terms are unwritten, and a sitemap that lists a noindexed URL sends two
 *    contradictory signals. One array governs both; see `@/lib/seo`.
 *  - Filtered and paginated listings (`?brand=…&page=2`). They all canonicalise
 *    to the base category, so listing them would be listing duplicates.
 */

import type { MetadataRoute } from "next";
import { getShowcaseSlugs } from "@/components/content/showcase";
import { getCategoryTree, type CategoryNode } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { absoluteUrl, isDraftPolicyPath } from "@/lib/seo";

/** The catalogue changes in the shop, not at build time. */
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Hand-ranked because a shop's own sense of what matters beats any heuristic:
 * the builder is the signature feature and the shop front is the shop front.
 */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] =
  [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/builder", priority: 0.9, changeFrequency: "weekly" },
    { path: "/deals", priority: 0.8, changeFrequency: "daily" },
    { path: "/showcase", priority: 0.8, changeFrequency: "weekly" },
    { path: "/assembly", priority: 0.7, changeFrequency: "monthly" },
    { path: "/quote", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/builder/recommend", priority: 0.6, changeFrequency: "monthly" },
    { path: "/compare", priority: 0.3, changeFrequency: "monthly" },
    { path: "/warranty", priority: 0.3, changeFrequency: "yearly" },
    { path: "/returns", priority: 0.3, changeFrequency: "yearly" },
    { path: "/shipping", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

/** Depth-first walk so nested categories (`components → graphics-cards`) appear. */
function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // `getProductSlugs` in `@/lib/catalog` returns slugs without a timestamp, and
  // `lastModified` is the one field in a sitemap that is worth being accurate
  // about — so this reads the two columns directly. The `status` filter must
  // stay in step with `PUBLIC_STATUS` there: only `active` products are public.
  const [products, tree, showcase] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5_000,
    }),
    getCategoryTree(),
    getShowcaseSlugs(),
  ]);

  // The freshest product edit is the best available proxy for "when did the
  // shop last change" on the pages that list products.
  const catalogueTouched = products[0]?.updatedAt ?? new Date();

  const staticEntries: Entry[] = STATIC_ROUTES.filter(
    (route) => !isDraftPolicyPath(route.path),
  ).map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: catalogueTouched,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const categoryEntries: Entry[] = flattenCategories(tree)
    // A category with nothing in it is a dead end for a crawler and for a
    // shopper; it comes back into the sitemap when it has stock.
    .filter((node) => node.productCount > 0)
    .map((node) => ({
      url: absoluteUrl(node.href),
      lastModified: catalogueTouched,
      changeFrequency: "daily" as const,
      priority: node.children.length > 0 ? 0.8 : 0.7,
    }));

  const productEntries: Entry[] = products.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const showcaseEntries: Entry[] = showcase.map((slug) => ({
    url: absoluteUrl(`/showcase/${slug}`),
    lastModified: catalogueTouched,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // A duplicate URL in a sitemap is a warning in Search Console; category
  // aliases and hand-listed routes can collide, so the last write wins once.
  const byUrl = new Map<string, Entry>();
  for (const entry of [
    ...staticEntries,
    ...categoryEntries,
    ...showcaseEntries,
    ...productEntries,
  ]) {
    byUrl.set(entry.url, entry);
  }

  return [...byUrl.values()];
}
