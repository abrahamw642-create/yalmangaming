"use client";

/**
 * The product tile, and the action buttons the product page reuses.
 *
 * A grid renders 24+ of these, so the hover tilt is deliberately cheap: one
 * pointer handler per card writing CSS custom properties inside a single rAF.
 * No React state, no re-render, no layout work — and it is skipped entirely on
 * coarse pointers and under `prefers-reduced-motion`.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Eye,
  Heart,
  ImageOff,
  Scale,
  ShoppingCart,
} from "lucide-react";
import { Badge, Price, Rating, StockIndicator } from "@/components/ui";
import { useCart } from "@/components/cart/CartProvider";
import { KindGlyph } from "./CategoryCard";
import { useCompare, useWishlist } from "./CompareProvider";
import { QuickViewModal } from "./QuickViewModal";
import type { ProductCardData } from "@/lib/filters";
import { KIND_META, isComponentKind, stockState } from "@/lib/types";
import { cn, discountPercent } from "@/lib/utils";

export type { ProductCardData } from "@/lib/filters";

/* -------------------------------------------------------------------------- */
/* Thumbnail                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Product photography is not guaranteed for every SKU, and a broken image is
 * worse than none — so a missing or failed URL degrades to a kind glyph on a
 * metal panel rather than a torn-page icon.
 */
