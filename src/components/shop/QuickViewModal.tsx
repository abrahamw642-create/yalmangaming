"use client";

/**
 * Quick view — the "is this the right part?" glance without leaving the grid.
 *
 * Rendered through a portal into `document.body` on purpose: the product card
 * carries a `transform` for its hover tilt, and a transformed ancestor becomes
 * the containing block for `position: fixed` children, which would trap the
 * overlay inside the card.
 *
 * Specs are fetched on open rather than shipped with every tile — a 24-card
 * grid should not carry 24 spec sheets it will probably never show.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, Bell, ImageOff, Scale, X } from "lucide-react";
import { Price, Rating, SpecList, StockIndicator, Spinner } from "@/components/ui";
import { useCart } from "@/components/cart/CartProvider";
import { KindGlyph } from "./CategoryCard";
import { useCompare } from "./CompareProvider";
import type { CompareProduct, ProductCardData } from "@/lib/filters";
import { COMPARE_FIELDS, formatCompareValue } from "@/lib/filters";
import { KIND_META, isComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuickViewModal({
  product,
  onClose,
}: {
  product: ProductCardData;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [detail, setDetail] = React.useState<CompareProduct | null>(null);
  const [loading, setLoading] = React.useState(true);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  /* Load the spec detail for this one product. */
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/products?ids=${encodeURIComponent(product.id)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { items?: CompareProduct[] }) => {
        setDetail(data.items?.[0] ?? null);
      })
      .catch(() => {
        // The card data alone is still a useful quick view.
        setDetail(null);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [product.id]);

  /* Escape to close, and keep focus inside the dialog while it is open. */
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick view — ${product.name}`}
        className={cn(
          "glass-strong relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden",
          "rounded-t-2xl shadow-lift sm:rounded-2xl",
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg text-silver transition-colors hover:bg-white/5 hover:text-chrome"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="grid gap-0 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <QuickViewMedia product={product} />

          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
                {[
                  product.brandName,
                  isComponentKind(product.kind) ? KIND_META[product.kind].label : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-tight text-chrome">
                {product.name}
              </h2>
              {product.headline && (
                <p className="mt-2 text-sm leading-relaxed text-silver">{product.headline}</p>
              )}
            </div>

            {product.reviewCount > 0 && (
              <Rating value={product.rating} count={product.reviewCount} size="sm" />
            )}

            <div>
              <Price
                price={product.price}
                salePrice={product.salePrice}
                samplePrice={product.samplePrice}
                size="lg"
              />
              <StockIndicator
                stock={product.stock}
                lowStockAt={product.lowStockAt ?? 3}
                showCount
                className="mt-2"
              />
            </div>

            <QuickSpecs product={product} detail={detail} loading={loading} />

            <div className="mt-auto flex flex-col gap-2 pt-2">
              {product.stock > 0 ? (
                <QuickAddButton product={product} onDone={onClose} />
              ) : (
                <Link
                  href={`/product/${product.slug}#notify`}
                  onClick={onClose}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold tracking-wide text-silver transition-all hover:border-ember/50 hover:text-ember"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  NOTIFY ME WHEN BACK
                </Link>
              )}

              <div className="flex gap-2">
                <QuickCompareButton product={product} />
                <Link
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong px-4 text-sm font-semibold tracking-wide text-silver transition-all hover:border-cyan/50 hover:text-chrome"
                >
                  FULL DETAILS
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuickViewMedia({ product }: { product: ProductCardData }) {
  const [failed, setFailed] = React.useState(false);
  const showImage = !!product.imageUrl && !failed;

  return (
    <div className="relative aspect-[4/3] w-full bg-carbon sm:aspect-auto sm:min-h-[22rem]">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl!}
          alt={product.imageAlt || product.name}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-steel to-graphite">
          <KindGlyph kind={product.kind} className="h-20 w-20 text-iron" />
          <ImageOff className="sr-only" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/**
 * Up to six rows: the product's own spec sheet if it has one, otherwise the
 * populated compatibility columns. Never invented — a product with no stored
 * specs simply shows its key spec line.
 */
function QuickSpecs({
  product,
  detail,
  loading,
}: {
  product: ProductCardData;
  detail: CompareProduct | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-ash">
        <Spinner className="h-3.5 w-3.5" />
        Loading specifications…
      </div>
    );
  }

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (detail?.specs.length) {
    for (const spec of detail.specs.slice(0, 6)) {
      rows.push({ label: spec.label, value: spec.value });
    }
  } else if (detail) {
    for (const field of COMPARE_FIELDS) {
      if (rows.length >= 6) break;
      const value = detail.attrs[field.key];
      if (value === null || value === undefined || value === "") continue;
      rows.push({ label: field.label, value: formatCompareValue(field, value) });
    }
  }

  if (!rows.length) {
    return product.keySpec ? (
      <p className="tnum rounded-lg border border-[var(--color-line)] px-3 py-2 font-mono text-xs text-silver">
        {product.keySpec}
      </p>
    ) : null;
  }

  return <SpecList rows={rows} />;
}

/**
 * Local rather than reused from `ProductCard` so the two modules do not form an
 * import cycle (the card renders this modal).
 */
function QuickCompareButton({ product }: { product: ProductCardData }) {
  const compare = useCompare();
  const active = compare.has(product.id);
  const blocked = !active && compare.full;

  return (
    <button
      type="button"
      onClick={() => !blocked && compare.toggle(product.id)}
      aria-pressed={active}
      disabled={blocked}
      title={
        blocked
          ? `Comparison is full (${compare.max} products)`
          : active
            ? "Remove from comparison"
            : "Add to comparison"
      }
      className={cn(
        "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4",
        "text-sm font-semibold tracking-wide transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-45",
        active
          ? "border-cyan/50 bg-cyan/10 text-cyan"
          : "border-line-strong text-silver hover:border-cyan/50 hover:text-chrome",
      )}
    >
      <Scale className="h-4 w-4" aria-hidden="true" />
      {active ? "IN COMPARISON" : "COMPARE"}
    </button>
  );
}

function QuickAddButton({
  product,
  onDone,
}: {
  product: ProductCardData;
  onDone: () => void;
}) {
  const cart = useCart();

  return (
    <button
      type="button"
      onClick={() => {
        cart.addProduct(product, 1);
        cart.setOpen(true);
        onDone();
      }}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan to-sky px-4 text-sm font-semibold tracking-wide text-void shadow-glow-sm transition-all hover:shadow-glow hover:brightness-110"
    >
      ADD TO CART
    </button>
  );
}
