/**
 * `/warranty` — a template, not a policy.
 *
 * Yalman Gaming has not supplied warranty terms. Rather than ship
 * plausible-sounding boilerplate that a customer would read as a promise, this
 * page carries the real structure of a warranty policy with every unconfirmed
 * clause rendered through `<PolicyPlaceholder>`.
 *
 * The only warranty statement anywhere in the data is `Product.warranty`, which
 * the seed sets to either `null` or the exact string "Manufacturer warranty" —
 * no durations, no coverage terms. That is therefore the only thing this page
 * asserts.
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
import { contact } from "@/lib/site";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Warranty" }];

export const metadata: Metadata = pageMetadata({
  title: "Warranty",
  description:
    "Warranty information for hardware bought from Yalman Gaming, Hafeez Centre, Lahore. Components carry their manufacturer warranty; our own terms are being finalised — call or WhatsApp the shop for a straight answer today.",
  // `/warranty` is listed in `DRAFT_POLICY_PATHS`, so `pageMetadata` emits
  // `noindex` for it and the sitemap leaves it out. Both follow from removing
  // that one entry when the terms are real.
  path: "/warranty",
});

const SECTIONS: PolicySection[] = [
  {
    id: "what-we-can-tell-you",
    title: "What we can tell you today",
    body: (
      <>
        <p>
          Hardware sold by Yalman Gaming carries the warranty its manufacturer
          provides. That is recorded against products in our catalogue as
          &ldquo;Manufacturer warranty&rdquo; and nothing more specific, because
          the term differs by brand, by product line and sometimes by batch.
        </p>
        <p>
          No duration appears anywhere on this site. Where you see a warranty
          mentioned on a product page, it means the manufacturer&rsquo;s cover
          applies — it is not a Yalman Gaming warranty period, and we have not
          published one yet.
        </p>
        <PolicyPlaceholder>
          The warranty Yalman Gaming offers in its own name — what it covers,
          how long it runs, and whether it differs for a component, a prebuilt
          machine and a custom build.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "manufacturer-warranty",
    title: "Manufacturer warranty",
    body: (
      <>
        <p>
          Every brand handles its own warranty differently: some are serviced
          through a regional distributor, some through the retailer, some
          directly by the manufacturer. Which route applies to your part decides
          where it has to go and how long it takes.
        </p>
        <PolicyPlaceholder>
          Which brands Yalman Gaming processes warranty claims for on the
          customer&rsquo;s behalf, and which have to be taken to the
          distributor directly.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether a replacement, a repair or a credit is the normal outcome, and
          who decides which.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "assembled-builds",
    title: "Machines we assembled",
    body: (
      <>
        <p>
          A custom build is a set of individually warranted parts plus the work
          of putting them together. Those two things are usually covered
          differently, and the parts keep their own manufacturer cover either
          way.
        </p>
        <PolicyPlaceholder>
          Whether the assembly work itself is covered, for how long, and what
          happens if a fault turns out to be a build issue rather than a faulty
          component.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether opening the machine, adding a part or changing the cooling
          affects that cover.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "not-covered",
    title: "What is not covered",
    body: (
      <>
        <p>
          Most warranties exclude physical damage, liquid damage, damage from an
          electrical fault outside the machine, and modifications made after
          purchase. We are not going to state Yalman Gaming&rsquo;s exclusions
          before Yalman Gaming has written them.
        </p>
        <PolicyPlaceholder>
          The full list of exclusions, including where the shop stands on
          overclocking, delidding, custom water loops and damage from power
          fluctuations.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "making-a-claim",
    title: "Making a claim",
    body: (
      <>
        <p>
          Today, the process is a phone call. Ring the shop on{" "}
          <a
            href={`tel:+${contact.phoneE164}`}
            className="tnum font-mono text-chrome hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>{" "}
          or send a WhatsApp message describing the fault, and we will tell you
          what to do next. If you bought through this site, have your order
          number ready — every order placed here is issued one in the form{" "}
          <span className="font-mono text-chrome">YG-XXXXXX-XXX</span> and it is
          shown on the confirmation screen.
        </p>
        <PolicyPlaceholder>
          What proof of purchase is required, whether the original packaging is
          needed, and whether a fault has to be diagnosed in the shop before a
          claim is opened.
        </PolicyPlaceholder>
        <p>
          Turnaround is <PolicyValue>to confirm</PolicyValue> and cost of
          transport for a claim is <PolicyValue>to confirm</PolicyValue>.
        </p>
      </>
    ),
  },
  {
    id: "related",
    title: "Related pages",
    body: (
      <p>
        A faulty item is a warranty matter; an item you no longer want is a{" "}
        <Link href="/returns" className="text-cyan hover:underline">
          returns
        </Link>{" "}
        matter, and getting the part to or from us is covered on the{" "}
        <Link href="/shipping" className="text-cyan hover:underline">
          shipping
        </Link>{" "}
        page. Both are templates in the same state as this one.
      </p>
    ),
  },
];

export default function WarrantyPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Warranty",
            description:
              "Warranty information for hardware bought from Yalman Gaming, Lahore. Terms are being finalised.",
            path: "/warranty",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PolicyLayout
        eyebrow="Support"
        title="Warranty"
        subject="warranty terms"
        crumbs={CRUMBS}
        lede={
          <>
            Components sold here carry their manufacturer&rsquo;s warranty.
            Yalman Gaming&rsquo;s own terms — what we cover, for how long, and
            how a claim is handled — have not been published yet, so this page
            marks each of those as a gap rather than guessing at them.
          </>
        }
        sections={SECTIONS}
        footnote={
          <>
            Last reviewed when this page was built. Nothing above marked{" "}
            <span className="font-mono text-ember">[Yalman Gaming to confirm]</span>{" "}
            is a commitment, and nothing on this page overrides what the shop
            tells you directly.
          </>
        }
      />

      <div className="container-page pb-4">
        <TalkToUs
          title="Something has failed?"
          description="Call the shop and describe what it is doing. We will tell you whether it is a warranty claim and where it needs to go — that answer is free and immediate."
          message="Hi Yalman Gaming — I have a warranty question about something I bought."
        />
      </div>
    </>
  );
}
