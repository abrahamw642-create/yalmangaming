/**
 * `/assembly` — the build service on its own.
 *
 * Buying the parts and building the machine are two separate things, and this
 * page is about the second one. It reads `ASSEMBLY_SERVICES` from
 * `@/lib/types`, which is the same list the PC builder ticks on a build, so
 * the page and the configurator can never quote different services.
 *
 * Every figure here is sample data (`ASSEMBLY_SERVICES` says so in its own
 * comment), and is rendered through `<Price samplePrice>` with a
 * `<SamplePricingNote />` on the page. Nothing states a turnaround time, a
 * warranty on the labour or a delivery window — none of those has been
 * confirmed by the store.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircuitBoard,
  ClipboardCheck,
  Cpu,
  Gauge,
  PackageCheck,
  Wrench,
} from "lucide-react";
import { Faq } from "@/components/content/Faq";
import { JsonLd } from "@/components/content/JsonLd";
import { PageHero } from "@/components/content/PageHero";
import { TalkToUs, WhatsAppButton } from "@/components/content/StoreInfo";
import {
  Badge,
  ButtonLink,
  Card,
  Divider,
  Price,
  SamplePricingNote,
} from "@/components/ui";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
  webPageJsonLd,
  type FaqEntry,
} from "@/lib/seo";
import { ASSEMBLY_SERVICES } from "@/lib/types";
import { formatPKR } from "@/lib/utils";

const CRUMBS = [{ label: "Home", href: "/" }, { label: "We build it for you" }];

export const metadata: Metadata = pageMetadata({
  title: "PC Assembly Service in Lahore — We Build the Machine",
  description:
    "Bring the parts or pick them here, and Yalman Gaming assembles, cable-manages, sets up the BIOS, installs Windows and drivers, and stress tests your PC before it leaves the bench. Hafeez Centre, Gulberg III, Lahore.",
  path: "/assembly",
  keywords: [
    "PC assembly Lahore",
    "PC building service Pakistan",
    "custom PC assembly Hafeez Centre",
    "gaming PC builder Lahore",
  ],
});

const WHATSAPP_MESSAGE =
  "Hi Yalman Gaming — I have parts I would like you to assemble.";

/** What actually happens between handing over parts and taking a PC home. */
const STEPS = [
  {
    icon: ClipboardCheck,
    title: "Bring the list",
    detail:
      "Parts you already own, parts bought elsewhere, or a configuration from our builder. Either way, send us the list first so we can check it fits together before anything is opened.",
  },
  {
    icon: CircuitBoard,
    title: "We check it fits",
    detail:
      "Socket against motherboard, card length and cooler height against the case, total draw against the power supply. The builder on this site runs the same checks, so you can do this part yourself.",
  },
  {
    icon: Wrench,
    title: "It gets built",
    detail:
      "Assembled on the bench, cabling routed behind the tray, BIOS updated and the memory profile enabled so the RAM runs at the speed you paid for.",
  },
  {
    icon: Gauge,
    title: "It gets tested",
    detail:
      "A benchmark pass to confirm the machine performs the way that hardware should, then a thermal and stability run before we call you.",
  },
  {
    icon: PackageCheck,
    title: "You collect it",
    detail:
      "Pick it up from the shop in Hafeez Centre, or ask us about delivery — the cost depends on the city and is confirmed when we quote.",
  },
];

const FAQS: FaqEntry[] = [
  {
    question: "Will you build a PC from parts I bought somewhere else?",
    answer:
      "Yes. Send us the part list before you bring anything in, so we can check the parts are compatible with each other first — that conversation is free and it is the one that saves people money.",
  },
  {
    question: "What if two of my parts turn out to be incompatible?",
    answer:
      "We tell you before we open anything. The builder on this site runs the same socket, clearance and wattage checks, so you can catch most of it yourself in a few minutes.",
  },
  {
    question: "Do I have to buy the parts from Yalman Gaming?",
    answer:
      "No. Assembly is a service in its own right. If you do buy the parts from us, we build the machine as part of putting the order together.",
  },
  {
    question: "Is Windows included?",
    answer:
      "Installation is a listed service; the licence itself is a separate purchase, and we can supply one or install a licence you already own.",
  },
  {
    question: "How much does assembly cost?",
    answer:
      "The prices listed on this page are sample figures used while the site is being finished, not confirmed Yalman Gaming prices. Call or message the shop for the current cost of the services you want.",
  },
  {
    question: "How long does it take?",
    answer:
      "We have not published a turnaround time on this site, because it depends on the build and on what is in stock. Ask us when you send the part list and we will tell you honestly.",
  },
];

