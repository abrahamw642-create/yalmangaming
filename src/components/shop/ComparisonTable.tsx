"use client";

/**
 * Side-by-side comparison of up to four products.
 *
 * The selection lives in the browser (see `CompareProvider`), so the rows are
 * fetched client-side from `/api/products`. Every row comes from a real product
 * column; rows where nothing differs are dimmed so the eye lands on what
 * actually separates the machines.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus, Trash2, X } from "lucide-react";
import { EmptyState, Price, Rating, StockIndicator, Spinner } from "@/components/ui";
import { useCart } from "@/components/cart/CartProvider";
import { KindGlyph } from "./CategoryCard";
import { useCompare } from "./CompareProvider";
import {
  MAX_COMPARE,
  buildCompareRows,
  formatCompareValue,
  type CompareGroup,
  type CompareProduct,
} from "@/lib/filters";
import { KIND_META, isComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ComparisonTable({ className }: { className?: string }) {
  const compare = useCompare();
  const [products, setProducts] = React.useState<CompareProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  const key = compare.ids.join(",");

  React.useEffect(() => {
    if (!key) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    fetch(`/api/products?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { items?: CompareProduct[] }) => {
        setProducts(data.items ?? []);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [key]);

  if (loading && !products.length) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-ash">
        <Spinner className="h-4 w-4 text-cyan" />
        Loading comparison…
      </div>
    );
  }

  if (!compare.count) {
    return (
      <EmptyState
        icon={<Plus className="h-8 w-8" aria-hidden="true" />}
        title="Nothing to compare yet"
        description="Add up to four products from any listing using the compare button on a product tile."
        action={
          <Link
            href="/shop"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan to-sky px-6 text-sm font-semibold tracking-wide text-void shadow-glow-sm transition-all hover:brightness-110"
          >
            BROWSE PRODUCTS
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />
    );
  }

  if (failed || !products.length) {
    return (
      <EmptyState
        icon={<X className="h-8 w-8" aria-hidden="true" />}
        title="Could not load those products"
        description="They may have been removed from the catalogue. Clear the comparison and pick again."
        action={
          <button
            type="button"
            onClick={compare.clear}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-5 text-sm font-semibold text-silver transition-colors hover:text-chrome"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            CLEAR COMPARISON
          </button>
        }
      />
    );
  }

  const groups = buildCompareRows(products);
  const columns = products.length;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tnum text-sm text-ash">
          Comparing{" "}
          <span className="font-medium text-silver">{columns}</span> of {MAX_COMPARE}
        </p>
        <button
          type="button"
          onClick={compare.clear}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ash transition-colors hover:text-rose"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear all
        </button>
      </div>

      {/* The table scrolls inside its own container so the page never does. */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)]">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            Specification comparison of {columns} products
          </caption>

          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-44 bg-graphite p-4 align-top"
              >
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ash">
                  Product
                </span>
              </th>
              {products.map((product) => (
                <th
                  key={product.id}
                  scope="col"
                  className="min-w-[13rem] border-l border-[var(--color-line)] p-4 align-top"
                >
                  <CompareHeader
                    product={product}
                    onRemove={() => compare.remove(product.id)}
                  />
                </th>
              ))}
              {columns < MAX_COMPARE && (
                <th
                  scope="col"
                  className="min-w-[11rem] border-l border-[var(--color-line)] p-4 align-top"
                >
                  <Link
                    href="/shop"
                    className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-4 text-ash transition-colors hover:border-cyan/50 hover:text-cyan"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs font-medium">Add another</span>
                  </Link>
                </th>
              )}
            </tr>
          </thead>

          {groups.map((group) => (
            <CompareGroupBody
              key={group.group}
              group={group}
              columns={columns}
              padding={columns < MAX_COMPARE}
            />
          ))}
        </table>
      </div>

      <p className="text-xs leading-relaxed text-ash">
        Rows highlighted in cyan are where these products differ. Blank cells mean
        the specification does not apply, or is not recorded for that product.
      </p>
    </div>
  );
}

function CompareGroupBody({
  group,
  columns,
  padding,
}: {
  group: CompareGroup;
  columns: number;
  padding: boolean;
}) {
  return (
    <tbody className="border-t border-[var(--color-line)]">
      <tr>
        <th
          scope="colgroup"
          colSpan={columns + 1 + (padding ? 1 : 0)}
          className="bg-white/[0.03] px-4 py-2 text-left font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-cyan"
        >
          {group.group}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr
          key={row.field.key}
          className={cn(
            "border-t border-[var(--color-line)]",
            row.differs ? "bg-cyan/[0.04]" : "opacity-80",
          )}
        >
          <th
            scope="row"
            className="sticky left-0 z-10 bg-graphite px-4 py-2.5 text-sm font-normal text-ash"
          >
            {row.field.label}
          </th>
          {row.values.map((value, index) => (
            <td
              key={index}
              className={cn(
                "tnum border-l border-[var(--color-line)] px-4 py-2.5 font-mono text-sm",
                row.differs ? "text-chrome" : "text-silver",
              )}
            >
              {formatCompareValue(row.field, value)}
            </td>
          ))}
          {padding && <td className="border-l border-[var(--color-line)]" />}
        </tr>
      ))}
    </tbody>
  );
}

function CompareHeader({
  product,
  onRemove,
}: {
  product: CompareProduct;
  onRemove: () => void;
}) {
  const cart = useCart();
  const [failed, setFailed] = React.useState(false);
  const showImage = !!product.imageUrl && !failed;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--color-line)] bg-carbon">
        <Link href={`/product/${product.slug}`} className="block h-full w-full">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl!}
              alt={product.imageAlt || product.name}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-steel to-graphite">
              <KindGlyph kind={product.kind} className="h-10 w-10 text-iron" />
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${product.name} from comparison`}
          className="glass absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-silver transition-colors hover:text-rose"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
        {[
          product.brandName,
          isComponentKind(product.kind) ? KIND_META[product.kind].label : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <Link
        href={`/product/${product.slug}`}
        className="line-clamp-2 font-display text-sm font-semibold leading-snug text-chrome transition-colors hover:text-white"
      >
        {product.name}
      </Link>

      {product.reviewCount > 0 && (
        <Rating value={product.rating} count={product.reviewCount} size="sm" />
      )}

      <Price
        price={product.price}
        salePrice={product.salePrice}
        samplePrice={product.samplePrice}
        size="sm"
      />

      <StockIndicator stock={product.stock} lowStockAt={product.lowStockAt ?? 3} />

      <button
        type="button"
        disabled={product.stock <= 0}
        onClick={() => cart.addProduct(product, 1)}
        className={cn(
          "mt-1 inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold tracking-wide",
          "transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
          "metal text-chrome hover:border-line-strong hover:text-white",
        )}
      >
        ADD TO CART
      </button>
    </div>
  );
}