export function ProductThumb({
  src,
  alt,
  kind,
  className,
  sizes = "(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw",
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  kind?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = !!src && !failed;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-carbon", className)}>
      {showImage ? (
        // A plain <img> keeps this component independent of the image-host
        // allow-list in next.config.ts, which the catalogue's URLs are not
        // guaranteed to satisfy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-steel to-graphite">
          <KindGlyph kind={kind} className="h-1/3 w-1/3 max-h-20 max-w-20 text-iron" />
          <span className="sr-only">{alt}</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export function AddToCartButton({
  product,
  size = "md",
  className,
  label = "ADD TO CART",
}: {
  product: ProductCardData;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const cart = useCart();
  const [added, setAdded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const soldOut = product.stock <= 0;

  const heights = { sm: "h-9 text-xs", md: "h-11 text-sm", lg: "h-13 text-[0.9375rem]" };

  return (
    <button
      type="button"
      disabled={soldOut}
      aria-label={soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
      onClick={() => {
        if (soldOut) return;
        cart.addProduct(product, 1);
        setAdded(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAdded(false), 1800);
      }}
      className={cn(
        "relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-4",
        "font-semibold tracking-wide transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-45",
        heights[size],
        added
          ? "bg-emerald/90 text-void"
          : "metal text-chrome hover:border-line-strong hover:text-white hover:shadow-glow-xs",
        className,
      )}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          ADDED
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {label}
        </>
      )}
    </button>
  );
}

/** Adds to the cart and goes straight to checkout. */
export function BuyNowButton({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      disabled={product.stock <= 0 || busy}
      onClick={() => {
        setBusy(true);
        cart.addProduct(product, 1);
        router.push("/checkout");
      }}
      className={cn(
        "inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl px-6",
        "border border-line-strong bg-transparent text-[0.9375rem] font-semibold tracking-wide text-chrome",
        "transition-all duration-200 hover:border-cyan/60 hover:bg-cyan/5 hover:text-white",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      BUY NOW
    </button>
  );
}

export function CompareToggleButton({
  productId,
  productName,
  variant = "icon",
  className,
}: {
  productId: string;
  productName: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const compare = useCompare();
  const active = compare.has(productId);
  // A full tray must not silently swallow the click.
  const blocked = !active && compare.full;

  const title = blocked
    ? `Comparison is full (${compare.max} products)`
    : active
      ? `Remove ${productName} from comparison`
      : `Compare ${productName}`;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => !blocked && compare.toggle(productId)}
        aria-pressed={active}
        disabled={blocked}
        title={title}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4",
          "text-sm font-semibold tracking-wide transition-all duration-200",
          "disabled:pointer-events-none disabled:opacity-45",
          active
            ? "border-cyan/50 bg-cyan/10 text-cyan"
            : "border-line-strong text-silver hover:border-cyan/50 hover:text-chrome",
          className,
        )}
      >
        <Scale className="h-4 w-4" aria-hidden="true" />
        {active ? "IN COMPARISON" : "COMPARE"}
      </button>
    );
  }

  return (
    <IconAction
      label={title}
      pressed={active}
      disabled={blocked}
      onClick={() => compare.toggle(productId)}
      className={className}
    >
      <Scale className="h-4 w-4" aria-hidden="true" />
    </IconAction>
  );
}

export function WishlistButton({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const wishlist = useWishlist();
  const active = wishlist.has(productId);

  return (
    <IconAction
      label={active ? `Remove ${productName} from saved items` : `Save ${productName}`}
      pressed={active}
      onClick={() => wishlist.toggle(productId)}
      className={className}
      tone="rose"
    >
      <Heart className={cn("h-4 w-4", active && "fill-current")} aria-hidden="true" />
    </IconAction>
  );
}

function IconAction({
  label,
  pressed,
  disabled,
  onClick,
  children,
  className,
  tone = "cyan",
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  tone?: "cyan" | "rose";
}) {
  const active =
    tone === "rose"
      ? "border-rose/50 bg-rose/10 text-rose"
      : "border-cyan/50 bg-cyan/10 text-cyan";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "glass inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        pressed ? active : "text-silver hover:text-chrome hover:border-line-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Tilt                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolved once for the whole page. `null` until the first pointer event so no
 * `matchMedia` work happens during hydration.
 */
let tiltAllowed: boolean | null = null;

function canTilt(): boolean {
  if (tiltAllowed !== null) return tiltAllowed;
  tiltAllowed =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return tiltAllowed;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function ProductCard({
  product,
  className,
  compact = false,
  priority = false,
}: {
  product: ProductCardData;
  className?: string;
  compact?: boolean;
  /** Set on the first row of a grid so the hero images are not lazy-loaded. */
  priority?: boolean;
}) {
  const cardRef = React.useRef<HTMLElement | null>(null);
  const frame = React.useRef(0);
  const [quickView, setQuickView] = React.useState(false);

  const state = stockState(product.stock, product.lowStockAt ?? 3);
  const soldOut = state === "out-of-stock";
  const off = discountPercent(product);
  const kindLabel = isComponentKind(product.kind) ? KIND_META[product.kind].label : null;

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canTilt()) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--tilt-x", `${(-py * 4).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * 5).toFixed(2)}deg`);
      el.style.setProperty("--sheen-x", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--sheen-y", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  };

  const resetTilt = () => {
    cancelAnimationFrame(frame.current);
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <article
      ref={cardRef}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      style={{
        transform:
          "perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
      }}
      className={cn(
        "metal group relative isolate flex flex-col rounded-2xl",
        "transition-[box-shadow,border-color,transform] duration-300",
        "hover:border-line-strong hover:shadow-lift",
        compact ? "p-2.5" : "p-3",
        className,
      )}
    >
      {/* Pointer-following sheen. Purely decorative, hidden on touch. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(320px circle at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(34,211,238,0.10), transparent 70%)",
        }}
      />

      {/* --- Media ------------------------------------------------------- */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-[var(--color-line)]",
          compact ? "aspect-square" : "aspect-[4/3]",
        )}
      >
        <Link
          href={`/product/${product.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          className="block h-full w-full"
        >
          <ProductThumb
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            kind={product.kind}
            priority={priority}
          />
        </Link>

        {/* Corner flags */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {off !== null && <Badge tone="rose">−{off}%</Badge>}
          {product.isNew && <Badge tone="cyan">New</Badge>}
          {product.onDeal && off === null && <Badge tone="ember">Deal</Badge>}
        </div>

        {/* Quick actions. Keyboard users reach them by tabbing; they are only
            visually hidden until hover, never removed from the tab order. */}
        {!compact && (
          <div
            className={cn(
              "absolute right-2 top-2 flex flex-col gap-1.5",
              "opacity-0 transition-opacity duration-200",
              "group-hover:opacity-100 focus-within:opacity-100",
            )}
          >
            <IconAction label={`Quick view ${product.name}`} onClick={() => setQuickView(true)}>
              <Eye className="h-4 w-4" aria-hidden="true" />
            </IconAction>
            <CompareToggleButton productId={product.id} productName={product.name} />
            <WishlistButton productId={product.id} productName={product.name} />
          </div>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-end justify-center bg-void/55 pb-3 backdrop-blur-[1px]">
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-rose">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* --- Body -------------------------------------------------------- */}
      <div className={cn("flex flex-1 flex-col gap-1.5", compact ? "pt-2.5" : "pt-3.5")}>
        <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
          {product.brandName && <span className="text-silver">{product.brandName}</span>}
          {product.brandName && kindLabel && <span aria-hidden="true">·</span>}
          {kindLabel && <span>{kindLabel}</span>}
        </p>

        <h3
          className={cn(
            "font-display font-semibold leading-snug text-chrome",
            compact ? "line-clamp-2 text-[0.8125rem]" : "line-clamp-2 text-sm",
          )}
        >
          <Link
            href={`/product/${product.slug}`}
            className="transition-colors hover:text-white focus-visible:text-white"
          >
            {product.name}
          </Link>
        </h3>

        {product.keySpec && (
          <p className="tnum line-clamp-2 font-mono text-[0.6875rem] leading-relaxed text-ash">
            {product.keySpec}
          </p>
        )}

        {product.reviewCount > 0 && (
          <Rating value={product.rating} count={product.reviewCount} size="sm" />
        )}

        <div className="mt-auto pt-2">
          <Price
            price={product.price}
            salePrice={product.salePrice}
            samplePrice={product.samplePrice}
            size={compact ? "sm" : "md"}
          />
          <StockIndicator
            stock={product.stock}
            lowStockAt={product.lowStockAt ?? 3}
            showCount
            className="mt-1.5"
          />
        </div>
      </div>

      {/* --- Action ------------------------------------------------------ */}
      {!compact && (
        <div className="mt-3">
          {soldOut ? (
            <Link
              href={`/product/${product.slug}#notify`}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl",
                "border border-line-strong px-4 text-sm font-semibold tracking-wide text-silver",
                "transition-all duration-200 hover:border-ember/50 hover:text-ember",
              )}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              NOTIFY ME
            </Link>
          ) : (
            <AddToCartButton product={product} />
          )}
        </div>
      )}

      {quickView && (
        <QuickViewModal product={product} onClose={() => setQuickView(false)} />
      )}
    </article>
  );
}

/** Placeholder tile used by the grid's loading skeletons. */
export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("metal flex flex-col gap-3 rounded-2xl", compact ? "p-2.5" : "p-3")}>
      <div
        className={cn("skeleton rounded-xl", compact ? "aspect-square" : "aspect-[4/3]")}
      />
      <div className="skeleton h-3 w-1/3 rounded" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="skeleton h-6 w-1/2 rounded" />
      {!compact && <div className="skeleton h-11 w-full rounded-xl" />}
    </div>
  );
}

/** Kept for the "no image" case elsewhere in the shop surface. */
export function MissingImage({ className }: { className?: string }) {
  return <ImageOff className={cn("text-iron", className)} aria-hidden="true" />;
}
