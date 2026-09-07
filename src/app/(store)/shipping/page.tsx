/**
 * `/shipping` — a template, not a policy.
 *
 * The site has exactly one delivery-related figure anywhere in it: the
 * `delivery` entry in `ASSEMBLY_SERVICES`, which is sample data and whose own
 * description says the cost varies by city and is confirmed on quote. No
 * delivery timeframe, courier, coverage area or free-delivery threshold has
 * been supplied, so none is stated here.
 *
 * Listed in `DRAFT_POLICY_PATHS`: noindexed, and out of the sitemap, until the
 * terms are real.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/content/JsonLd";
import {
  PolicyLayout,
  PolicyPlaceholder,
  PolicyValue,
  type PolicySection,
} from "@/components/content/PolicyPlaceholder";
import { TalkToUs } from "@/components/content/StoreInfo";
import { breadcrumbJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { businessHours, contact, mapsLinks, storeAddress } from "@/lib/site";
import { ASSEMBLY_SERVICES } from "@/lib/types";
import { formatPKR } from "@/lib/utils";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Shipping" }];

export const metadata: Metadata = pageMetadata({
  title: "Shipping & Delivery",
  description:
    "Collection and delivery information for Yalman Gaming, Hafeez Centre, Gulberg III, Lahore. Delivery areas, costs and timings are being finalised — call the shop for today's answer.",
  path: "/shipping",
});

const DELIVERY_SAMPLE =
  ASSEMBLY_SERVICES.find((service) => service.id === "delivery")?.price ?? null;

const SECTIONS: PolicySection[] = [
  {
    id: "collection",
    title: "Collecting from the shop",
    body: (
      <>
        <p>
          The one option we can describe without guessing. Yalman Gaming is a
          physical shop at {storeAddress.oneLine}, and you can buy and collect
          there in person. We close at {businessHours.closingTime};{" "}
          {businessHours.note.toLowerCase()}
        </p>
        <p>
          <a
            href={mapsLinks.directions}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan hover:underline"
          >
            Get directions
          </a>{" "}
          or call{" "}
          <a
            href={`tel:+${contact.phoneE164}`}
            className="tnum font-mono text-chrome hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>{" "}
          before you set off, so we can confirm the item is on the shelf.
        </p>
        <PolicyPlaceholder>
          Whether an online order can be reserved for collection, how long it is
          held, and whether payment is taken before or at collection.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "where-we-deliver",
    title: "Where we deliver",
    body: (
      <>
        <p>
          Delivery is offered — it appears as an option when a build is
          configured — but the coverage has not been written down anywhere we
          can quote from.
        </p>
        <PolicyPlaceholder>
          Which cities are served, whether delivery is available outside Lahore
          and outside Punjab, and whether the answer differs for a whole PC and
          a single component.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Which courier or delivery service is used, and whether Yalman Gaming
          delivers locally itself.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "cost",
    title: "What delivery costs",
    body: (
      <>
        <p>
          The builder lists delivery as a service with a sample figure of{" "}
          {DELIVERY_SAMPLE !== null ? formatPKR(DELIVERY_SAMPLE) : "—"}, marked{" "}
          <span className="font-mono text-ember">sample</span> like every other
          seeded price on this site. Its own description says the cost varies by
          city and is confirmed when we quote, which is the honest position:
          that number is a placeholder, not a rate.
        </p>
        <PolicyPlaceholder>
          The real delivery rates — by city, by weight or by order value — and
          whether a whole PC is charged differently from a small part.
        </PolicyPlaceholder>
        <p>
          A free-delivery threshold, if there is one, is{" "}
          <PolicyValue>to confirm</PolicyValue>.
        </p>
      </>
    ),
  },
  {
    id: "timing",
    title: "How long it takes",
    body: (
      <>
        <p>
          No delivery timeframe appears anywhere on this site, deliberately. A
          promised date is the single easiest thing to get wrong on a hardware
          order, because it depends on stock, on whether the machine has to be
          assembled and tested first, and on the courier.
        </p>
        <PolicyPlaceholder>
          Dispatch and delivery timeframes, including whether an assembled build
          takes longer than a boxed part, and what happens over public holidays.
        </PolicyPlaceholder>
        <p>
          Ask when you order and we will tell you what is realistic for your
          item that week.
        </p>
      </>
    ),
  },
  {
    id: "tracking",
    title: "Tracking and handover",
    body: (
      <>
        <PolicyPlaceholder>
          Whether a tracking number is provided, and how a customer is told
          their order is on the way.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether someone has to be present to receive a delivery, whether ID is
          checked, and what happens on a failed delivery attempt.
        </PolicyPlaceholder>
        <p>
          Cash on delivery is offered at checkout — the shop calls to confirm
          the order, the stock and the delivery charge before anything is
          dispatched. What identification the courier asks for is{" "}
          <PolicyValue>to confirm</PolicyValue>.
        </p>
      </>
    ),
  },
  {
    id: "damage",
    title: "If it arrives damaged",
    body: (
      <>
        <PolicyPlaceholder>
          How long a customer has to report transit damage, whether the
          packaging must be photographed, and who is responsible for a parcel
          damaged in transit.
        </PolicyPlaceholder>
        <p>
          Until that is written down, tell us immediately — call before
          unpacking anything further, so we can see the condition it arrived in.
          See also{" "}
          <Link href="/returns" className="text-cyan hover:underline">
            returns
          </Link>{" "}
          and{" "}
          <Link href="/warranty" className="text-cyan hover:underline">
            warranty
          </Link>
          .
        </p>
      </>
    ),
  },
];

export default function ShippingPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Shipping and delivery",
            description:
              "Collection and delivery information for Yalman Gaming, Lahore. Terms are being finalised.",
            path: "/shipping",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PolicyLayout
        eyebrow="Support"
        title="Shipping & delivery"
        subject="delivery terms"
        crumbs={CRUMBS}
        lede={
          <>
            You can always buy and collect at the shop in Hafeez Centre. Beyond
            that, our delivery areas, rates and timings have not been published
            yet — so this page marks them as gaps instead of inventing a
            timeframe we would then have to explain away.
          </>
        }
        sections={SECTIONS}
        footnote={
          <>
            No delivery date or timeframe on this site is a commitment. The
            figure attached to the delivery service in the builder is sample
            data; the cost that applies to your order is the one we confirm when
            we call you.
          </>
        }
      />

      <div className="container-page pb-4">
        <TalkToUs
          title="Getting it to you"
          description="Tell us your city and what you are ordering, and we will tell you what delivery costs and how long it realistically takes."
          message="Hi Yalman Gaming — can you deliver to my city, and what would it cost?"
        />
      </div>
    </>
  );
}
