/**
 * Turns a validated product payload into Prisma column data.
 *
 * The cast at the bottom is the one deliberate type assertion in the admin.
 * `specColumnUpdates` is driven by `KIND_SPEC_GROUPS`, whose field definitions
 * declare the storage type of every column (`int`, `float`, `boolean`, `list`,
 * `map`, text), and it emits exactly those types — but it is keyed by string,
 * so TypeScript can only see `Record<string, string | number | boolean | null>`.
 * The alternative is fifty hand-written column assignments that would drift
 * from the field definitions the moment one changed.
 *
 * It lives here rather than in `@/components/admin/payloads` because it names
 * Prisma's generated types, which must never reach the browser bundle.
 */

import type { Prisma } from "@prisma/client";

import { specColumnUpdates, type ProductWrite } from "@/components/admin/payloads";

/** Everything except the relations (`images`), which each caller nests itself. */
export function productColumnData(
  write: ProductWrite,
): Omit<Prisma.ProductUncheckedCreateInput, "id" | "images"> {
  const base = {
    sku: write.sku,
    slug: write.slug,
    name: write.name,
    headline: write.headline,
    description: write.description,
    kind: write.kind,
    brandId: write.brandId,
    categoryId: write.categoryId,

    price: write.price,
    salePrice: write.salePrice ?? null,
    costPrice: write.costPrice ?? null,
    samplePrice: write.samplePrice,

    stock: write.stock,
    lowStockAt: write.lowStockAt,
    supplier: write.supplier,
    warranty: write.warranty,

    status: write.status,
    featured: write.featured,
    isNew: write.isNew,
    onDeal: write.onDeal,

    // Stored as JSON *text* for SQLite/Postgres portability — see the note at
    // the top of prisma/schema.prisma.
    specSheet: write.specSheet.length > 0 ? JSON.stringify(write.specSheet) : null,

    ...specColumnUpdates(write.kind, write.specs),
  };

  return base as unknown as Omit<Prisma.ProductUncheckedCreateInput, "id" | "images">;
}

/** Image rows in the order the editor listed them. */
export function productImageRows(write: ProductWrite) {
  return write.images.map((image, index) => ({
    url: image.url,
    alt: image.alt,
    placeholder: image.placeholder,
    sortOrder: index,
  }));
}
