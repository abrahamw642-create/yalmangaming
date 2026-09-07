import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Phone, Search } from "lucide-react";

import { Wordmark } from "@/components/layout/Wordmark";
import { ButtonLink } from "@/components/ui";
import { contact, telLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * The root 404.
 *
 * It sits outside the `(store)` group, so there is no navbar or footer around
 * it — this page has to carry its own way out. Every route it offers exists in
 * the routing map, and the strongest action is the same one it is everywhere
 * else on the site.
 */
export default function NotFound() {
  return (
    <div className="grid-bg relative min-h-screen">
      <div
        aria-hidden="true"
        className="vignette pointer-events-none absolute inset-0"
      />

      <header className="container-page relative flex h-20 items-center">
        <Link href="/" aria-label="Yalman Gaming — home" className="rounded-lg">
          <Wordmark size="md" />
        </Link>
      </header>

      <main
        id="main"
        className="container-page relative flex min-h-[calc(100vh-5rem)] flex-col justify-center py-16"
      >
        <p className="eyebrow">Error 404</p>

        <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight text-chrome-gradient sm:text-6xl md:text-7xl">
          This page is not
          <br />
          in the catalogue.
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-silver">
          The link may be old, or the product may have been renamed. Everything
          Yalman Gaming stocks is still one click away — or start from scratch
          and configure the machine you actually want.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="/builder" size="lg">
            BUILD YOUR PC
          </ButtonLink>
          <ButtonLink href="/shop" variant="secondary" size="lg">
            Browse the shop
          </ButtonLink>
        </div>

        <div className="mt-14 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            {
              href: "/shop/gaming-pcs",
              label: "Gaming PCs",
              detail: "Complete machines, ready to game.",
              icon: <Compass size={16} aria-hidden="true" />,
            },
            {
              href: "/shop/graphics-cards",
              label: "Graphics cards",
              detail: "The part that decides your frame rate.",
              icon: <Search size={16} aria-hidden="true" />,
            },
            {
              href: "/contact",
              label: "Talk to us",
              detail: `Call ${contact.phoneDisplay}.`,
              icon: <Phone size={16} aria-hidden="true" />,
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="metal group flex flex-col gap-2 rounded-2xl p-5 transition-colors hover:border-line-strong"
            >
              <span className="text-cyan">{card.icon}</span>
              <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-chrome">
                {card.label}
                <ArrowRight
                  size={13}
                  aria-hidden="true"
                  className="text-ash transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
              <span className="text-xs leading-relaxed text-ash">{card.detail}</span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm text-ash">
          Looking for something specific?{" "}
          <a
            href={telLink}
            className="font-semibold text-cyan underline-offset-4 hover:underline"
          >
            Call {contact.phoneDisplay}
          </a>{" "}
          and we will tell you whether it is in the shop.
        </p>
      </main>
    </div>
  );
}
