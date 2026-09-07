import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { businessHours, contact, storeAddress, telLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Place your order with Yalman Gaming — cash on delivery, bank transfer or a secure payment link.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="container-page py-10 md:py-14">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-silver transition-colors hover:text-cyan"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to cart
      </Link>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-chrome-gradient sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-silver">
            Yalman Gaming confirms stock, pricing and the delivery charge on a
            call before anything is dispatched.
          </p>
        </div>

        {/* Some customers would rather finish this on the phone or in person. */}
        <div className="flex flex-col gap-1.5 text-sm text-silver md:text-right">
          <a
            href={telLink}
            className="inline-flex items-center gap-2 font-medium text-chrome transition-colors hover:text-cyan md:justify-end"
          >
            <Phone size={15} aria-hidden="true" />
            <span className="tnum font-mono">{contact.phoneDisplay}</span>
          </a>
          <span className="inline-flex items-start gap-2 text-xs text-ash md:justify-end">
            <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {storeAddress.building}, {storeAddress.city} — {businessHours.summary}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-8">
        <CheckoutForm />
      </div>
    </div>
  );
}
