/**
 * Section 10 — Customer reviews.
 *
 * The one section on this page with a hard rule attached: **no review text is
 * written here.**
 *
 * Yalman Gaming has a 5.0 rating from 95 Google reviews, and the site has the
 * numbers but not a single word of what those reviewers actually said. The
 * seed creates zero `Review` rows for exactly that reason. So this component
 * has two paths:
 *
 *   - approved reviews exist  → render them, verbatim, attributed
 *   - none exist (today)      → present the aggregate rating honestly, say
 *                               plainly that the written reviews live on
 *                               Google, and invite a customer to leave one
 *
 * The empty path is the designed state, not a placeholder. It never shows an
 * anonymous quote, an initial-only name, a "coming soon", or a star average
 * derived from nothing.
 *
 * Note the distinction the copy keeps: 5.0 / 95 is the **store's** Google
 * rating. It is never presented as a rating of any individual product — every
 * product in the catalogue genuinely has zero reviews.
 */

import Link from "next/link";
import { ExternalLink, MessageCircle, Quote, ShieldCheck, Star } from "lucide-react";
import { Badge, ButtonLink, Rating } from "@/components/ui";
import { mapsLinks, ratings, siteConfig, whatsappLink } from "@/lib/site";
import { cn, formatDate } from "@/lib/utils";
import { Reveal } from "./Reveal";

/** An approved review, flattened by the page. */
export type HomeReview = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  /** ISO string — a `Date` would not survive the server/client boundary. */
  createdAt: string;
  productName: string | null;
  productSlug: string | null;
};

const REVIEW_PROMPT =
  "Hi Yalman Gaming — I bought from you and would like to leave a review.";

export function TrustSection({ reviews }: { reviews: HomeReview[] }) {
  const google = ratings.google;
  const facebook = ratings.facebook;

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          {/* --- Aggregate ------------------------------------------------ */}
          <Reveal>
            <p className="eyebrow">Reputation</p>
            <h2
              id="reviews-heading"
              className="mt-4 font-display text-[clamp(1.875rem,4.5vw,3rem)] font-bold leading-[1.02] tracking-tight text-chrome-gradient"
            >
              Trusted by Lahore&rsquo;s
              <br />
              gaming community.
            </h2>

            <div className="mt-8 flex items-end gap-5">
              <span
                className="tnum font-display text-6xl font-bold leading-none text-chrome"
                aria-hidden="true"
              >
                {google.score.toFixed(1)}
              </span>
              <div className="pb-1">
                <Rating
                  value={google.score}
                  count={google.count}
                  size="lg"
                  showValue={false}
                />
                <p className="mt-2 text-sm text-silver">
                  <span className="tnum font-mono font-semibold text-chrome">
                    {google.count}
                  </span>{" "}
                  {google.label} reviews
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-md text-base leading-relaxed text-silver">
              That is the rating for the shop as a whole — the counter at Hafeez
              Centre, the advice and the machines we build. Every word of it was
              written on {google.label} and {facebook.label}, so that is where
              you can read it.
            </p>

            <ul className="mt-7 flex flex-wrap gap-2">
              <li>
                <Badge tone="ember">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  {google.score.toFixed(1)} on {google.label}
                </Badge>
              </li>
              <li>
                {/* Facebook supplied a score but no review count, so none is
                    shown — an invented denominator is still an invention. */}
                <Badge tone="cyan">
                  {facebook.score.toFixed(1)} / 5 on {facebook.label}
                </Badge>
              </li>
            </ul>
          </Reveal>

          {/* --- Reviews, or the honest absence of them ------------------- */}
          <Reveal delay={0.06}>
            {reviews.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <ReviewCard review={review} />
                  </li>
                ))}
              </ul>
            ) : (
              <NoWrittenReviews />
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What this page shows when there is nothing to quote.
 *
 * It is deliberately explicit about *why* the panel is empty. "We have not
 * published any yet" is a fact about this website; "5.0 from 95 reviews" is a
 * fact about the shop. Both are true at the same time, and saying so is more
 * persuasive than a wall of quotes nobody can verify.
 */
function NoWrittenReviews() {
  return (
    <div className="metal relative isolate overflow-hidden rounded-2xl p-8 md:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-cyan/10 blur-3xl"
      />

      <Quote className="h-8 w-8 text-iron" strokeWidth={1.5} aria-hidden="true" />

      <h3 className="mt-5 font-display text-xl font-semibold text-chrome">
        We have not published any written reviews here.
      </h3>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">
        The {ratings.google.count} reviews behind that rating were written on{" "}
        {ratings.google.label}, and they belong to the people who wrote them —
        so rather than paraphrase, we link you straight to them. When customers
        review us on this site, their words will appear right here, with their
        name and the product they bought.
      </p>

      <ul className="mt-6 space-y-2.5 text-sm text-ash">
        <li className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald"
            aria-hidden="true"
          />
          No review on this site is written by us, and none is edited.
        </li>
        <li className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald"
            aria-hidden="true"
          />
          Product ratings stay blank until a real customer leaves one.
        </li>
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink
          href={mapsLinks.place}
          variant="secondary"
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          READ THEM ON {ratings.google.label.toUpperCase()}
        </ButtonLink>
        <ButtonLink
          href={whatsappLink(REVIEW_PROMPT)}
          variant="whatsapp"
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          LEAVE A REVIEW
        </ButtonLink>
      </div>

      <p className="mt-4 text-xs text-ash">
        Bought from {siteConfig.name}? Tell us how it went — good or bad.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Populated state                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Renders one approved review exactly as it was written. This path has no rows
 * to render today; it exists so that the moment Yalman approves one from the
 * admin, it appears here without a code change.
 */
function ReviewCard({ review }: { review: HomeReview }) {
  return (
    <article className={cn("metal flex h-full flex-col rounded-2xl p-6")}>
      <Rating value={review.rating} size="sm" showValue={false} />

      {review.title && (
        <h3 className="mt-4 font-display text-base font-semibold text-chrome">
          {review.title}
        </h3>
      )}

      <p className="mt-2 flex-1 text-sm leading-relaxed text-silver">
        {review.body}
      </p>

      <footer className="mt-5 border-t border-[var(--color-line)] pt-4">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-chrome">
          {review.authorName}
          {review.verified && <Badge tone="emerald">Verified buyer</Badge>}
        </p>
        <p className="mt-1 text-xs text-ash">
          {formatDate(review.createdAt)}
          {review.productName && review.productSlug && (
            <>
              {" · "}
              <Link
                href={`/product/${review.productSlug}`}
                className="text-silver transition-colors hover:text-cyan"
              >
                {review.productName}
              </Link>
            </>
          )}
        </p>
      </footer>
    </article>
  );
}

export default TrustSection;
