"use client";

/**
 * Checkout.
 *
 * Built for a Pakistani customer finishing this on a phone: every field
 * carries the right `inputMode` and `autoComplete` so the keyboard is correct
 * first time and the browser can fill most of it, the province is a picker
 * rather than free text, and the phone field accepts every way a PK mobile
 * number gets written.
 *
 * Validation runs through `customerDetailsSchema` — the same schema the order
 * endpoint uses — so a message here is exactly what the server would say.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CHECKOUT_STORAGE_KEY, toOrderLines } from "@/lib/cart";
import {
  EMPTY_CUSTOMER_DETAILS,
  PK_PROVINCES,
  customerDetailsSchema,
  fieldErrors,
  type CustomerDetailsInput,
  type PaymentMethodId,
} from "@/lib/validation";
import { useCart } from "@/components/cart/CartProvider";
import { OrderSummary } from "./OrderSummary";
import { PaymentMethods } from "./PaymentMethods";

/** Mirrors an `OrderIssue` from `@/lib/orders` without importing server code. */
type ServerIssue = {
  lineId: string | null;
  productId: string | null;
  code: string;
  message: string;
};

/* -------------------------------------------------------------------------- */
/* Field primitives                                                           */
/* -------------------------------------------------------------------------- */

const CONTROL_BASE =
  "w-full rounded-xl border bg-graphite px-3.5 text-[0.9375rem] text-chrome " +
  "placeholder:text-ash/55 transition-colors focus:outline-none";