export default function AssemblyPage() {
  const defaults = ASSEMBLY_SERVICES.filter((s) => s.defaultOn);
  const defaultTotal = defaults.reduce((sum, s) => sum + s.price, 0);

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: "PC assembly service",
            description:
              "Yalman Gaming assembles, configures and stress tests custom PCs in Hafeez Centre, Gulberg III, Lahore.",
            path: "/assembly",
          }),
          breadcrumbJsonLd(CRUMBS),
          faqJsonLd(FAQS),
        ]}
      />

      <PageHero
        eyebrow="We build it for you"
        title={
          <>
            Pick the parts.
            <br className="hidden sm:block" /> We build the machine.
          </>
        }
        crumbs={CRUMBS}
        lede={
          <>
            Choosing components and physically assembling them are two different
            jobs, and the second one is where a build goes wrong quietly — a
            cooler that fouls the memory, a memory profile left off, a case with
            no exhaust. Hand that part to the bench that does it every day.
          </>
        }
        actions={
          <>
            <ButtonLink href="/builder" variant="primary" size="lg">
              BUILD YOUR PC
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <WhatsAppButton
              message={WHATSAPP_MESSAGE}
              label="Send us your part list"
              size="lg"
            />
          </>
        }
        aside={
          <Card className="p-5">
            <p className="eyebrow mb-3">The standard bundle</p>
            <Price price={defaultTotal} samplePrice size="lg" />
            <p className="mt-3 text-xs leading-relaxed text-ash">
              The {defaults.length} services ticked by default: assembly, cable
              management, BIOS setup, Windows installation, drivers and a
              performance test. Sample figure pending confirmation from Yalman
              Gaming.
            </p>
          </Card>
        }
      />

      <div className="container-page py-12 md:py-16">
        {/* --- How it works ------------------------------------------------ */}
        <section aria-labelledby="how">
          <h2
            id="how"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            How it works
          </h2>

          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full p-5">
                  <div className="flex items-center gap-3">
                    <span className="tnum font-mono text-xs text-ash">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <step.icon
                      className="h-5 w-5 text-cyan"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-chrome">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-silver">
                    {step.detail}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <Divider className="my-14" />

        {/* --- Services ---------------------------------------------------- */}
        <section aria-labelledby="services">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2
                id="services"
                className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
              >
                What we can do to it
              </h2>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-silver">
                Pick any combination. The ones marked{" "}
                <span className="text-cyan">standard</span> are ticked by default
                when you add assembly to a build in the configurator — untick
                anything you do not want.
              </p>
            </div>
            <ButtonLink href="/builder" variant="outline" size="md">
              ADD THESE TO A BUILD
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>

          <SamplePricingNote className="mt-6 max-w-3xl" />

          <ul className="mt-6 divide-y divide-[var(--color-line)] border-y border-line">
            {ASSEMBLY_SERVICES.map((service) => (
              <li
                key={service.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-base font-semibold text-chrome">
                      {service.label}
                    </h3>
                    {service.defaultOn && <Badge tone="cyan">Standard</Badge>}
                  </div>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-silver">
                    {service.description}
                  </p>
                </div>

                <div className="shrink-0 sm:text-right">
                  {service.price === 0 ? (
                    <>
                      <p className="font-display text-lg font-semibold text-emerald">
                        Included
                      </p>
                      <p className="text-xs text-ash">with an assembled build</p>
                    </>
                  ) : (
                    <Price
                      price={service.price}
                      samplePrice
                      size="md"
                      className="sm:justify-end"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ash">
            Delivery cost varies by city and is confirmed when we quote — the{" "}
            {formatPKR(
              ASSEMBLY_SERVICES.find((s) => s.id === "delivery")?.price ?? 0,
            )}{" "}
            shown against it is a placeholder, like every other figure marked
            &ldquo;sample&rdquo; on this page.
          </p>
        </section>

        <Divider className="my-14" />

        {/* --- Where the parts come from ----------------------------------- */}
        <section aria-labelledby="parts-from">
          <h2
            id="parts-from"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            Where the parts come from is up to you
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <Cpu className="h-5 w-5 text-cyan" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-semibold text-chrome">
                Buy them here
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-silver">
                Configure the machine in the builder and it becomes one order:
                parts, assembly and setup together. The compatibility engine has
                already checked the combination before you reach the summary.
              </p>
              <ButtonLink
                href="/builder"
                variant="primary"
                size="md"
                className="mt-5"
              >
                BUILD YOUR PC
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </Card>

            <Card className="p-6">
              <Wrench className="h-5 w-5 text-violet" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-semibold text-chrome">
                Bring your own
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-silver">
                Parts you already own, or bought elsewhere, are welcome. Send us
                the list on WhatsApp first — we will tell you whether it all
                fits together before anything is unboxed.
              </p>
              <WhatsAppButton
                message={WHATSAPP_MESSAGE}
                label="Send your part list"
                size="md"
                className="mt-5"
              />
            </Card>
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ash">
            Not sure what to buy yet?{" "}
            <Link href="/quote" className="text-cyan hover:underline">
              Ask for a quote
            </Link>{" "}
            or look at{" "}
            <Link href="/showcase" className="text-cyan hover:underline">
              what we build most often
            </Link>
            .
          </p>
        </section>

        <Divider className="my-14" />

        {/* --- FAQ --------------------------------------------------------- */}
        <section aria-labelledby="assembly-faq">
          <h2
            id="assembly-faq"
            className="font-display text-2xl font-semibold text-chrome sm:text-3xl"
          >
            Before you bring anything in
          </h2>
          <Faq entries={FAQS} className="mt-6 max-w-3xl" />
        </section>

        <TalkToUs
          className="mt-14"
          title="Send us the list first."
          description="It takes us two minutes to tell you whether a set of parts works together, and it is the cheapest check you will ever do."
          message={WHATSAPP_MESSAGE}
        />
      </div>
    </>
  );
}
