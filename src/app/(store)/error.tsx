"use client";

/**
 * The storefront error boundary.
 *
 * Renders inside the `(store)` layout, so the navbar, footer and cart are all
 * still there — only the page body has been replaced. That matters: a shopper
 * who hits an error mid-browse should be able to carry on rather than be
 * dumped on a dead end.
 *
 * `reset()` re-renders the segment. It is offered first because most failures
 * here are transient (a dropped database connection, a request that timed out),
 * and a second attempt genuinely fixes them.
 */

import * as React from "react";
import Link from "next/link";
import { MessageCircle, Phone, RotateCw, TriangleAlert } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui";
import { contact, telLink, whatsappLink } from "@/lib/site";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The overlay only shows this in development; logging keeps it reachable
    // from a production browser console when a customer reports a problem.
    console.error("[Yalman] Storefront error:", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col justify-center py-20">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ember">
          <TriangleAlert size={13} aria-hidden="true" />
          Something broke
        </span>

        <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-chrome-gradient sm:text-5xl">
          This page did not load.
        </h1>

        <p className="mt-5 text-base leading-relaxed text-silver">
          The fault is at our end, not yours — nothing you did caused it, and
          nothing in your cart or your saved build has been lost. Trying again
          usually works.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={reset}>
            <RotateCw size={16} aria-hidden="true" />
            Try again
          </Button>
          <ButtonLink href="/shop" variant="secondary" size="lg">
            Browse the shop
          </ButtonLink>
          <ButtonLink href="/builder" variant="outline" size="lg">
            Open the PC builder
          </ButtonLink>
        </div>

        <div className="rule-fade my-10" />

        <p className="text-sm text-silver">
          If it keeps happening, tell us what you were looking at and we will
          sort it out:
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={telLink}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-medium text-chrome transition-colors hover:border-cyan/50"
          >
            <Phone size={15} className="text-cyan" aria-hidden="true" />
            {contact.phoneDisplay}
          </a>
          <a
            href={whatsappLink(
              "Hi Yalman Gaming — a page on your website failed to load for me.",
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-medium text-chrome transition-colors hover:border-[#25D366]/50"
          >
            <MessageCircle size={15} className="text-[#25D366]" aria-hidden="true" />
            WhatsApp
          </a>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-silver transition-colors hover:text-chrome"
          >
            Contact page
          </Link>
        </div>

        {error.digest && (
          // Quote this back to us and the exact failure is findable in the logs.
          <p className="mt-8 font-mono text-xs text-ash">
            Reference: <span className="text-silver">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
