import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { CartLineList } from "@/components/cart/CartLineItem";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your Cart",
  description:
    "Review the components and custom builds in your Yalman Gaming cart before checkout.",
  // A cart is per-visitor and has nothing to index.
  robots: { index: false, follow: true },
};

/**
 * The cart page is a server shell around two client leaves: the line list and
 * the summary. Both read the same `useCart()` state, so the totals here and in
 * the drawer are the same numbers computed by the same function.
 */
export default function CartPage() {
  return (
    // The `(store)` layout owns the <main> landmark; pages render inside it.
    <div className="container-page py-10 md:py-14">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-silver transition-colors hover:text-cyan"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Continue shopping
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-chrome-gradient sm:text-4xl">
        Your Cart
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10">
        <div className="min-w-0">
          <CartLineList variant="page" />

          <div className="mt-8 rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="font-display font-semibold text-chrome">
              Not sure a part fits?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-silver">
              Send us the list on WhatsApp and the bench will check it with you,
              or configure the whole machine in the builder and let the
              compatibility engine do it live.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink
                href={whatsappLink(
                  "Hi Yalman Gaming, I have a few items in my cart and wanted to check compatibility.",
                )}
                variant="whatsapp"
                size="md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} aria-hidden="true" />
                ASK ON WHATSAPP
              </ButtonLink>
              <ButtonLink href="/builder" variant="outline" size="md">
                OPEN THE BUILDER
              </ButtonLink>
            </div>
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
          <OrderSummary
            variant="cart"
            action={
              <ButtonLink
                href="/checkout"
                variant="primary"
                size="lg"
                className="w-full"
              >
                CHECKOUT
                <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>
            }
          />
        </aside>
      </div>
    </div>
  );
}
