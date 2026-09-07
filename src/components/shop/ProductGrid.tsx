/**
 * The product grid. A Server Component: the tiles are client leaves, but the
 * list itself renders on the server so a filtered listing is real HTML.
 */

import * as React from "react";
import { EmptyState } from "@/components/ui";
import { PackageSearch } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProductCardData } from "@/lib/filters";
import { cn } from "@/lib/utils";

export type ProductGridColumns = 2 | 3 | 4 | 5;

const COLUMN_CLASSES: Record<ProductGridColumns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
};

export function ProductGrid({
  products,
  columns = 4,
  compact = false,
  className,
  empty,
  /** How many tiles load their image eagerly — roughly the first visible row. */
  priorityCount = 4,
}: {
  products: ProductCardData[];
  columns?: ProductGridColumns;
  compact?: boolean;
  className?: string;
  empty?: React.ReactNode;
  priorityCount?: number;
}) {
  if (!products.length) {
    return (
      <>
        {empty ?? (
          <EmptyState
            icon={<PackageSearch className="h-8 w-8" aria-hidden="true" />}
            title="Nothing matches those filters"
            description="Try widening the price range or clearing a filter or two."
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        COLUMN_CLASSES[columns],
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          compact={compact}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}

/**
 * Horizontally scrolling variant for "related products" and home-page rails,
 * where a wrapping grid would push the rest of the page down.
 */
export function ProductRail({
  products,
  className,
}: {
  products: ProductCardData[];
  className?: string;
}) {
  if (!products.length) return null;

  return (
    <ul
      className={cn(
        "no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2",
        className,
      )}
    >
      {products.map((product) => (
        <li
          key={product.id}
          className="w-[15rem] shrink-0 snap-start sm:w-[16.5rem]"
        >
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
