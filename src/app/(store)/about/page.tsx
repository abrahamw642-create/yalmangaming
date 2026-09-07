/**
 * `/about` — who Yalman Gaming is.
 *
 * Constrained hard by what the owner actually supplied: the shop's address, its
 * phone number, its closing time, its Google rating, and the fact that it
 * builds custom machines and sells components. There is **no** founding date,
 * no staff count, no "since 20XX", no authorised-dealer or partnership claim
 * anywhere on this page, because none of those was given.
 *
 * The one thing this page adds beyond `@/lib/site` is the shape of the
 * catalogue, read live from the database — how many products sit under each
 * top-level category. That is a fact the site can verify about itself, which is
 * the only kind of fact an About page should be adding.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  MapPin,
  MessageCircle,
  Star,
  Wrench,
} from "lucide-react";
import { Faq } from "@/components/content/Faq";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero, Prose } from "@/components/content/PageHero";
import {
  ContactActions,
  GoogleRating,
  StoreDetails,
  StoreMap,
} from "@/components/content/StoreInfo";
import { Badge, ButtonLink, Card, Divider } from "@/components/ui";
import { getCategoryTree } from "@/lib/catalog";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  pageMetadata,
  webPageJsonLd,
  type FaqEntry,
} from "@/lib/seo";
import { businessHours, ratings, storeAddress, WHY_POINTS } from "@/lib/site";
import { formatAmount } from "@/lib/utils";

/** Catalogue counts are read live, so the page cannot go stale against the shop. */
export const dynamic = "force-dynamic";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "About" }];

export const metadata: Metadata = pageMetadata({
  title: "About Yalman Gaming — Gaming PC Shop in Hafeez Centre, Lahore",
  description:
    "Yalman Gaming is a gaming PC and computer hardware shop on the 3rd floor of Hafeez Centre, Gulberg III, Lahore. We build custom gaming PCs, sell components and accessories, and are rated 5.0 from 95 Google reviews.",
  path: "/about",
  keywords: [
    "gaming PC shop Lahore",
    "computer shop Hafeez Centre",
    "Yalman Gaming Lahore",
    "custom gaming PC builder Lahore",
  ],
});

/**
 * Answers to what people actually ask at the counter. Every one is either a
 * fact from `@/lib/site`, something verifiable on this site, or an honest
 * "we have not published that yet" — which is the correct answer for warranty,
 * delivery and returns until the owner supplies terms.
 *
 * The same array feeds the visible accordion and the FAQ markup, so the two can
 * never say different things.
 */
const FAQS: FaqEntry[] = [
  {
    question: "Where is Yalman Gaming?",
    answer: `${storeAddress.oneLine}. We are on the third floor of Hafeez Centre in Gulberg III — the same building people come to for computer hardware in Lahore.`,
  },
  {
    question: "Do you build custom gaming PCs?",
    answer:
      "Yes — that is the main thing we do. You can configure a machine part by part in the builder on this site, which checks socket, clearance and power draw as you go, or you can tell us your budget and the games you play and we will spec it with you.",
  },
  {
    question: "Can I buy individual components rather than a whole PC?",
    answer:
      "Yes. Graphics cards, processors, motherboards, memory, storage, coolers, power supplies, cases, monitors and peripherals are all sold on their own, in the shop and through this site.",
  },
  {
    question: "Are the prices on this website final?",
    answer:
      "Not yet. Every figure currently marked \"sample\" is placeholder data used while the site is being finished, not a Yalman Gaming price. Confirm the current price with the shop before you order or travel to us.",
  },
  {
    question: "What are your opening hours?",
    answer: `We close at ${businessHours.closingTime}. We have not published an opening time on the site, so please call ahead if you are coming early, and on public holidays.`,
  },
  {
    question: "What warranty comes with a build?",
    answer:
      "Components carry their manufacturer warranty. Yalman Gaming's own warranty, returns and delivery terms are still being finalised and are not published on this site yet — ask us on the phone or on WhatsApp and whatever we tell you on that call is what applies.",
  },
];

/** Icon lookup for `WHY_POINTS`, which stores an icon name rather than a node. */
const WHY_ICONS: Record<string, typeof Wrench> = {
  wrench: Wrench,
  "badge-check": BadgeCheck,
  "message-circle": MessageCircle,
  activity: Activity,
  "map-pin": MapPin,
  star: Star,
};

const WHY_ACCENT: Record<string, string> = {
  cyan: "text-cyan",
  violet: "text-violet",
  amber: "text-ember",
  emerald: "text-emerald",
  rose: "text-rose",
};

