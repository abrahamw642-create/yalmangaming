"use client";

/**
 * Right-hand cart slide-over.
 *
 * Behaves like a real modal dialog: focus moves in on open and is trapped
 * inside, Escape closes, the page behind cannot scroll, and focus returns to
 * whatever opened it. Rendered through a portal so a `transform` or
 * `backdrop-filter` on an ancestor cannot trap it in a stacking context.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShoppingCart, X } from "lucide-react";
import { Button, ButtonLink, SamplePricingNote } from "@/components/ui";
import { cn, formatPKR, pluralize } from "@/lib/utils";
import { DELIVERY_LABEL, DELIVERY_NOTE } from "@/lib/cart";
import { CartLineList } from "./CartLineItem";
import { useCart } from "./CartProvider";

/** Everything focusable, in DOM order, that is not currently disabled. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { items, totals, open, setOpen, hydrated } = useCart();
  const reduceMotion = useReducedMotion();

  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusTo = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  /* --- Focus in, focus back ---------------------------------------------- */
  React.useEffect(() => {
    if (!open) return;

    // Capture whatever had focus so it can be handed back on close. This works
    // for any trigger — header button, product card, builder summary bar.
    restoreFocusTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Wait a frame so the panel has been painted before focusing into it.
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  /* --- Escape + focus trap ------------------------------------------------ */
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped the panel.
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  /* --- Scroll lock -------------------------------------------------------- */
  React.useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    // Replace the scrollbar's width with padding, otherwise the page behind
    // visibly jumps sideways as it is locked.
    const scrollbar = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  if (!mounted) return null;

  const duration = reduceMotion ? 0 : 0.32;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] no-print" role="presentation">
          <motion.div
            className="absolute inset-0 bg-void/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={close}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            tabIndex={-1}
            className={cn(
              "glass-strong absolute inset-y-0 right-0 flex w-full max-w-[27rem] flex-col",
              "border-l border-line-strong shadow-[var(--shadow-lift)] outline-none",
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* --- Header ------------------------------------------------- */}
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2
                id="cart-drawer-title"
                className="flex items-center gap-2 font-display text-lg font-semibold text-chrome"
              >
                <ShoppingCart size={18} className="text-cyan" aria-hidden="true" />
                Your Cart
                {hydrated && totals.count > 0 && (
                  <span className="tnum font-mono text-sm font-normal text-ash">
                    {totals.count} {pluralize(totals.count, "item")}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2 text-silver transition-colors hover:bg-white/5 hover:text-chrome"
                aria-label="Close cart"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {/* --- Lines -------------------------------------------------- */}
            <div className="no-scrollbar flex-1 overflow-y-auto px-5">
              <CartLineList variant="drawer" />
            </div>

            {/* --- Totals ------------------------------------------------- */}
            {hydrated && items.length > 0 && (
              <footer className="border-t border-line bg-void/40 px-5 py-4">
                <dl className="space-y-2 text-sm">
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

                  <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2.5">
                    <dt className="font-display font-semibold text-chrome">
                      Estimated total
                    </dt>
                    <dd className="tnum font-display text-xl font-semibold text-chrome">
                      {formatPKR(totals.total)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-2 text-[0.6875rem] leading-relaxed text-ash">
                  {DELIVERY_NOTE}
                </p>

                {items.some((line) => line.samplePrice) && (
                  <SamplePricingNote className="mt-3" />
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <ButtonLink
                    href="/checkout"
                    variant="primary"
                    size="lg"
                    onClick={close}
                    className="w-full"
                  >
                    CHECKOUT
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                  <Button variant="ghost" size="md" onClick={close} className="w-full">
                    CONTINUE SHOPPING
                  </Button>
                </div>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default CartDrawer;
