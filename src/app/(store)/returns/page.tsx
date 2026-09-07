/**
 * `/returns` — a template, not a policy.
 *
 * Yalman Gaming has not supplied returns terms. Every clause a customer would
 * actually rely on — the window, the condition requirement, restocking, refund
 * method, who pays return transport — is rendered as a marked gap rather than
 * as a plausible default.
 *
 * The only facts asserted here are facts about this website: that orders are
 * issued a `YG-…` order number, and that a build saved in the configurator has
 * a share code. Everything else is `[Yalman Gaming to confirm]`.
 *
 * Listed in `DRAFT_POLICY_PATHS`, so this page is noindexed and stays out of
 * the sitemap until the terms are real.
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

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Returns" }];

export const metadata: Metadata = pageMetadata({
  title: "Returns",
  description:
    "Returns information for orders from Yalman Gaming, Hafeez Centre, Lahore. Our returns terms are being finalised — call or WhatsApp the shop and we will tell you where you stand today.",
  path: "/returns",
});

const SECTIONS: PolicySection[] = [
  {
    id: "where-this-stands",
    title: "Where this stands",
    body: (
      <>
        <p>
          Yalman Gaming has not published a returns policy. Until it does, the
          answer to &ldquo;can I return this?&rdquo; is whatever the shop tells
          you on the phone — and that answer is given case by case rather than
          from a rulebook that does not exist yet.
        </p>
        <p>
          The sections below are the shape a returns policy takes. They are here
          so the gaps are obvious, not so they can be read as terms.
        </p>
      </>
    ),
  },
  {
    id: "changed-your-mind",
    title: "If you change your mind",
    body: (
      <>
        <PolicyPlaceholder>
          Whether an unwanted item can be returned at all, and if so within how
          many days of purchase or delivery.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          What condition it has to be in — unopened, sealed, complete with
          accessories and packaging — and whether a partly used item is
          accepted.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether a restocking fee or a deduction applies, and how much.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "faulty",
    title: "If something is faulty",
    body: (
      <>
        <p>
          A part that arrives dead, or fails soon after, is usually a warranty
          matter rather than a return. Those two routes lead to different
          places, so tell us which one you think it is when you call and we will
          confirm it.
        </p>
        <PolicyPlaceholder>
          The dead-on-arrival window — how soon after delivery a failure is
          treated as a replacement rather than a warranty claim.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether a fault has to be reproduced in the shop before a return is
          accepted, and what happens if it cannot be.
        </PolicyPlaceholder>
        <p>
          See the{" "}
          <Link href="/warranty" className="text-cyan hover:underline">
            warranty page
          </Link>{" "}
          for what is recorded about manufacturer cover.
        </p>
      </>
    ),
  },
  {
    id: "custom-builds",
    title: "Custom builds and assembled machines",
    body: (
      <>
        <p>
          A machine specified for one customer is not restockable the way a
          boxed part is, so custom builds are almost always treated differently
          from off-the-shelf items.
        </p>
        <PolicyPlaceholder>
          Whether a completed custom build can be returned, and whether that
          changes once assembly has started.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether individual parts can be swapped out of a finished build
          instead of returning the whole machine.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          What happens to assembly, Windows installation and testing charges if
          a build is returned.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "starting-a-return",
    title: "Starting a return",
    body: (
      <>
        <p>
          Contact the shop first — do not send anything back before you have
          spoken to us. Ring{" "}
          <a
            href={`tel:+${contact.phoneE164}`}
            className="tnum font-mono text-chrome hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>
          , or message the same number on WhatsApp.
        </p>
        <p>
          If you ordered through this site, quote your order number. Every order
          placed here is issued one in the form{" "}
          <span className="font-mono text-chrome">YG-XXXXXX-XXX</span>, shown on
          the confirmation screen after checkout. If your order was a custom
          build, its share code identifies the exact configuration.
        </p>
        <PolicyPlaceholder>
          What proof of purchase is required, and whether the original packaging
          has to come back with the item.
        </PolicyPlaceholder>
        <p>
          Who pays for return transport is{" "}
          <PolicyValue>to confirm</PolicyValue>.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    body: (
      <>
        <PolicyPlaceholder>
          How a refund is issued for each payment method — cash, bank transfer,
          and a card paid through a payment link — and whether store credit or
          an exchange is offered instead.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          How long a refund takes to reach the customer once a return is
          accepted.
        </PolicyPlaceholder>
        <p>
          Delivery charges paid on the original order are{" "}
          <PolicyValue>to confirm</PolicyValue> refundable.
        </p>
      </>
    ),
  },
  {
    id: "not-returnable",
    title: "Items that may not be returnable",
    body: (
      <>
        <p>
          Software licences, opened operating-system keys and special-order
          items are commonly excluded from returns. We are not going to publish
          Yalman Gaming&rsquo;s exclusion list before Yalman Gaming has written
          it.
        </p>
        <PolicyPlaceholder>
          The list of item types that cannot be returned, and why.
        </PolicyPlaceholder>
      </>
    ),
  },
];

export default function ReturnsPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Returns",
            description:
              "Returns information for orders from Yalman Gaming, Lahore. Terms are being finalised.",
            path: "/returns",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PolicyLayout
        eyebrow="Support"
        title="Returns"
        subject="returns terms"
        crumbs={CRUMBS}
        lede={
          <>
            We have not published a returns policy yet, and we would rather say
            so than print a window and a condition rule that nobody at the shop
            has agreed to. Call us and we will tell you exactly where you stand
            with your order.
          </>
        }
        sections={SECTIONS}
        footnote={
          <>
            Nothing above marked{" "}
            <span className="font-mono text-ember">[Yalman Gaming to confirm]</span>{" "}
            is a commitment. Where this page and something the shop tells you
            directly appear to differ, the shop is right — this page is a draft.
          </>
        }
      />

      <div className="container-page pb-4">
        <TalkToUs
          title="Need to return something?"
          description="Call before you travel or post anything. Tell us the order number and what is wrong, and we will tell you what to do with it."
          message="Hi Yalman Gaming — I would like to return something I bought."
        />
      </div>
    </>
  );
}