export default async function AboutPage() {
  const tree = await getCategoryTree();
  const catalogue = tree
    .filter((node) => node.productCount > 0)
    .map((node) => ({
      name: node.name,
      href: node.href,
      count: node.productCount,
    }));

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(),
          webPageJsonLd({
            type: "AboutPage",
            name: "About Yalman Gaming",
            description:
              "Gaming PC and computer hardware shop on the 3rd floor of Hafeez Centre, Gulberg III, Lahore.",
            path: "/about",
          }),
          breadcrumbJsonLd(CRUMBS),
          faqJsonLd(FAQS),
        ]}
      />

      <PageHero
        eyebrow="About"
        title={
          <>
            A hardware shop in
            <br className="hidden sm:block" /> Hafeez Centre.
          </>
        }
        crumbs={CRUMBS}
        lede={
          <>
            Yalman Gaming sells gaming PCs, components and accessories from the
            third floor of Hafeez Centre in Gulberg III, Lahore — and builds
            custom machines for the people who walk in and describe what they
            want to play.
          </>
        }
        actions={
          <>
            <ButtonLink href="/builder" variant="primary" size="lg">
              BUILD YOUR PC
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg">
              VISIT THE STORE
            </ButtonLink>
          </>
        }
        aside={
          <Card className="p-5">
            <p className="eyebrow mb-3">Rated by our customers</p>
            <GoogleRating />
            <p className="mt-3 text-xs leading-relaxed text-ash">
              {ratings.google.score.toFixed(1)} stars from{" "}
              {ratings.google.count} reviews on Google. We have not reproduced
              any of the review text on this site — read it on our Google
              listing instead.
            </p>
          </Card>
        }
      />

      <div className="container-page py-12 md:py-16">
        {/* --- What we do -------------------------------------------------- */}
        <section aria-labelledby="what-we-do">
          <h2
            id="what-we-do"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            What we do
          </h2>

          <Prose className="mt-5">
            <p>
              Two things, mostly. We sell computer hardware — graphics cards,
              processors, motherboards, memory, storage, cooling, power
              supplies, cases, monitors and the peripherals that go around them
              — and we build complete machines out of it.
            </p>
            <p>
              A custom build usually starts as a conversation: a budget, the
              games you actually play, the monitor you already own. From there
              it is a question of where the money is best spent, which is a
              different answer for a 1080p esports machine than it is for a 4K
              single-player one. The{" "}
              <Link href="/builder" className="text-cyan hover:underline">
                builder on this site
              </Link>{" "}
              runs the same checks we run at the counter — socket against
              motherboard, card length against case, cooler height against
              clearance, total draw against the power supply — so you can do
              that part yourself if you would rather.
            </p>
            <p>
              If you buy the parts and want us to put them together, that is a
              service we offer on its own. It is described on the{" "}
              <Link href="/assembly" className="text-cyan hover:underline">
                assembly page
              </Link>
              .
            </p>
          </Prose>

          {catalogue.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow mb-3">What is in the catalogue right now</p>
              <ul className="flex flex-wrap gap-2.5">
                {catalogue.map((node) => (
                  <li key={node.href}>
                    <Link
                      href={node.href}
                      className="inline-flex items-baseline gap-2 rounded-xl border border-line px-3.5 py-2 text-sm text-silver transition-colors hover:border-line-strong hover:text-chrome"
                    >
                      {node.name}
                      <span className="tnum font-mono text-xs text-ash">
                        {formatAmount(node.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-xs text-ash">
                Counted from the live catalogue as this page loaded.
              </p>
            </div>
          )}
        </section>

        <Divider className="my-14" />

        {/* --- Why --------------------------------------------------------- */}
        <section aria-labelledby="why-us">
          <h2
            id="why-us"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            Why people come to us
          </h2>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map((point) => {
              const Icon = WHY_ICONS[point.icon] ?? Wrench;
              return (
                <li key={point.title}>
                  <Card className="h-full p-5">
                    <Icon
                      className={`h-5 w-5 ${WHY_ACCENT[point.accent] ?? "text-cyan"}`}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <h3 className="mt-4 font-display text-base font-semibold text-chrome">
                      {point.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-silver">
                      {point.detail}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <Divider className="my-14" />

        {/* --- Straight answers -------------------------------------------- */}
        <section aria-labelledby="straight-answers">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="straight-answers"
              className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
            >
              What this site does not claim
            </h2>
            <Badge tone="ember">Being finalised</Badge>
          </div>

          <Prose className="mt-5">
            <p>
              This website is new, and some of it is deliberately unfinished
              rather than filled in with something plausible.
            </p>
            <p>
              Prices marked <span className="font-mono text-ember">sample</span>{" "}
              are placeholder figures, not Yalman Gaming prices — confirm the
              real number with us before ordering. Our warranty, returns and
              shipping terms have not been published yet, so those pages are
              templates with the unwritten clauses marked as gaps instead of
              guesses. Product pages show star ratings and review counts of zero
              because we have not collected a single review through this site
              yet, and inventing one would be the easiest lie on the internet to
              tell.
            </p>
            <p>
              Until those pages are filled in, the honest answer is a phone
              call. Whatever we tell you on it is what applies.
            </p>
          </Prose>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <ButtonLink href="/warranty" variant="secondary" size="sm">
              Warranty
            </ButtonLink>
            <ButtonLink href="/returns" variant="secondary" size="sm">
              Returns
            </ButtonLink>
            <ButtonLink href="/shipping" variant="secondary" size="sm">
              Shipping
            </ButtonLink>
          </div>
        </section>

        <Divider className="my-14" />

        {/* --- Visit ------------------------------------------------------- */}
        <section aria-labelledby="visit-heading" id="visit" className="scroll-mt-28">
          <h2
            id="visit-heading"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            Come and see the parts
          </h2>
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-silver">
            Hafeez Centre is where Lahore buys computer hardware, and we are on
            the third floor. Bring the machine you already have if you want it
            looked at, or just come and see a case in person before you commit
            to one online.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
            <div>
              <StoreDetails />
              <ContactActions
                className="mt-7"
                message="Hi Yalman Gaming — I found you through your website and I would like to visit the shop."
              />
            </div>
            <StoreMap />
          </div>
        </section>

        <Divider className="my-14" />

        {/* --- FAQ --------------------------------------------------------- */}
        <section aria-labelledby="faq">
          <h2
            id="faq"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            Questions we get asked
          </h2>
          <Faq entries={FAQS} className="mt-6 max-w-3xl" />
        </section>
      </div>
    </>
  );
}
