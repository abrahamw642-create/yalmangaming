"use client";

/**
 * The money panel — shared by the cart page and checkout so the two can never
 * quote different totals. It reads the cart directly; the caller only supplies
 * the call to action, which lets checkout put its submit button inside the
 * form element while the cart page renders a link.
 */

import * as React from "react";
import { Printer, Tag, X } from "lucide-react";
import { Button, Card, SamplePricingNote, Skeleton } from "@/components/ui";
import { cn, formatPKR, pluralize } from "@/lib/utils";
import { DELIVERY_LABEL, DELIVERY_NOTE, type AppliedCoupon } from "@/lib/cart";
import { useCart } from "@/components/cart/CartProvider";

/* -------------------------------------------------------------------------- */
/* Coupon                                                                     */
/* -------------------------------------------------------------------------- */

function CouponField() {
  const { coupon, setCoupon, totals } = useCart();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const inputId = React.useId();

  async function apply(event: React.SyntheticEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotal: totals.subtotal }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        coupon?: AppliedCoupon;
        message?: string;
      };

      if (response.ok && data.ok && data.coupon) {
        setCoupon(data.coupon);
        setCode("");
        setMessage(null);
      } else {
        setMessage(data.message ?? "That coupon code is not valid.");
      }
    } catch {
      setMessage("Could not check that code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald/30 bg-emerald/[0.07] px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-emerald">
            <Tag size={12} aria-hidden="true" />
            {coupon.code}
          </p>
          {coupon.description && (
            <p className="mt-0.5 truncate text-xs text-silver">{coupon.description}</p>
          )}
          {totals.discount === 0 && coupon.minSpend != null && (
            <p className="mt-0.5 text-xs text-ember">
              Applies from {formatPKR(coupon.minSpend)}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCoupon(null)}
          className="shrink-0 rounded-lg p-1.5 text-ash transition-colors hover:bg-white/5 hover:text-chrome"
          aria-label={`Remove coupon ${coupon.code}`}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    // A nested <form> is invalid HTML, so this is a div that submits on Enter
    // via the input's own key handler — checkout wraps everything in one form.
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-ash">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void apply(event);
            }
          }}
          placeholder="ENTER CODE"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-graphite px-3",
            "font-mono text-sm uppercase tracking-wider text-chrome placeholder:text-ash/60",
            "focus:border-cyan/60 focus:outline-none",
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={busy}
          onClick={(event) => void apply(event)}
          disabled={code.trim().length === 0}
        >
          APPLY
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-1.5 text-xs text-rose">
          {message}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

export function OrderSummary({
  variant = "cart",
  action,
  className,
}: {
  /** `checkout` also itemises the cart, since no other list is on that page. */
  variant?: "cart" | "checkout";
  action?: React.ReactNode;
  className?: string;
}) {
  const { items, totals, hydrated } = useCart();

  if (!hydrated) {
    return (
      <Card className={cn("p-5", className)}>
        <Skeleton className="mb-4 h-5 w-32" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-4/5" />
        <Skeleton className="h-11 w-full" />
      </Card>
    );
  }

  const hasSamplePricing = items.some((line) => line.samplePrice);

  return (
    <Card className={cn("p-5", className)}>
      <h2 className="font-display text-lg font-semibold text-chrome">
        Order summary
      </h2>
      <p className="tnum mt-0.5 font-mono text-xs text-ash">
        {totals.count} {pluralize(totals.count, "item")}
      </p>

      {variant === "checkout" && items.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {items.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-silver">
                {line.quantity > 1 && (
                  <span className="tnum mr-1 font-mono text-ash">{line.quantity}×</span>
                )}
                {line.name}
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block font-mono text-chrome">
                  {formatPKR(line.unitPrice * line.quantity)}
                </span>
                {line.samplePrice && (
                  <span
                    className="block font-mono text-[0.625rem] uppercase tracking-wider text-ash"
                    title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
                  >
                    sample
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <CouponField />
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-silver">Subtotal</dt>
          <dd className="tnum font-mono font-medium text-chrome">
            {formatPKR(totals.subtotal)}
          </dd>
        </div>

        {totals.discount > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-silver">Coupon discount</dt>
            <dd className="tnum font-mono font-medium text-emerald">
              −{formatPKR(totals.discount)}
            </dd>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-silver">{DELIVERY_LABEL}</dt>
          <dd className="tnum font-mono font-medium text-chrome">
            {formatPKR(totals.delivery)}
          </dd>
        </div>

        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-display font-semibold text-chrome">Estimated total</dt>
          <dd className="tnum font-display text-2xl font-semibold text-chrome">
            {formatPKR(totals.total)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ash">{DELIVERY_NOTE}</p>

      {hasSamplePricing && <SamplePricingNote className="mt-3" />}

      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Print                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Lives here rather than in its own file so the order confirmation — a Server
 * Component — can stay server-rendered and pull in exactly one client leaf.
 */
export function PrintButton({
  className,
  label = "PRINT",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      className={cn("no-print", className)}
      onClick={() => window.print()}
    >
      <Printer size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}

export default OrderSummary;
