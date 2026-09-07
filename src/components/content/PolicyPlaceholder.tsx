/**
 * The honesty layer for Yalman Gaming's policy pages.
 *
 * Yalman Gaming has not supplied warranty, returns, shipping, privacy or terms
 * text. Rather than ship plausible-sounding boilerplate — which a customer
 * would read as a promise and the store would then be held to — every
 * unconfirmed clause renders through `<PolicyPlaceholder>`: real page
 * structure, real headings, and a visibly marked gap where the commitment
 * goes.
 *
 * The result is a form for the owner to fill in rather than false claims for a
 * customer to discover later. Nothing in this module should ever be softened
 * into a default value.
 */

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, MessageCircle, Phone, PencilLine } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/shop/Breadcrumbs";
import { ButtonLink } from "@/components/ui";
import { contact, telLink, whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* The placeholder itself                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A clause Yalman Gaming has not confirmed.
 *
 * `children` describes *what* has to be decided, in plain language, so the
 * owner can answer it without a lawyer and a customer can see exactly what is
 * unknown. It is never a draft of the answer.
 */
export function PolicyPlaceholder({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "my-4 flex gap-3 rounded-xl border border-dashed border-ember/45 bg-ember/[0.06] px-4 py-3.5",
        className,
      )}
    >
      <PencilLine
        className="mt-0.5 h-4 w-4 shrink-0 text-ember"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ember">
          [Yalman Gaming to confirm]
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-silver">{children}</p>
      </div>
    </div>
  );
}

/**
 * Inline variant for a single missing value inside a sentence — a number of
 * days, a fee, a city list.
 */
export function PolicyValue({ children }: { children?: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1.5 rounded border border-dashed border-ember/50 bg-ember/[0.08] px-1.5 py-0.5 align-baseline font-mono text-[0.6875rem] uppercase tracking-wider text-ember">
      {children ?? "to confirm"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level draft notice                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The banner every policy page opens with. States plainly that the terms are
 * being finalised and routes the customer to a human, because on these pages a
 * phone call is a better answer than the page is.
 */
export function PolicyDraftNotice({
  subject,
  className,
}: {
  /** What this page covers, e.g. "warranty terms". */
  subject: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass rounded-2xl border-ember/30 p-5 md:p-6",
        className,
      )}
      role="note"
    >
      <div className="flex gap-3.5">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-ember"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-chrome">
            This page is a template — {subject} are still being finalised
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-silver">
            Yalman Gaming has not published {subject} yet. Everything marked{" "}
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-ember">
              [Yalman Gaming to confirm]
            </span>{" "}
            below is a gap, not a commitment — please do not treat it as one.
            For a straight answer today, call the shop or message us on
            WhatsApp; whatever we tell you on that call is what applies.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ButtonLink
              href={telLink}
              variant="secondary"
              size="sm"
              prefetch={false}
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {contact.phoneDisplay}
            </ButtonLink>
            <ButtonLink
              href={whatsappLink(
                `Hi Yalman Gaming — I have a question about ${subject}.`,
              )}
              variant="whatsapp"
              size="sm"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost" size="sm">
              Contact the store
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export type PolicySection = {
  /** Anchor id — also the jump-list target. */
  id: string;
  title: string;
  body: React.ReactNode;
};

/**
 * Shared shell for the five policy pages: masthead, draft banner, jump list,
 * numbered sections and a closing "ask a human" strip.
 *
 * Pages supply their sections as data so the structure of a policy page is
 * defined once and every page is obviously the same document type.
 */
export function PolicyLayout({
  eyebrow,
  title,
  subject,
  lede,
  sections,
  crumbs,
  footnote,
}: {
  eyebrow: string;
  title: string;
  /** Plural noun used in the draft notice, e.g. "warranty terms". */
  subject: string;
  lede: React.ReactNode;
  sections: PolicySection[];
  crumbs: Crumb[];
  /** Optional closing paragraph under the last section. */
  footnote?: React.ReactNode;
}) {
  return (
    <div className="pb-20">
      <div className="relative overflow-hidden border-b border-line">
        <div
          className="grid-bg pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
        />
        <div className="container-page relative py-10 md:py-14">
          <Breadcrumbs items={crumbs} className="mb-6" />
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-chrome-gradient sm:text-5xl">
            {title}
          </h1>
          <div className="mt-5 max-w-2xl text-base leading-relaxed text-silver">
            {lede}
          </div>
        </div>
      </div>

      <div className="container-page pt-8">
        <PolicyDraftNotice subject={subject} />
      </div>

      <div className="container-page mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-12">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <div className="flex items-baseline gap-3">
                <span className="tnum font-mono text-xs text-ash">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-xl font-semibold text-chrome sm:text-2xl">
                  {section.title}
                </h2>
              </div>
              <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-silver">
                {section.body}
              </div>
            </section>
          ))}

          {footnote && (
            <div className="border-t border-line pt-6 text-sm leading-relaxed text-ash">
              {footnote}
            </div>
          )}
        </div>

        {/* Jump list. Sticky on desktop, a plain list on a phone. */}
        <nav
          aria-label="On this page"
          className="mt-12 lg:sticky lg:top-28 lg:mt-0"
        >
          <p className="eyebrow mb-3">On this page</p>
          <ol className="space-y-2 border-l border-line pl-4">
            {sections.map((section) => (
              <li key={section.id}>
                <Link
                  href={`#${section.id}`}
                  className="text-sm text-ash transition-colors hover:text-chrome"
                >
                  {section.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
