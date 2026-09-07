import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { productFormFromRow } from "@/components/admin/payloads";
import { ProductForm } from "@/components/admin/ProductForm";
import { DateText, Note, PageHeader, StatusBadge } from "@/components/admin/ui";
import { PRODUCT_STATUSES } from "@/components/admin/schema";
import { getAdminProduct, getProductFormOptions } from "@/lib/admin-queries";
import { KIND_META, isComponentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getAdminProduct(id);
  return { title: product ? product.name : "Product not found" };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, options] = await Promise.all([
    getAdminProduct(id),
    getProductFormOptions(),
  ]);

  if (!product) notFound();

  const kindLabel = isComponentKind(product.kind)
    ? KIND_META[product.kind].label
    : product.kind;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/admin/products" className="hover:text-white">
              Products
            </Link>{" "}
            / {kindLabel}
          </>
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{product.sku}</span>
            <StatusBadge options={PRODUCT_STATUSES} id={product.status} />
            <span className="text-xs text-ash">
              Updated <DateText value={product.updatedAt} />
            </span>
            {product.benchmarks.length > 0 && (
              <Link
                href={`/admin/benchmarks?productId=${product.id}`}
                className="text-xs text-cyan hover:text-white"
              >
                {product.benchmarks.length} benchmark
                {product.benchmarks.length === 1 ? " row" : " rows"}
              </Link>
            )}
          </span>
        }
      />

      {product.samplePrice && (
        <Note tone="warn">
          This product still carries seeded <strong>sample pricing</strong>. Set the
          real figure below and untick &ldquo;this price is still seeded sample
          data&rdquo; to remove the marker from the storefront.
        </Note>
      )}

      {product._count.reviews === 0 && (
        <Note>
          No reviews. The storefront shows an empty state rather than a star rating —
          this catalogue has never carried invented review text.
        </Note>
      )}

      <ProductForm
        mode="edit"
        productId={product.id}
        initial={productFormFromRow(product)}
        brands={options.brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        categories={options.categories.map((category) => ({
          id: category.id,
          label: category.label,
        }))}
        usage={{
          orderItems: product._count.orderItems,
          buildComponents: product._count.buildComponents,
          reviews: product._count.reviews,
        }}
      />
    </div>
  );
}
