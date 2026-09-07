/**
 * The store's real-world details, reused by /contact, the policy pages and the
 * assembly page.
 *
 * Every fact rendered here comes from `@/lib/site`. Note what is deliberately
 * absent: no opening time, no delivery window, no "we reply within X hours".
 * The owner confirmed a closing time and nothing else about the schedule.
 */

import * as React from "react";
import {
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";
import {
  businessHours,
  contact,
  mapsLinks,
  ratings,
  siteConfig,
  storeAddress,
  telLink,
  whatsappLink,
} from "@/lib/site";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Get directions / call / WhatsApp.
 *
 * All three are plain links, so they work with a keyboard, open in the phone's
 * native handler, and can be long-pressed to copy — which is what people
 * actually do with a shop's number.
 */
export function ContactActions({
  message,
  className,
  size = "md",
}: {
  /** Prefilled WhatsApp text. Keep it specific to the page it sits on. */
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      <ButtonLink
        href={mapsLinks.directions}
        variant="primary"
        size={size}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        Get directions
      </ButtonLink>
      <ButtonLink href={telLink} variant="secondary" size={size} prefetch={false}>
        <Phone className="h-4 w-4" aria-hidden="true" />
        Call {contact.phoneDisplay}
      </ButtonLink>
      <ButtonLink
        href={whatsappLink(message)}
        variant="whatsapp"
        size={size}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        WhatsApp
      </ButtonLink>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Address + hours                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The address block.
 *
 * `businessHours.summary` reads "Open now — closes at 9 PM"; this component
 * renders only the closing half. "Open now" is a claim about the current
 * moment that a statically rendered page cannot make truthfully.
 */
export function StoreDetails({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex gap-3.5">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-chrome">
            Visit the shop
          </p>
          <address className="mt-2 not-italic text-sm leading-relaxed text-silver">
            {storeAddress.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
      </div>

      <div className="flex gap-3.5">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-chrome">
            Call or WhatsApp
          </p>
          <a
            href={telLink}
            className="tnum mt-2 block font-mono text-lg text-chrome transition-colors hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>
          <p className="mt-1 text-sm text-ash">
            The same number takes calls and WhatsApp messages.
          </p>
        </div>
      </div>

      <div className="flex gap-3.5">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-chrome">
            Hours
          </p>
          <p className="mt-2 text-sm text-silver">
            Closes at {businessHours.closingTime}.
          </p>
          <p className="mt-1 text-sm text-ash">{businessHours.note}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Google rating as supplied by the owner. Deliberately no review text: the
 * store has 95 Google reviews and the site has none of their wording, so
 * quoting one would mean writing it.
 */
export function GoogleRating({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-4 w-4 fill-ember text-ember" />
        ))}
      </div>
      <p className="text-sm text-silver">
        <span className="tnum font-mono font-semibold text-chrome">
          {ratings.google.score.toFixed(1)}
        </span>{" "}
        from{" "}
        <span className="tnum font-mono font-semibold text-chrome">
          {ratings.google.count}
        </span>{" "}
        {ratings.google.label} reviews
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Map                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Embedded Google map.
 *
 * Lazy-loaded: it is a third-party iframe below the fold, and loading it
 * eagerly would hand Google a request from every visitor who never scrolls to
 * it. The privacy page says this embed exists — keep the two in step.
 */
export function StoreMap({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-graphite",
        className,
      )}
    >
      <iframe
        title={`Map showing ${siteConfig.name} at ${storeAddress.building}, ${storeAddress.city}`}
        src={mapsLinks.embed}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-72 w-full border-0 grayscale-[35%] contrast-110 md:h-96"
        allowFullScreen
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-carbon/80 px-4 py-3">
        <p className="text-xs text-ash">{storeAddress.oneLine}</p>
        <a
          href={mapsLinks.place}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-cyan transition-colors hover:text-chrome"
        >
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing CTA                                                                */
/* -------------------------------------------------------------------------- */

/** "Ask a human" strip that closes the policy and content pages. */
export function TalkToUs({
  title = "Still not sure? Ask us.",
  description,
  message,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-6 md:p-8", className)}>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-xl font-semibold text-chrome">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-silver">
            {description ??
              "We answer hardware questions all day. Call the shop, message us on WhatsApp, or walk into Hafeez Centre and see the parts in person."}
          </p>
        </div>
        <ContactActions message={message} size="md" className="shrink-0" />
      </div>
    </Card>
  );
}

/**
 * Small helper for pages that need a bare WhatsApp button in their own layout.
 * Kept here so the prefilled-message convention lives in one file.
 */
export function WhatsAppButton({
  message,
  label = "WhatsApp us",
  size = "md",
  className,
}: {
  message?: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <ButtonLink
      href={whatsappLink(message)}
      variant="whatsapp"
      size={size}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      className={className}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </ButtonLink>
  );
}