function controlClasses(invalid: boolean, extra?: string) {
  return cn(
    CONTROL_BASE,
    invalid
      ? "border-rose/60 focus:border-rose"
      : "border-line-strong focus:border-cyan/60",
    extra,
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-silver">
        {label}
        {optional && <span className="text-xs font-normal text-ash">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ash">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

export function CheckoutForm() {
  const router = useRouter();
  const { items, coupon, hydrated, clear } = useCart();

  const [values, setValues] = React.useState<CustomerDetailsInput>(EMPTY_CUSTOMER_DETAILS);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [method, setMethod] = React.useState<PaymentMethodId>("cod");
  const [submitting, setSubmitting] = React.useState(false);
  const [placed, setPlaced] = React.useState(false);
  const [issues, setIssues] = React.useState<ServerIssue[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  const issuesRef = React.useRef<HTMLDivElement>(null);

  /* --- Remember the customer's details on this device --------------------- */
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      setValues((previous) => {
        const next = { ...previous };
        // Copy across only the keys we know about, so a stale or hand-edited
        // payload cannot inject unexpected fields into form state.
        for (const key of Object.keys(EMPTY_CUSTOMER_DETAILS) as (keyof CustomerDetailsInput)[]) {
          const value = parsed[key];
          if (typeof value === "string") next[key] = value;
        }
        return next;
      });
    } catch {
      // Unreadable storage is not worth interrupting checkout for.
    }
  }, []);

  const set = React.useCallback(
    <K extends keyof CustomerDetailsInput>(key: K, value: string) => {
      setValues((previous) => ({ ...previous, [key]: value }));
      setErrors((previous) => {
        if (!(key in previous)) return previous;
        const next = { ...previous };
        delete next[key];
        return next;
      });
    },
    [],
  );

  /** Validates one field in isolation so blur gives instant, targeted feedback. */
  const validateField = React.useCallback(
    (key: keyof CustomerDetailsInput) => {
      const result = customerDetailsSchema.safeParse(values);
      if (result.success) return;
      const all = fieldErrors(result.error);
      setErrors((previous) =>
        all[key] ? { ...previous, [key]: all[key] } : previous,
      );
    },
    [values],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || placed) return;

    setFormError(null);
    setIssues([]);

    const parsed = customerDetailsSchema.safeParse(values);
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      const firstKey = Object.keys(found)[0];
      document.getElementById(`checkout-${firstKey}`)?.focus();
      return;
    }
    setErrors({});

    const lines = toOrderLines(items);
    if (lines.length === 0) {
      setFormError("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: values,
          paymentMethod: method,
          couponCode: coupon?.code ?? null,
          lines,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        orderNumber?: string;
        issues?: ServerIssue[];
        errors?: Record<string, string>;
        message?: string;
      };

      if (response.ok && data.ok && data.orderNumber) {
        // Hold the "placing" state through navigation so emptying the cart
        // cannot flash the empty-cart screen on the way out.
        setPlaced(true);
        clear();
        router.push(`/checkout/success/${encodeURIComponent(data.orderNumber)}`);
        return;
      }

      if (data.errors) {
        // The server prefixes customer field paths with `customer.`.
        const mapped: Record<string, string> = {};
        for (const [key, message] of Object.entries(data.errors)) {
          mapped[key.replace(/^customer\./, "")] = message;
        }
        setErrors(mapped);
        const firstKey = Object.keys(mapped)[0];
        document.getElementById(`checkout-${firstKey}`)?.focus();
      }

      if (data.issues?.length) {
        setIssues(data.issues);
        issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (!data.errors) {
        setFormError(data.message ?? "We could not place your order. Please try again.");
      }
    } catch {
      setFormError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* --- Remember the address for next time --------------------------------- */
  React.useEffect(() => {
    if (!values.name && !values.phone) return;
    // Debounced: a synchronous storage write on every keystroke is exactly the
    // kind of jank a mid-range Android phone cannot absorb.
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(values));
      } catch {
        // Remembering the address is a convenience, not a requirement.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [values]);

  if (hydrated && items.length === 0 && !placed) {
    return (
      <EmptyState
        title="There is nothing to check out"
        description="Your cart is empty. Add a machine, some parts, or configure your own build."
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
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10"
    >
      <div className="min-w-0 space-y-8">
        {/* --- Server-side problems ------------------------------------- */}
        <div ref={issuesRef}>
          {issues.length > 0 && (
            <Card className="border-rose/40 p-4">
              <p className="flex items-center gap-2 font-display font-semibold text-rose">
                <AlertTriangle size={17} aria-hidden="true" />
                Your cart needs a change before we can place this order
              </p>
              <ul className="mt-2.5 space-y-1.5 text-sm text-silver">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className="flex gap-2">
                    <span aria-hidden="true" className="text-rose">
                      •
                    </span>
                    {issue.message}
                  </li>
                ))}
              </ul>
              <Link
                href="/cart"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan hover:underline"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to cart
              </Link>
            </Card>
          )}

          {formError && (
            <Card className="border-rose/40 p-4">
              <p role="alert" className="flex items-center gap-2 text-sm text-rose">
                <AlertTriangle size={16} aria-hidden="true" />
                {formError}
              </p>
            </Card>
          )}
        </div>

        {/* --- Contact ---------------------------------------------------- */}
        <section aria-labelledby="checkout-contact">
          <h2
            id="checkout-contact"
            className="font-display text-lg font-semibold text-chrome"
          >
            Contact details
          </h2>
          <p className="mt-1 text-sm text-silver">
            Yalman Gaming calls to confirm every order before it is dispatched.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="checkout-name" label="Full name" error={errors.name}>
              <input
                id="checkout-name"
                name="name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                onBlur={() => validateField("name")}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Ahmed Raza"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "checkout-name-error" : undefined}
                className={controlClasses(!!errors.name, "h-12")}
              />
            </Field>

            <Field
              id="checkout-phone"
              label="Mobile number"
              error={errors.phone}
              hint="We also use this on WhatsApp. e.g. 0328 4400231"
            >
              <input
                id="checkout-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                onBlur={() => validateField("phone")}
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="03XX XXXXXXX"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "checkout-phone-error" : undefined}
                className={controlClasses(!!errors.phone, "h-12 tnum font-mono")}
              />
            </Field>

            <Field
              id="checkout-email"
              label="Email"
              optional
              error={errors.email}
              hint="For the order confirmation. Leave blank if you prefer WhatsApp."
              className="sm:col-span-2"
            >
              <input
                id="checkout-email"
                name="email"
                type="email"
                inputMode="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                onBlur={() => validateField("email")}
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="you@example.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "checkout-email-error" : undefined}
                className={controlClasses(!!errors.email, "h-12")}
              />
            </Field>
          </div>
        </section>

        {/* --- Address ---------------------------------------------------- */}
        <section aria-labelledby="checkout-address">
          <h2
            id="checkout-address"
            className="font-display text-lg font-semibold text-chrome"
          >
            Delivery address
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="checkout-addressLine1"
              label="Address line 1"
              error={errors.addressLine1}
              hint="House / flat number and street"
              className="sm:col-span-2"
            >
              <input
                id="checkout-addressLine1"
                name="addressLine1"
                value={values.addressLine1}
                onChange={(event) => set("addressLine1", event.target.value)}
                onBlur={() => validateField("addressLine1")}
                autoComplete="address-line1"
                enterKeyHint="next"
                placeholder="House 42, Street 7"
                aria-invalid={errors.addressLine1 ? true : undefined}
                aria-describedby={
                  errors.addressLine1 ? "checkout-addressLine1-error" : undefined
                }
                className={controlClasses(!!errors.addressLine1, "h-12")}
              />
            </Field>

            <Field
              id="checkout-addressLine2"
              label="Address line 2"
              optional
              error={errors.addressLine2}
              hint="Area, block or sector"
              className="sm:col-span-2"
            >
              <input
                id="checkout-addressLine2"
                name="addressLine2"
                value={values.addressLine2}
                onChange={(event) => set("addressLine2", event.target.value)}
                autoComplete="address-line2"
                enterKeyHint="next"
                placeholder="Block E-1, Gulberg III"
                className={controlClasses(!!errors.addressLine2, "h-12")}
              />
            </Field>

            <Field id="checkout-city" label="City" error={errors.city}>
              <input
                id="checkout-city"
                name="city"
                value={values.city}
                onChange={(event) => set("city", event.target.value)}
                onBlur={() => validateField("city")}
                autoComplete="address-level2"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Lahore"
                aria-invalid={errors.city ? true : undefined}
                aria-describedby={errors.city ? "checkout-city-error" : undefined}
                className={controlClasses(!!errors.city, "h-12")}
              />
            </Field>

            <Field
              id="checkout-province"
              label="Province / territory"
              error={errors.province}
            >
              <select
                id="checkout-province"
                name="province"
                value={values.province}
                onChange={(event) => set("province", event.target.value)}
                onBlur={() => validateField("province")}
                autoComplete="address-level1"
                aria-invalid={errors.province ? true : undefined}
                aria-describedby={
                  errors.province ? "checkout-province-error" : undefined
                }
                className={controlClasses(!!errors.province, "h-12 appearance-none pr-9")}
              >
                <option value="">Select…</option>
                {PK_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="checkout-postal"
              label="Postal code"
              optional
              error={errors.postal}
            >
              <input
                id="checkout-postal"
                name="postal"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={values.postal}
                onChange={(event) =>
                  set("postal", event.target.value.replace(/\D/g, "").slice(0, 5))
                }
                onBlur={() => validateField("postal")}
                autoComplete="postal-code"
                enterKeyHint="next"
                placeholder="54660"
                aria-invalid={errors.postal ? true : undefined}
                aria-describedby={errors.postal ? "checkout-postal-error" : undefined}
                className={controlClasses(!!errors.postal, "h-12 tnum font-mono")}
              />
            </Field>

            <Field
              id="checkout-instructions"
              label="Delivery instructions"
              optional
              error={errors.instructions}
              hint="Landmarks, gate codes, or a time that suits you."
              className="sm:col-span-2"
            >
              <textarea
                id="checkout-instructions"
                name="instructions"
                rows={3}
                value={values.instructions}
                onChange={(event) => set("instructions", event.target.value)}
                maxLength={400}
                enterKeyHint="done"
                placeholder="Near Hafeez Centre, call when you reach the main gate."
                className={controlClasses(!!errors.instructions, "resize-y py-3")}
              />
            </Field>
          </div>
        </section>

        {/* --- Payment ---------------------------------------------------- */}
        <PaymentMethods value={method} onChange={setMethod} error={errors.paymentMethod} />
      </div>

      {/* --- Summary + submit --------------------------------------------- */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
        <OrderSummary
          variant="checkout"
          action={
            <div className="space-y-2.5">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={submitting || placed}
                disabled={submitting || placed}
              >
                {placed ? "ORDER PLACED" : "PLACE ORDER"}
              </Button>
              <p className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-ash">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                Placing the order does not charge you. No card details are
                collected on this site.
              </p>
            </div>
          }
        />
      </aside>
    </form>
  );
}

export default CheckoutForm;
