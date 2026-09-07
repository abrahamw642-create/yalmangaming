"use client";

/**
 * A single cart line, plus the list that renders them.
 *
 * Two variants share one component so the drawer and the cart page can never
 * disagree about a price, a quantity rule or an availability message:
 *   drawer — compact, fits a 26rem slide-over.
 *   page   — roomier, shows the build breakdown inline.
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  Cpu,
  ImageOff,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge, ButtonLink, EmptyState, Price, Skeleton, StockIndicator } from "@/components/ui";
import { cn, formatPKR, pluralize } from "@/lib/utils";
import { MAX_LINE_QTY } from "@/lib/validation";
import type { CartLine } from "@/lib/cart";
import { useCart } from "./CartProvider";

type Variant = "drawer" | "page";

/* -------------------------------------------------------------------------- */
/* Thumbnail                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `next.config.ts` ships with an empty `remotePatterns`, so `next/image`
 * refuses any absolute URL. Local paths get the optimiser; anything else falls
 * back to a plain tag rather than throwing at render time.
 */
function Thumb({
  src,
  alt,
  size,
}: {
  src: string | null;
  alt: string;
  size: number;
}) {
  const classes = "h-full w-full object-contain p-1.5";

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl border border-line bg-graphite"
      style={{ width: size, height: size }}
    >
      {!src ? (
        <div className="flex h-full w-full items-center justify-center text-ash">
          <ImageOff size={size * 0.34} aria-hidden="true" />
        </div>
      ) : src.startsWith("/") ? (
        <Image src={src} alt={alt} width={size} height={size} className={classes} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} loading="lazy" className={classes} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quantity                                                                   */
/* -------------------------------------------------------------------------- */

function QuantityStepper({
  line,
  onChange,
  compact,
}: {
  line: CartLine;
  onChange: (quantity: number) => void;
  compact: boolean;
}) {
  // Never offer more than the store can actually ship.
  const ceiling = line.stock > 0 ? Math.min(MAX_LINE_QTY, line.stock) : MAX_LINE_QTY;
  const buttonSize = compact ? "h-7 w-7" : "h-9 w-9";

  return (
    <div
      className="inline-flex items-center rounded-lg border border-line-strong bg-graphite"
      role="group"
      aria-label={`Quantity for ${line.name}`}
    >
      <button
        type="button"
        onClick={() => onChange(line.quantity - 1)}
        disabled={line.quantity <= 1}
        className={cn(
          buttonSize,
          "inline-flex items-center justify-center rounded-l-lg text-silver transition-colors",
          "hover:bg-white/5 hover:text-chrome disabled:opacity-35 disabled:hover:bg-transparent",
        )}
        aria-label={`Decrease quantity of ${line.name}`}
      >
        <Minus size={compact ? 13 : 15} aria-hidden="true" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={line.quantity}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(next)) onChange(next);
        }}
        className={cn(
          "tnum w-9 border-x border-line-strong bg-transparent text-center font-mono text-chrome",
          compact ? "h-7 text-xs" : "h-9 text-sm",
        )}
        aria-label={`Quantity of ${line.name}`}
      />

      <button
        type="button"
        onClick={() => onChange(line.quantity + 1)}
        disabled={line.quantity >= ceiling}
        className={cn(
          buttonSize,
          "inline-flex items-center justify-center rounded-r-lg text-silver transition-colors",
          "hover:bg-white/5 hover:text-chrome disabled:opacity-35 disabled:hover:bg-transparent",
        )}
        aria-label={`Increase quantity of ${line.name}`}
      >
        <Plus size={compact ? 13 : 15} aria-hidden="true" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Line                                                                       */
/* -------------------------------------------------------------------------- */

export function CartLineItem({
  line,
  variant = "page",
  className,
}: {
  line: CartLine;
  variant?: Variant;
  className?: string;
}) {
  const { updateQty, remove } = useCart();
  const compact = variant === "drawer";
  const meta = line.meta;

  const href =
    line.kind === "product" && line.slug
      ? `/product/${line.slug}`
      : meta?.shareCode
        ? `/build/${meta.shareCode}`
        : null;

  const title = href ? (
    <Link
      href={href}
      className="font-medium text-chrome transition-colors hover:text-cyan"
    >
      {line.name}
    </Link>
  ) : (
    <span className="font-medium text-chrome">{line.name}</span>
  );

  const warnings = meta?.compatibility.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <li
      className={cn(
        "flex gap-3 border-b border-line py-4 last:border-b-0",
        compact ? "gap-3" : "gap-4 sm:gap-5",
        className,
      )}
    >
      <Thumb src={line.imageUrl} alt={line.name} size={compact ? 64 : 96} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.kind === "build" && (
              <p className="eyebrow mb-1 flex items-center gap-1.5">
                <Cpu size={12} aria-hidden="true" />
                Custom build
              </p>
            )}
            <p className={cn("line-clamp-2", compact ? "text-sm" : "text-[0.9375rem]")}>
              {title}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove(line.id)}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-ash transition-colors hover:bg-rose/10 hover:text-rose"
            aria-label={`Remove ${line.name} from your cart`}
          >
            <Trash2 size={compact ? 15 : 16} aria-hidden="true" />
          </button>
        </div>

        {/* --- Build breakdown ------------------------------------------- */}
        {meta && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ash">
            <span className="tnum font-mono">
              {meta.components.length}{" "}
              {pluralize(meta.components.length, "component")}
            </span>
            {meta.services.length > 0 && (
              <span className="tnum font-mono">
                {meta.services.length} {pluralize(meta.services.length, "service")}
              </span>
            )}
            {meta.estimatedWatts > 0 && (
              <span className="tnum inline-flex items-center gap-1 font-mono">
                <Zap size={11} aria-hidden="true" />
                {meta.estimatedWatts}W est.
              </span>
            )}
            {meta.compatibility.status === "ok" && (
              <Badge tone="emerald">Compatible</Badge>
            )}
            {meta.compatibility.status === "warning" && (
              <Badge tone="ember">
                {warnings.length} {pluralize(warnings.length, "note")}
              </Badge>
            )}
            {meta.compatibility.status === "error" && (
              <Badge tone="rose">Needs attention</Badge>
            )}
          </div>
        )}

        {meta && variant === "page" && meta.components.length > 0 && (
          <details className="group">
            <summary className="w-fit cursor-pointer list-none text-xs font-medium text-cyan hover:underline">
              <span className="group-open:hidden">Show parts list</span>
              <span className="hidden group-open:inline">Hide parts list</span>
            </summary>
            <ul className="mt-2 space-y-1 border-l border-line pl-3">
              {meta.components.map((component) => (
                <li
                  key={component.productId}
                  className="flex items-baseline justify-between gap-4 text-xs"
                >
                  <span className="min-w-0 truncate text-silver">
                    {component.quantity > 1 && (
                      <span className="tnum mr-1 font-mono text-ash">
                        {component.quantity}×
                      </span>
                    )}
                    {component.name}
                  </span>
                  <span className="tnum shrink-0 font-mono text-ash">
                    {formatPKR(component.unitPrice * component.quantity)}
                  </span>
                </li>
              ))}
              {meta.services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-baseline justify-between gap-4 text-xs"
                >
                  <span className="min-w-0 truncate text-silver">{service.label}</span>
                  <span className="tnum shrink-0 font-mono text-ash">
                    {service.price === 0 ? "Included" : formatPKR(service.price)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* --- Availability ---------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StockIndicator stock={line.stock} showCount />
          {line.priceChanged && (
            <span className="inline-flex items-center gap-1 text-xs text-ember">
              <AlertTriangle size={12} aria-hidden="true" />
              Price updated
            </span>
          )}
        </div>

        {/* --- Money + quantity ------------------------------------------- */}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            line={line}
            compact={compact}
            onChange={(quantity) => updateQty(line.id, quantity)}
          />
          <div className="text-right">
            <Price
              price={line.listPrice ?? line.unitPrice}
              salePrice={line.listPrice ? line.unitPrice : null}
              samplePrice={line.samplePrice}
              size={compact ? "sm" : "md"}
              className="justify-end"
            />
            {line.quantity > 1 && (
              <p className="tnum mt-0.5 font-mono text-xs text-ash">
                {formatPKR(line.unitPrice * line.quantity)} total
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export function CartLineList({
  variant = "page",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { items, hydrated } = useCart();

  if (!hydrated) {
    return (
      <div className={cn("space-y-4", className)} aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 py-4">
            <Skeleton className={variant === "drawer" ? "h-16 w-16" : "h-24 w-24"} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={<ShoppingBag size={32} aria-hidden="true" />}
        title="Your cart is empty"
        description="Add components, a prebuilt machine, or configure your own from scratch."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/builder" variant="primary" size="md">
              BUILD YOUR PC
            </ButtonLink>
            <ButtonLink href="/shop" variant="outline" size="md">
              Browse the shop
            </ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    // Separators live on the line itself so a single `CartLineItem` can also be
    // rendered on its own (order review, admin) without losing its rule.
    <ul className={className}>
      {items.map((line) => (
        <CartLineItem key={line.id} line={line} variant={variant} />
      ))}
    </ul>
  );
}
