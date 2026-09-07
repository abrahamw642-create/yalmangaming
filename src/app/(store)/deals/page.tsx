import type { Metadata } from "next";
import { Tag } from "lucide-react";

import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import {
  ActiveFilterChips,
  FilterSidebar,
  MobileFilters,
  ResultCount,
} from "@/components/shop/FilterSidebar";
import { Pagination } from "@/components/shop/Pagination";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { SortSelect } from "@/components/shop/SortSelect";
import { EmptyState, SamplePricingNote } from "@/components/ui";
import { getProducts } from "@/lib/catalog";
import { parseProductQuery } from "@/lib/filters";
import { siteConfig } from "@/lib/site";

const BASE_PATH = "/deals";

export const metadata: Metadata = {
  title: "Deals",
  description:
    "Discounted gaming PCs, components and accessories currently on offer at Yalman Gaming, Hafeez Centre, Lahore.",
  alternates: { canonical: `${siteConfig.url}${BASE_PATH}` },
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // The query in the URL drives the controls; the deal constraint is a property
  // of the route rather than a filter, so it is added on the way to the
  // database only — otherwise every link here would carry a redundant `deal=1`
  // and the sidebar would offer to remove the thing the page is about.
  const query = parseProductQuery(params);
  const result = await getProducts({ ...query, onDeal: true });

  const hasSamplePrices = result.items.some((item) => item.samplePrice);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Deals" }]} />

      <header className="mt-4 flex flex-col gap-3">
        <p className="eyebrow">Current offers</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          Deals
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-silver">
          Everything currently discounted or flagged as a deal. Prices and
          availability change — confirm before you travel to the shop.
        </p>
      </header>

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

          <ProductGrid
            products={result.items}
            columns={4}
            className="mt-6"
            empty={
              <EmptyState
                icon={<Tag className="h-8 w-8" aria-hidden="true" />}
                title="No deals running right now"
                description="Nothing in the catalogue is discounted at the moment. Browse the full shop, or ask us on WhatsApp what is moving this week."
              />
            }
          />

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
