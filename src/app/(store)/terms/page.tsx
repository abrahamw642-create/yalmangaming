/**
 * `/terms` — the factual half is real; the legal half is a template.
 *
 * What is genuinely true about this website — that prices marked "sample" are
 * placeholders, that no product carries a review because none exists, that a
 * shared build link is public to anyone holding it, that no card details are
 * taken here — is stated plainly. Every actual legal commitment (contract
 * formation, liability, governing law, cancellation) is a marked gap, because
 * Yalman Gaming has not written those.
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
import { PAYMENT_METHOD_OPTIONS } from "@/lib/cart";
import { contact, siteConfig, storeAddress } from "@/lib/site";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Terms" }];

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description:
    "Terms for using the Yalman Gaming website and ordering from it. Pricing, stock and custom-build information is factual; the legal terms are being finalised.",
  path: "/terms",
});

const SECTIONS: PolicySection[] = [
  {
    id: "who",
    title: "Who these terms are with",
    body: (
      <>
        <p>
          {siteConfig.legalName}, {storeAddress.oneLine}, contactable on{" "}
          <a
            href={`tel:+${contact.phoneE164}`}
            className="tnum font-mono text-chrome hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>
          . &ldquo;This site&rdquo; means this website and everything on it.
        </p>
        <PolicyPlaceholder>
          The registered business name and any registration or tax number that
          should appear on a customer-facing terms page.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "prices",
    title: "Prices and product information",
    body: (
      <>
        <p>
          This is the most important thing on the page, so it is not buried:{" "}
          <strong className="font-semibold text-chrome">
            every price currently marked{" "}
            <span className="font-mono text-ember">sample</span> on this site is
            placeholder data, not a Yalman Gaming price.
          </strong>{" "}
          It exists so the site could be built and tested before the real
          catalogue prices were loaded. Confirm the current price with the shop
          before you order or travel to us.
        </p>
        <p>
          Two related facts about what you see on product pages, both of which
          are deliberate:
        </p>
        <ul className="mt-2 space-y-2">
          <li className="flex gap-2.5 text-sm leading-relaxed text-silver">
            <span aria-hidden="true" className="text-ash">
              ·
            </span>
            <span>
              Star ratings and review counts read zero because this site holds
              no reviews. Yalman Gaming&rsquo;s 5.0 rating from 95 reviews is a
              rating of the <em>shop</em> on Google, not of any individual
              product, and no review text has been reproduced here.
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-relaxed text-silver">
            <span aria-hidden="true" className="text-ash">
              ·
            </span>
            <span>
              Where a performance figure is shown, it carries its source and the
              processor it was measured with. Where no verified figure exists,
              the page says so rather than estimating one. Real performance
              depends on your settings, your resolution and the rest of your
              machine.
            </span>
          </li>
        </ul>
        <PolicyPlaceholder>
          What happens when a price is displayed incorrectly and an order has
          already been placed against it.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "stock",
    title: "Stock and availability",
    body: (
      <>
        <p>
          Stock figures come from our own records and can be out of date,
          especially for a part that also sells over the counter. Treat them as
          a strong hint, not a reservation, and call before travelling for a
          specific item.
        </p>
        <PolicyPlaceholder>
          What Yalman Gaming does when an ordered item turns out to be
          unavailable — substitute, hold the order, or refund — and who decides.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "orders",
    title: "Orders",
    body: (
      <>
        <p>
          Placing an order on this site sends us your details and your basket.
          Yalman Gaming calls to confirm the order, the stock and any delivery
          charge before anything is dispatched.
        </p>
        <PolicyPlaceholder>
          At what point a contract is formed — when the order is submitted, when
          the shop confirms it by phone, or when payment clears.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Whether and how an order can be cancelled or changed after it is
          placed, and whether that differs once a custom build has been started.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    body: (
      <>
        <p>Checkout offers these methods:</p>
        <ul className="mt-3 space-y-3">
          {PAYMENT_METHOD_OPTIONS.filter((option) => option.enabled).map(
            (option) => (
              <li key={option.id} className="text-sm leading-relaxed text-silver">
                <strong className="font-semibold text-chrome">
                  {option.label}.
                </strong>{" "}
                {option.detail}
              </li>
            ),
          )}
        </ul>
        <p className="mt-4">
          No card number, expiry date or security code is entered on this
          website. There is no payment gateway on it, and there is nothing on
          this site that could take one.
        </p>
        <PolicyPlaceholder>
          Bank account details for transfers, when payment is due, and what
          happens to an order that is not paid for.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "builder",
    title: "The PC builder and saved builds",
    body: (
      <>
        <p>
          The builder checks socket, memory type, physical clearance and power
          draw as you add parts, and it is genuinely useful — but it is guidance
          based on the specifications recorded against each product, not a
          guarantee that a particular combination will work in every case. We
          re-check a build before we assemble it.
        </p>
        <p>
          Saving a build produces a share code and a link. Anyone who has that
          link can open the build, so treat it as public. It contains no
          personal details — only the part list.
        </p>
        <PolicyPlaceholder>
          How long a saved build is kept, and whether Yalman Gaming may delete
          old ones.
        </PolicyPlaceholder>
        <p>
          Assembly services shown in the builder are priced as{" "}
          <PolicyValue>sample data</PolicyValue> pending confirmation, like
          every other figure marked &ldquo;sample&rdquo;. See the{" "}
          <Link href="/assembly" className="text-cyan hover:underline">
            assembly page
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "warranty-returns-delivery",
    title: "Warranty, returns and delivery",
    body: (
      <>
        <p>
          These have their own pages, and all three are in the same state as
          this one — real structure, unconfirmed clauses marked as gaps:{" "}
          <Link href="/warranty" className="text-cyan hover:underline">
            warranty
          </Link>
          ,{" "}
          <Link href="/returns" className="text-cyan hover:underline">
            returns
          </Link>{" "}
          and{" "}
          <Link href="/shipping" className="text-cyan hover:underline">
            shipping
          </Link>
          . Components carry their manufacturer warranty; Yalman Gaming has not
          published its own terms.
        </p>
      </>
    ),
  },
  {
    id: "using-the-site",
    title: "Using this site",
    body: (
      <>
        <p>
          The words, layout, photographs and code on this site belong to Yalman
          Gaming. Manufacturer and product names belong to their owners and are
          used to describe what we sell — nothing on this site is a claim to
          represent, or be authorised by, any of those brands.
        </p>
        <PolicyPlaceholder>
          What counts as unacceptable use of the site — scraping, bulk ordering,
          automated submissions — and what Yalman Gaming may do about it.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "liability-and-law",
    title: "Liability and governing law",
    body: (
      <>
        <PolicyPlaceholder>
          The limitation of liability Yalman Gaming intends to rely on. This is
          the clause most worth having a lawyer draft rather than a website
          guess at.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          The governing law and the courts that would hear a dispute.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          How and when these terms may change, and the date they were last
          updated.
        </PolicyPlaceholder>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Terms",
            description:
              "Terms for using the Yalman Gaming website and ordering from it. Being finalised.",
            path: "/terms",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PolicyLayout
        eyebrow="Legal"
        title="Terms"
        subject="terms and conditions"
        crumbs={CRUMBS}
        lede={
          <>
            What is factually true about this website — how prices are marked,
            why every product shows no reviews, what the builder does and does
            not guarantee, and how payment works — is written out plainly below.
            The legal terms around it have not been drafted yet and are marked
            as gaps rather than filled with boilerplate.
          </>
        }
        sections={SECTIONS}
        footnote={
          <>
            Nothing above marked{" "}
            <span className="font-mono text-ember">[Yalman Gaming to confirm]</span>{" "}
            forms part of any agreement. Until these terms are published, an
            order is governed by what Yalman Gaming agrees with you directly.
          </>
        }
      />

      <div className="container-page pb-4">
        <TalkToUs
          title="Anything here unclear?"
          description="Ask the shop directly. On a page full of gaps, a two-minute call is worth more than the page is."
          message="Hi Yalman Gaming — I have a question about ordering from your website."
        />
      </div>
    </>
  );
}
