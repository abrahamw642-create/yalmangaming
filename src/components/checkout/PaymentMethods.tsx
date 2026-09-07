"use client";

/**
 * Payment method chooser.
 *
 * There is no payment gateway configured for this site, and this component
 * deliberately collects **no** card data — no number, no expiry, no CVV, no
 * cardholder name. Choosing "Card" places the order as payment pending and
 * Yalman Gaming follows up with a secure link. When a gateway is added, the
 * only change is a new handler in `@/lib/orders`; nothing here moves.
 */

import * as React from "react";
import { Banknote, CreditCard, Landmark, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/cart";
import type { PaymentMethodId } from "@/lib/validation";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  banknote: Banknote,
  landmark: Landmark,
  "credit-card": CreditCard,
};

export function PaymentMethods({
  value,
  onChange,
  error,
  className,
}: {
  value: PaymentMethodId;
  onChange: (next: PaymentMethodId) => void;
  error?: string;
  className?: string;
}) {
  const groupId = React.useId();
  const options = PAYMENT_METHOD_OPTIONS.filter((option) => option.enabled);

  return (
    <fieldset className={className}>
      <legend className="font-display text-lg font-semibold text-chrome">
        How would you like to pay?
      </legend>

      {/* Native radios sharing one `name` inside a fieldset already announce
          as a group — no ARIA role needed on the wrapper. */}
      <div className="mt-4 space-y-3">
        {options.map((option) => {
          const Icon = ICONS[option.icon] ?? CreditCard;
          const selected = value === option.id;
          const inputId = `${groupId}-${option.id}`;

          return (
            <label
              key={option.id}
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer gap-3.5 rounded-xl border p-4 transition-all duration-200",
                selected
                  ? "border-cyan/60 bg-cyan/[0.06] shadow-glow-xs"
                  : "border-line-strong bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.04]",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name="paymentMethod"
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />

              {/* Custom radio dot — the real input stays in the DOM for
                  keyboard and screen-reader support. */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected ? "border-cyan" : "border-line-strong",
                )}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-cyan" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Icon size={17} className={selected ? "text-cyan" : "text-silver"} />
                  <span className="font-medium text-chrome">{option.label}</span>
                </span>
                <span className="mt-1 block text-sm text-silver">{option.summary}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ash">
                  {option.detail}
                </span>

                {selected && option.requiresGateway && (
                  <span className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-void/40 px-3 py-2 text-xs leading-relaxed text-silver">
                    <Lock size={13} className="mt-0.5 shrink-0 text-cyan" aria-hidden="true" />
                    <span>
                      This site never asks for card numbers. If anyone asks you
                      for card or OTP details over a call or chat, it is not
                      Yalman Gaming.
                    </span>
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose">
          {error}
        </p>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ash">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald" aria-hidden="true" />
        Yalman Gaming confirms every order by phone before dispatch. Nothing is
        charged when you place it here.
      </p>
    </fieldset>
  );
}

export default PaymentMethods;
