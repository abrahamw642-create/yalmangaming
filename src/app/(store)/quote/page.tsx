/**
 * `/quote` — describe the machine, we price it.
 *
 * The standalone form. It posts to the existing `POST /api/quote`, which takes
 * the contact fields plus an *optional* build object; nothing is attached here,
 * so the budget band and the game list are folded into the message body by
 * `composeQuoteMessage` in `EnquiryForm` rather than sent somewhere the
 * endpoint would ignore them.
 *
 * The builder is the better path when someone already knows what they want —
 * it attaches a real, compatibility-checked part list to the request — so this
 * page points there prominently instead of pretending a text box is equivalent.
 *
 * Deliberately absent: any turnaround promise. The store has not given one.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Cpu,
  MessagesSquare,
  Wrench,
} from "lucide-react";
import { EnquiryForm } from "@/components/content/EnquiryForm";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero } from "@/components/content/PageHero";
import { TalkToUs } from "@/components/content/StoreInfo";
import { ButtonLink, Card } from "@/components/ui";
import { breadcrumbJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { BUDGET_BANDS } from "@/lib/types";
import { formatShortPKR } from "@/lib/utils";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Request a quote" }];

export const metadata: Metadata = pageMetadata({
  title: "Request a Gaming PC Quote — Yalman Gaming, Lahore",
  description:
    "Tell Yalman Gaming your budget and the games you play, and we will spec a gaming PC for you. Custom builds and component quotes from Hafeez Centre, Gulberg III, Lahore.",
  path: "/quote",
  keywords: [
    "gaming PC quote Lahore",
    "custom PC price Pakistan",
    "gaming PC budget Lahore",
    "PC build quote Hafeez Centre",
  ],
});

/** What the shop needs to know before it can price anything. */
const WHAT_HELPS = [
  {
    icon: ClipboardList,
    title: "A budget, even a rough one",
    detail:
      "It decides everything else. A range is fine — the point is knowing which shelf of parts we are talking about.",
  },
  {
    icon: Cpu,
    title: "What you want to run",
    detail:
      "The games, and whether you also edit, stream or render. A competitive shooter and a 4K single-player title want money spent in different places.",
  },
  {
    icon: MessagesSquare,
    title: "What you already own",
    detail:
      "Monitor, keyboard, mouse, an old case or a drive worth keeping. Anything you reuse is money that goes into the parts that matter.",
  },
];

export default function QuotePage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Request a gaming PC quote",
            description:
              "Send Yalman Gaming your budget and requirements and get a custom gaming PC specification back.",
            path: "/quote",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PageHero
        eyebrow="Request a quote"
        title="Tell us the budget. We will tell you what it buys."
        crumbs={CRUMBS}
        lede={
          <>
            No configurator, no jargon required. Say roughly what you want to
            spend and what you play, and we will come back with a specification
            that makes sense at that number — including what we would change if
            you moved it up or down.
          </>
        }
        actions={
          <>
            <ButtonLink href="/builder" variant="primary" size="lg">
              BUILD YOUR PC
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/showcase" variant="outline" size="lg">
              SEE WHAT WE BUILD
            </ButtonLink>
          </>
        }
      />

      <div className="container-page py-12 md:py-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-12">
          {/* --- Form --------------------------------------------------- */}
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold text-chrome sm:text-3xl">
              Your requirements
            </h2>
            <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-silver">
              Everything except your name and a phone number is optional. Skip
              anything you are unsure about — that is what the conversation is
              for.
            </p>

            <EnquiryForm
              variant="quote"
              submitLabel="REQUEST A QUOTE"
              className="mt-8"
            />

            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ash">
              We reply on the number you leave. We have not published a
              turnaround time, so if it is urgent, call the shop or send the
              same thing on WhatsApp — that reaches us immediately.
            </p>
          </div>

          {/* --- Aside -------------------------------------------------- */}
          <aside className="mt-12 space-y-6 lg:sticky lg:top-28 lg:mt-0">
            <Card className="p-5">
              <div className="flex items-center gap-2.5">
                <Wrench className="h-4 w-4 text-cyan" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-chrome">
                  Already know the parts?
                </h2>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-silver">
                Put them into the builder instead. It checks socket, clearance
                and wattage as you go, and sends us the exact part list attached
                to your request — which is a far better starting point than a
                paragraph.
              </p>
              <ButtonLink
                href="/builder"
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
              >
                OPEN THE BUILDER
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </Card>

            <Card className="p-5">
              <p className="eyebrow mb-3">Roughly what each band buys</p>
              <dl className="space-y-3">
                {BUDGET_BANDS.map((band) => (
                  <div key={band.id}>
                    <dt className="tnum font-mono text-xs font-semibold text-chrome">
                      {/* The lowest band starts at zero and the highest is
                          open-ended, so neither reads well as a range. */}
                      {band.max === null
                        ? `${formatShortPKR(band.min)}+`
                        : band.min === 0
                          ? `Under ${formatShortPKR(band.max)}`
                          : `${formatShortPKR(band.min)} – ${formatShortPKR(band.max)}`}
                    </dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-silver">
                      {band.blurb}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[0.6875rem] leading-relaxed text-ash">
                Guidance for choosing a band, not a price list. Component prices
                move, so the specification we quote is what counts.
              </p>
            </Card>
          </aside>
        </div>

        {/* --- What helps --------------------------------------------- */}
        <section className="mt-16" aria-labelledby="what-helps">
          <h2
            id="what-helps"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            What makes a quote useful
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {WHAT_HELPS.map((item) => (
              <li key={item.title}>
                <Card className="h-full p-5">
                  <item.icon
                    className="h-5 w-5 text-cyan"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 font-display text-base font-semibold text-chrome">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-silver">
                    {item.detail}
                  </p>
                </Card>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ash">
            Want us to assemble parts you already have, or bought elsewhere?
            That is a separate service —{" "}
            <Link href="/assembly" className="text-cyan hover:underline">
              see what it covers
            </Link>
            .
          </p>
        </section>

        <TalkToUs
          className="mt-14"
          title="Rather just talk it through?"
          description="Most builds get decided in a five-minute conversation. Call the shop or send us a message and skip the form entirely."
          message="Hi Yalman Gaming — I would like a quote for a gaming PC."
        />
      </div>
    </>
  );
}
