/**
 * Section 11 — Visit the store.
 *
 * Yalman Gaming is a physical shop first, so this section is the one that has
 * to survive being screenshotted and sent to a friend: address, phone, closing
 * time, map, and three buttons that do the three things a visitor actually
 * wants — navigate there, ring it, or message it.
 *
 * The address block, the map embed and the rating all come from
 * `@/components/content/StoreInfo`, which reads `@/lib/site`. Reusing it means
 * the home page cannot drift from the contact page: there is one copy of the
 * store's details on this site and this is not it.
 *
 * Two absences are deliberate and must stay: **no opening time** (only the
 * closing time was confirmed) and **no delivery promise** of any kind.
 */

import { MessageCircle, Navigation, Phone } from "lucide-react";
import { StoreDetails, StoreMap } from "@/components/content/StoreInfo";
import { ButtonLink } from "@/components/ui";
import {
  businessHours,
  contact,
  mapsLinks,
  storeAddress,
  telLink,
  whatsappLink,
} from "@/lib/site";
import { Reveal } from "./Reveal";

const VISIT_PROMPT =
  "Hi Yalman Gaming — I found you online and want to ask about a build.";

export function StoreLocation() {
  return (
    <section
      id="store"
      aria-labelledby="store-heading"
      className="relative isolate overflow-hidden border-y border-[var(--color-line)] bg-carbon py-20 md:py-28"
    >
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-50" />

      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          {/* --- Details -------------------------------------------------- */}
          <Reveal>
            <p className="eyebrow">Come and see it</p>
            <h2
              id="store-heading"
              className="mt-4 font-display text-[clamp(1.875rem,5vw,3.25rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em] text-chrome-gradient"
            >
              Visit Yalman
              <br />
              Gaming
            </h2>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-silver">
              We are on the {storeAddress.floor.toLowerCase()} of{" "}
              {storeAddress.building}, {storeAddress.block} — the floor Lahore
              buys its computer hardware on. Walk in, see the parts in your hand
              and talk the build through with someone who assembles them daily.
            </p>

            <StoreDetails className="mt-9" />

            {/* The three things a visitor is actually here to do. */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink
                href={mapsLinks.directions}
                size="lg"
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="w-full sm:w-auto"
              >
                <Navigation className="h-4 w-4" aria-hidden="true" />
                GET DIRECTIONS
              </ButtonLink>

              <ButtonLink
                href={telLink}
                variant="secondary"
                size="lg"
                prefetch={false}
                className="w-full sm:w-auto"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                CALL STORE
              </ButtonLink>

              <ButtonLink
                href={whatsappLink(VISIT_PROMPT)}
                variant="whatsapp"
                size="lg"
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="w-full sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WHATSAPP US
              </ButtonLink>
            </div>

            <p className="mt-5 text-sm text-ash">
              {contact.phoneDisplay} · Closes at {businessHours.closingTime}.{" "}
              {businessHours.note}
            </p>
          </Reveal>

          {/* --- Map ------------------------------------------------------ */}
          <Reveal delay={0.06} className="lg:sticky lg:top-24 lg:self-start">
            {/* `StoreMap` renders a titled, lazily-loaded iframe: the embed is
                third-party and below the fold, so nobody who never scrolls here
                should be sending Google a request. */}
            <StoreMap />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default StoreLocation;
