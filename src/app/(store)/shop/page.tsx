import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
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
import { getCategoryTree, getProducts } from "@/lib/catalog";
import { countActiveFilters, parseProductQuery } from "@/lib/filters";
import { siteConfig } from "@/lib/site";

const BASE_PATH = "/shop";

export const metadata: Metadata = {
  title: "Shop All Products",
  description:
    "Browse every gaming PC, component and accessory Yalman Gaming stocks — filter by brand, price, socket, VRAM and more.",
  alternates: { canonical: `${siteConfig.url}${BASE_PATH}` },
};

export default async function ShopPage({
  searchParams,
}: {
  // Next 15: search params arrive as a promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseProductQuery(params);

  const [result, categories] = await Promise.all([
    getProducts(query),
    getCategoryTree(),
  ]);

  const filtered = countActiveFilters(query) > 0 || !!query.q;
  const hasSamplePrices = result.items.some((item) => item.samplePrice);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />

      <header className="mt-4 flex flex-col gap-3">
        <p className="eyebrow">The Catalogue</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          {query.q ? `Results for “${query.q}”` : "Shop All Products"}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-silver">
          Gaming PCs, components and peripherals in stock at Hafeez Centre.
          Filter down to exactly the part you need, or start from a blank build.
        </p>
      </header>

      {/* Category shortcuts — only while browsing, not mid-filter. */}
      {!filtered && categories.length > 0 && (
        <nav aria-label="Browse categories" className="mt-8">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 12).map((category) => (
              <li key={category.id}>
                <CategoryCard category={category} compact />
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <FilterSidebar
          query={query}
          facets={result.facets}
          basePath={BASE_PATH}
          total={result.total}
        />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <MobileFilters
              query={query}
              facets={result.facets}
              basePath={BASE_PATH}
              total={result.total}
            />
            <ResultCount
              total={result.total}
              page={result.page}
              perPage={result.perPage}
            />
            <SortSelect query={query} basePath={BASE_PATH} className="ml-auto" />
          </div>

          <ActiveFilterChips
            query={query}
            basePath={BASE_PATH}
            facets={result.facets}
            className="mt-4"
          />

          {hasSamplePrices && <SamplePricingNote className="mt-4" />}

          <ProductGrid products={result.items} columns={4} className="mt-6" />

          <Pagination
            query={query}
            basePath={BASE_PATH}
            page={result.page}
            pageCount={result.pageCount}
            className="mt-10"
          />
        </div>
      </div>

    </div>
  );
}
