import type { Metadata } from "next";

import { PRODUCT_FLAGS } from "@/components/admin/schema";
import { ProductFilters } from "@/components/admin/ProductFilters";
import { ProductTable } from "@/components/admin/ProductTable";
import {
  ChipLink,
  ChipRow,
  Note,
  PageHeader,
  Pagination,
  Panel,
} from "@/components/admin/ui";
import { ButtonLink, SamplePricingNote } from "@/components/ui";
import { getProductFormOptions, listAdminProducts } from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [result, options] = await Promise.all([
    listAdminProducts({
      q: one(params.q),
      kind: one(params.kind),
      status: one(params.status),
      categoryId: one(params.categoryId),
      brandId: one(params.brandId),
      flag: one(params.flag),
      sort: one(params.sort),
      page: Number(one(params.page)) || 1,
    }),
    getProductFormOptions(),
  ]);

  const { query } = result;

  /** Rebuilds the current URL with one parameter changed. */
  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      q: query.q,
      kind: query.kind,
      status: query.status,
      brandId: query.brandId,
      categoryId: query.categoryId,
      flag: query.flag,
      sort: query.sort === "updated" ? null : query.sort,
      page: query.page > 1 ? query.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") {
        next.set(key, String(value));
      }
    }
    const search = next.toString();
    return search ? `/admin/products?${search}` : "/admin/products";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Edit price, stock and merchandising flags straight from this table. Open a product for its compatibility specs, images and spec sheet."
        action={
          <ButtonLink href="/admin/products/new" size="sm">
            New product
          </ButtonLink>
        }
      />

      {query.flag === "sample" && (
        <Note tone="warn">
          <strong className="font-semibold">Sample pricing view.</strong> These
          figures were seeded for development. Set the real Yalman Gaming price,
          then press <em>confirm</em> under it to clear the marker — the storefront
          stops showing &ldquo;sample&rdquo; the moment you do.
        </Note>
      )}

      <ChipRow>
        <ChipLink href={hrefWith({ flag: null, page: null })} active={!query.flag}>
          All products
        </ChipLink>
        {PRODUCT_FLAGS.map((flag) => (
          <ChipLink
            key={flag.id}
            href={hrefWith({ flag: flag.id, page: null })}
            active={query.flag === flag.id}
            tone={flag.tone}
          >
            {flag.label}
          </ChipLink>
        ))}
      </ChipRow>

      <Panel padded={false}>
        <ProductFilters
          query={query}
          brands={options.brands.map((brand) => ({ id: brand.id, label: brand.name }))}
          categories={options.categories.map((category) => ({
            id: category.id,
            label: category.label,
          }))}
        />

        <ProductTable products={result.items} total={result.total} />

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          perPage={result.perPage}
          hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
          label="products"
        />
      </Panel>

      <SamplePricingNote />
    </div>
  );
}
