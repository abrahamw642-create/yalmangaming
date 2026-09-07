import type { Metadata } from "next";
import Link from "next/link";

import { emptyProductForm } from "@/components/admin/payloads";
import { ProductForm } from "@/components/admin/ProductForm";
import { Note, PageHeader } from "@/components/admin/ui";
import { getProductFormOptions } from "@/lib/admin-queries";
import { isComponentKind, type ComponentKind } from "@/lib/types";

export const metadata: Metadata = { title: "New product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.kind) ? params.kind[0] : params.kind;

  // `?kind=` lets the "add another of these" path start on the right field set.
  const kind: ComponentKind | undefined =
    raw && isComponentKind(raw) ? (raw as ComponentKind) : undefined;

  const options = await getProductFormOptions();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/admin/products" className="hover:text-white">
              Products
            </Link>{" "}
            / New
          </>
        }
        title="Add a product"
        description="A new product starts as a draft, so it is not on the storefront until you set it to active."
      />

      <Note tone="info">
        Prices you type here are treated as confirmed Yalman Gaming figures — the
        &ldquo;still sample data&rdquo; box is off by default. Only the seeded
        catalogue carries sample pricing.
      </Note>

      <ProductForm
        mode="create"
        initial={emptyProductForm(kind)}
        brands={options.brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        categories={options.categories.map((category) => ({
          id: category.id,
          label: category.label,
        }))}
      />
    </div>
  );
}
