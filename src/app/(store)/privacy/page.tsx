/**
 * `/privacy` — the factual half is real; the legal half is a template.
 *
 * The "what we collect", "what stays in your browser", "cookies" and "third
 * parties" sections below were written by reading the actual forms and Prisma
 * models in this codebase, not from a boilerplate privacy notice. Every field
 * named is a column that exists; every storage key named is the literal string
 * the code writes. If someone adds a field or an analytics script, this page
 * becomes wrong and should be updated in the same commit.
 *
 * Sources, so a future editor can re-verify rather than trust this comment:
 *   - Orders            `Order` / `OrderItem` in prisma/schema.prisma, filled by
 *                       `customerDetailsSchema` in src/lib/validation.ts.
 *   - Quotes & messages `QuoteRequest`, filled by src/app/api/quote/route.ts
 *                       and src/app/api/contact/route.ts.
 *   - Stock alerts      `StockAlert`, filled by src/app/api/stock-alert/route.ts.
 *   - Newsletter        `NewsletterSignup`, one column: email.
 *   - Staff accounts    `User` (email, bcrypt hash, name, phone, role).
 *   - Browser storage   the `yalman:*` keys listed in BROWSER_STORAGE below.
 *   - Cookies           `yg_admin_session` only — see src/lib/auth.ts.
 *
 * Every retention period, sharing arrangement and legal commitment is a marked
 * gap. Listed in `DRAFT_POLICY_PATHS`, so noindexed and out of the sitemap.
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
import { contact, storeAddress } from "@/lib/site";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "Privacy" }];

export const metadata: Metadata = pageMetadata({
  title: "Privacy Notice",
  description:
    "What the Yalman Gaming website collects, what stays in your browser, and how to reach us about your data. Retention and sharing terms are being finalised.",
  path: "/privacy",
});

/* -------------------------------------------------------------------------- */
/* What the site actually collects                                            */
/* -------------------------------------------------------------------------- */

type Collection = {
  when: string;
  fields: string[];
  note: string;
};

/** Read off the real schemas and route handlers. Keep it that way. */
const COLLECTIONS: Collection[] = [
  {
    when: "When you place an order at checkout",
    fields: [
      "Name",
      "Phone number",
      "Email address (optional)",
      "Delivery address, city, province, postal code (optional)",
      "Delivery instructions (optional)",
      "The payment method you chose",
      "The items, quantities, prices and any coupon code",
    ],
    note: "No card number, expiry or security code is ever entered on this website — there is no payment gateway on it. Choosing card payment records your order as payment pending and the shop sends a payment link separately.",
  },
  {
    when: "When you request a quote or send a message",
    fields: [
      "Name",
      "Phone number",
      "Email address (optional)",
      "City (optional)",
      "Your message, including any budget or games you tell us about",
      "A copy of the build you attached, if you sent one from the builder",
    ],
    note: "Quote requests and contact messages are stored together, marked with which form they came from.",
  },
  {
    when: "When you ask to be told a product is back in stock",
    fields: [
      "An email address or a phone number — whichever you give us",
      "Which product you asked about",
    ],
    note: "Kept so we can tell you when that item arrives.",
  },
  {
    when: "When you sign up for stock and price-drop emails",
    fields: ["Your email address"],
    note: "That is the entire record. Nothing else is stored with it.",
  },
  {
    when: "When a member of Yalman Gaming staff signs in to the admin",
    fields: [
      "Email address",
      "Password (stored only as a bcrypt hash, never as text)",
      "Name and phone number, where set",
    ],
    note: "There are no customer accounts on this site. You cannot register, and nothing you do here is tied to a profile.",
  },
];

/* -------------------------------------------------------------------------- */
/* Browser storage                                                            */
/* -------------------------------------------------------------------------- */

