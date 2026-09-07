import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "@/components/shop/Breadcrumbs";
import { CategoryCard } from "@/components/shop/CategoryCard";
import {
  ActiveFilterChips,
  FilterSidebar,
  MobileFilters,
  ResultCount,
} from "@/components/shop/FilterSidebar";
import { Pagination } from "@/components/shop/Pagination";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { SortSelect } from "@/components/shop/SortSelect";
import { SamplePricingNote } from "@/components/ui";
import {
  getCategoryScope,
  getCategoryTree,
  getProducts,
  type CategoryNode,
} from "@/lib/catalog";
import { parseProductQuery } from "@/lib/filters";
import { siteConfig } from "@/lib/site";

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const scope = await getCategoryScope(category);

  if (!scope) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const title = `${scope.name} in Lahore`;
  const description =
    scope.description ??
    `Browse ${scope.name.toLowerCase()} at Yalman Gaming — Hafeez Centre, Gulberg III, Lahore. Filter by brand, price and specification.`;

  return {
    title,
    description,
    alternates: { canonical: `${siteConfig.url}/shop/${scope.slug}` },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/shop/${scope.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ category }, rawSearch] = await Promise.all([params, searchParams]);

  const scope = await getCategoryScope(category);
  if (!scope) notFound();

  const basePath = `/shop/${scope.slug}`;
  const query = parseProductQuery(rawSearch, scope.slug);

  const [result, tree] = await Promise.all([getProducts(query), getCategoryTree()]);

  // Child categories, so a broad listing still offers a way further in.
  const related = findNode(tree, scope.slug)?.children ?? [];

  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    ...scope.ancestors.map((a) => ({ label: a.name, href: `/shop/${a.slug}` })),
    { label: scope.name },
  ];

  const hasSamplePrices = result.items.some((item) => item.samplePrice);

  return (
    <div className="container-page py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
      />

      <Breadcrumbs items={crumbs} />

      <header className="mt-4 flex flex-col gap-3">
        <p className="eyebrow">Category</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          {scope.name}
        </h1>
        {scope.description && (
          <p className="max-w-2xl text-base leading-relaxed text-silver">
            {scope.description}
          </p>
        )}
      </header>

      {related.length > 0 && (
        <nav aria-label="Sub-categories" className="mt-6">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {related.slice(0, 12).map((child) => (
              <li key={child.id}>
                <CategoryCard category={child} compact />
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <FilterSidebar
          query={query}
          facets={result.facets}
          basePath={basePath}
          total={result.total}
        />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <MobileFilters
              query={query}
              facets={result.facets}
              basePath={basePath}
              total={result.total}
            />
            <ResultCount
              total={result.total}
              page={result.page}
              perPage={result.perPage}
            />
            <SortSelect query={query} basePath={basePath} className="ml-auto" />
          </div>

          <ActiveFilterChips
            query={query}
            basePath={basePath}
            facets={result.facets}
            className="mt-4"
          />

          {hasSamplePrices && <SamplePricingNote className="mt-4" />}

          <ProductGrid products={result.items} columns={4} className="mt-6" />

          <Pagination
            query={query}
            basePath={basePath}
            page={result.page}
            pageCount={result.pageCount}
            className="mt-10"
          />
        </div>
      </div>

    </div>
  );
}

/** Depth-first search of the category tree. */
function findNode(nodes: CategoryNode[], slug: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findNode(node.children, slug);
    if (found) return found;
  }
  return null;
}
