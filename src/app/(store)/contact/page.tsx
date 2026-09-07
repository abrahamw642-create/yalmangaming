/**
 * `/contact` — reach the shop.
 *
 * Three routes to a person, in the order they actually get used: WhatsApp, a
 * phone call, and walking in. The form is the fourth, and it is deliberately
 * last in the visual hierarchy — a message typed into a website is the slowest
 * of the four and the page says so rather than pretending otherwise.
 *
 * The store section carries `id="store"`, because the footer links to
 * `/contact#store`.
 *
 * No reply-time promise appears anywhere on this page. The owner has not
 * committed to one, so the site does not invent it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Navigation, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/content/EnquiryForm";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero } from "@/components/content/PageHero";
import {
  ContactActions,
  GoogleRating,
  StoreDetails,
  StoreMap,
} from "@/components/content/StoreInfo";
import { ButtonLink, Card, Divider } from "@/components/ui";
import {
  breadcrumbJsonLd,
  openingHoursJsonLd,
  organizationJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import {
  businessHours,
  contact,
  mapsLinks,
  storeAddress,
  telLink,
  whatsappLink,
} from "@/lib/site";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Contact" }];

export const metadata: Metadata = pageMetadata({
  title: "Contact Yalman Gaming — Hafeez Centre, Gulberg III, Lahore",
  description: `Call or WhatsApp Yalman Gaming on ${contact.phoneDisplay}, or visit the shop at ${storeAddress.oneLine}. Directions, hours and a message form for gaming PC and component enquiries in Lahore.`,
  path: "/contact",
  keywords: [
    "Yalman Gaming contact",
    "computer shop Hafeez Centre Lahore",
    "gaming PC shop Gulberg III",
    "gaming PC Lahore phone number",
  ],
});

const WHATSAPP_MESSAGE =
  "Hi Yalman Gaming — I have a question about a gaming PC.";

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(),
          {
            ...webPageJsonLd({
              type: "ContactPage",
              name: "Contact Yalman Gaming",
              description: `Phone, WhatsApp, directions and opening information for Yalman Gaming at ${storeAddress.oneLine}.`,
              path: "/contact",
            }),
            // Only the closing time was supplied, so this states `closes` and
            // asserts no opening time. See `openingHoursJsonLd`.
            openingHoursSpecification: openingHoursJsonLd(),
          },
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PageHero
        eyebrow="Contact"
        title="Talk to someone who builds these."
        crumbs={CRUMBS}
        lede={
          <>
            The fastest answer is a message or a call — the same number takes
            both. If you would rather see the parts first, we are on the third
            floor of Hafeez Centre.
          </>
        }
        actions={
          <ContactActions message={WHATSAPP_MESSAGE} size="lg" />
        }
        aside={
          <Card className="p-5">
            <p className="eyebrow mb-3">Rated on Google</p>
            <GoogleRating />
            <p className="mt-3 text-xs leading-relaxed text-ash">
              Closes at {businessHours.closingTime}. {businessHours.note}
            </p>
          </Card>
        }
      />

      <div className="container-page py-12 md:py-16">
        {/* --- Three ways to reach us --------------------------------------- */}
        <ul className="grid gap-4 md:grid-cols-3">
          <li>
            <Card className="flex h-full flex-col p-5">
              <MessageCircle
                className="h-5 w-5 text-[#25D366]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h2 className="mt-4 font-display text-base font-semibold text-chrome">
                WhatsApp
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-silver">
                Send a photo of a part, a build list or a screenshot of an error.
                Usually the quickest way to get a straight answer.
              </p>
              <ButtonLink
                href={whatsappLink(WHATSAPP_MESSAGE)}
                variant="whatsapp"
                size="sm"
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="mt-5 self-start"
              >
                Message us
              </ButtonLink>
            </Card>
          </li>

          <li>
            <Card className="flex h-full flex-col p-5">
              <Phone className="h-5 w-5 text-cyan" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="mt-4 font-display text-base font-semibold text-chrome">
                Call the shop
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-silver">
                For anything about price, availability or whether a part will
                fit what you already own.
              </p>
              <a
                href={telLink}
                className="tnum mt-5 self-start font-mono text-lg text-chrome transition-colors hover:text-cyan"
              >
                {contact.phoneDisplay}
              </a>
            </Card>
          </li>

          <li>
            <Card className="flex h-full flex-col p-5">
              <Navigation
                className="h-5 w-5 text-violet"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h2 className="mt-4 font-display text-base font-semibold text-chrome">
                Visit us
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-silver">
                {storeAddress.floor}, {storeAddress.building},{" "}
                {storeAddress.shop}, {storeAddress.block}, {storeAddress.city}.
              </p>
              <ButtonLink
                href={mapsLinks.directions}
                variant="secondary"
                size="sm"
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
                className="mt-5 self-start"
              >
                Get directions
              </ButtonLink>
            </Card>
          </li>
        </ul>

        <Divider className="my-14" />

        {/* --- The store --------------------------------------------------- */}
        <section id="store" aria-labelledby="store-heading" className="scroll-mt-28">
          <h2
            id="store-heading"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            The store
          </h2>
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-silver">
            Hafeez Centre, Gulberg III — the building Lahore goes to for
            computer hardware. We are on the third floor. Come and see a case,
            a keyboard or a monitor in person before you decide on one.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
            <div>
              <StoreDetails />
              <ContactActions
                className="mt-7"
                size="sm"
                message="Hi Yalman Gaming — I would like to visit the shop. Are you open right now?"
              />
            </div>
            <StoreMap />
          </div>
        </section>

        <Divider className="my-14" />

        {/* --- Message form ------------------------------------------------- */}
        <section aria-labelledby="message-heading" className="scroll-mt-28" id="message">
          <div className="max-w-2xl">
            <h2
              id="message-heading"
              className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
            >
              Send us a message
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-silver">
              This reaches the same people as the phone, just more slowly. Leave
              a number we can call you back on and tell us what you are trying
              to do — the more specific it is, the more useful the answer.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ash">
              Putting a whole machine together?{" "}
              <Link href="/quote" className="text-cyan hover:underline">
                Ask for a quote instead
              </Link>{" "}
              — that form asks the questions we would ask anyway.
            </p>
          </div>

          <EnquiryForm variant="contact" className="mt-8 max-w-3xl" />
        </section>
      </div>
    </>
  );
}