/** The literal `localStorage` keys this site writes. */
const BROWSER_STORAGE: { key: string; holds: string }[] = [
  { key: "yalman:cart:v1", holds: "Your shopping cart" },
  { key: "yalman:build:v1", holds: "The PC you are configuring in the builder" },
  {
    key: "yalman:checkout:v1",
    holds: "Checkout details you typed, so you do not retype them",
  },
  { key: "yalman:compare:v1", holds: "Products added to the comparison tray" },
  { key: "yalman:wishlist:v1", holds: "Products you saved" },
  { key: "yalman:recent-searches:v1", holds: "Your last few searches" },
  {
    key: "yalman:announcement:v1",
    holds: "Whether you dismissed the banner at the top of the page",
  },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const SECTIONS: PolicySection[] = [
  {
    id: "who-we-are",
    title: "Who this is about",
    body: (
      <>
        <p>
          Yalman Gaming, {storeAddress.oneLine}. If you want to ask anything
          about your data, or ask us to delete it, call or WhatsApp{" "}
          <a
            href={`tel:+${contact.phoneE164}`}
            className="tnum font-mono text-chrome hover:text-cyan"
          >
            {contact.phoneDisplay}
          </a>
          , or use the{" "}
          <Link href="/contact" className="text-cyan hover:underline">
            contact form
          </Link>
          .
        </p>
        <PolicyPlaceholder>
          A dedicated email address for privacy requests, and the name or role
          of the person who handles them.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What this website collects",
    body: (
      <>
        <p>
          Only what a form asks for. There is no tracking, no profiling and no
          hidden collection anywhere on this site — the list below is
          exhaustive, and it was written by reading the code rather than by
          copying a template.
        </p>

        <div className="mt-6 space-y-6">
          {COLLECTIONS.map((item) => (
            <div key={item.when} className="rounded-xl border border-line p-4">
              <h3 className="font-display text-sm font-semibold text-chrome">
                {item.when}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {item.fields.map((field) => (
                  <li key={field} className="flex gap-2.5 text-sm text-silver">
                    <span aria-hidden="true" className="text-ash">
                      ·
                    </span>
                    <span>{field}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ash">{item.note}</p>
            </div>
          ))}
        </div>

        <p className="mt-6">
          We use these details to answer you, to fulfil an order and to reach
          you about it. Nothing on this site is used for advertising.
        </p>
        <PolicyPlaceholder>
          Whether Yalman Gaming ever uses order or enquiry details for marketing
          — for example, texting past customers about a sale — and how someone
          opts out of that.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "browser-storage",
    title: "What stays in your browser",
    body: (
      <>
        <p>
          Your cart, your saved build and your comparison tray are kept in your
          own browser&rsquo;s local storage, not on our server. They never leave
          your device unless you submit them — by placing an order, saving a
          build to a share link, or sending us a quote request.
        </p>

        <dl className="mt-5 divide-y divide-[var(--color-line)] border-y border-line">
          {BROWSER_STORAGE.map((entry) => (
            <div
              key={entry.key}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <dt className="font-mono text-xs text-cyan sm:w-56 sm:shrink-0">
                {entry.key}
              </dt>
              <dd className="text-sm text-silver">{entry.holds}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4">
          Clearing your browser&rsquo;s site data for this site removes all of
          it, and costs you nothing but a cart.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>
          This site sets exactly one cookie, and only for staff:{" "}
          <span className="font-mono text-cyan">yg_admin_session</span>, created
          when a member of Yalman Gaming signs in to the admin dashboard. It is
          HTTP-only, so page scripts cannot read it, and it exists purely to
          keep that person signed in.
        </p>
        <p>
          There are no analytics cookies, no advertising cookies and no
          third-party tracking on this website. That is why you were not shown a
          cookie banner — there is nothing to consent to.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third parties",
    body: (
      <>
        <p>Three, and only when you make them happen:</p>
        <ul className="mt-3 space-y-3">
          <li className="text-sm leading-relaxed text-silver">
            <strong className="font-semibold text-chrome">Google Maps.</strong>{" "}
            The map on the contact page and the home page is an embedded Google
            frame. It is set to load lazily, so it is only requested once you
            scroll to it — at which point Google receives your IP address and
            browser details, as it would on any page containing a map. Google
            handles that data under its own privacy policy.
          </li>
          <li className="text-sm leading-relaxed text-silver">
            <strong className="font-semibold text-chrome">WhatsApp.</strong>{" "}
            Every WhatsApp button is an ordinary link. Nothing is sent until you
            tap one, and then you are in WhatsApp, under its terms and
            Meta&rsquo;s privacy policy.
          </li>
          <li className="text-sm leading-relaxed text-silver">
            <strong className="font-semibold text-chrome">
              Fonts and hosting.
            </strong>{" "}
            The typefaces are downloaded when this site is built and served from
            our own domain, so your browser makes no request to a font provider.
            Our hosting provider necessarily sees the ordinary server-log
            information any web request produces.
          </li>
        </ul>
        <PolicyPlaceholder>
          Who else receives customer data in practice — the delivery courier,
          any payment provider used for card links, and the accountant or system
          used for invoicing.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <PolicyPlaceholder>
          How long orders, quote requests, contact messages, stock alerts and
          newsletter sign-ups are kept before they are deleted, and whether any
          of it has to be kept for tax or accounting reasons.
        </PolicyPlaceholder>
        <p>
          Until that is decided, the honest statement is that records are kept
          for <PolicyValue>to confirm</PolicyValue> and you can ask us to delete
          yours at any time by calling the shop.
        </p>
      </>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices",
    body: (
      <>
        <p>
          Ask us for a copy of what we hold about you, ask us to correct it, or
          ask us to delete it — by phone, on WhatsApp, or through the contact
          form. To stop stock emails, tell us and we will remove your address.
        </p>
        <PolicyPlaceholder>
          The formal process and the timeframe for responding to an access or
          deletion request, and what identification is required before one is
          actioned.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          Which Pakistani data-protection law Yalman Gaming operates under, and
          how a complaint would be escalated.
        </PolicyPlaceholder>
      </>
    ),
  },
  {
    id: "security-and-changes",
    title: "Security, children and changes",
    body: (
      <>
        <p>
          Admin passwords are stored only as bcrypt hashes, and the admin
          dashboard is behind a signed session. Card details are never handled
          by this site at all.
        </p>
        <PolicyPlaceholder>
          What other security measures the shop commits to, and how a data
          breach would be handled and communicated.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          A minimum age for using the site or placing an order.
        </PolicyPlaceholder>
        <PolicyPlaceholder>
          How customers are told when this notice changes, and the date it was
          last updated.
        </PolicyPlaceholder>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "Privacy notice",
            description:
              "What the Yalman Gaming website collects and stores, and how to contact the shop about it.",
            path: "/privacy",
          }),
          breadcrumbJsonLd(CRUMBS),
        ]}
      />

      <PolicyLayout
        eyebrow="Legal"
        title="Privacy notice"
        subject="privacy terms"
        crumbs={CRUMBS}
        lede={
          <>
            The factual part of this page is real and was written by reading
            what this website actually does: which fields each form collects,
            what is kept in your browser, and the single cookie that exists. The
            legal commitments around it — retention, sharing, formal request
            handling — have not been decided yet, and are marked as gaps.
          </>
        }
        sections={SECTIONS}
        footnote={
          <>
            If you add up everything above, this site collects a name, a phone
            number, an optional email, an optional address and whatever you
            choose to type into a message. That is the whole of it.
          </>
        }
      />

      <div className="container-page pb-4">
        <TalkToUs
          title="Want your details removed?"
          description="Call or message the shop and tell us what to delete. There is no form to fill in and no account to close — we do not have one for you."
          message="Hi Yalman Gaming — I have a question about my personal data."
        />
      </div>
    </>
  );
}
