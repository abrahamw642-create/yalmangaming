/**
 * Section 3 — Build your own PC.
 *
 * The site's strongest call to action, so this is the loudest panel above the
 * fold-line of the second screen: full-bleed, its own grid backdrop, and the
 * only primary button in this stretch of the page.
 *
 * Every claim below describes something the builder actually does. The four
 * steps map one-to-one onto real behaviour — `checkCompatibility` for the fit
 * checks, `estimatePower` for the wattage line, `ASSEMBLY_SERVICES` for the
 * bench work — so nothing here promises a capability the product does not have.
 * No timeframes and no warranty language: neither has been confirmed.
 */

import Link from "next/link";
import { ArrowRight, CircuitBoard, PlugZap, ShieldCheck, Wrench } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { BUILDER_STEP_KINDS, KIND_META, type ComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    icon: CircuitBoard,
    title: "Pick every part",
    detail:
      "Start from a goal and a budget and let us narrow it, or go straight to the part list and choose it all yourself.",
    accent: "text-cyan",
  },
  {
    icon: ShieldCheck,
    title: "We check the fit",
    detail:
      "Socket, chipset, memory type, cooler height and card clearance are re-checked on every change — incompatible parts are greyed out with the reason.",
    accent: "text-violet",
  },
  {
    icon: PlugZap,
    title: "Watch the wattage",
    detail:
      "A live power estimate adds up as you build and recommends a supply with headroom for transient spikes.",
    accent: "text-ember",
  },
  {
    icon: Wrench,
    title: "We build and test it",
    detail:
      "Assembled, cable-managed, BIOS and drivers set up, then benchmarked and stress tested on our bench before it leaves the shop.",
    accent: "text-emerald",
  },
] as const;

/**
 * Deep links into individual builder steps. `/builder?step=<kind>` is a
 * supported entry point, so these are shortcuts for someone who already knows
 * which part they came to choose.
 */
const QUICK_STEP_KINDS: ComponentKind[] = [
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "storage",
  "case",
];

/** Only offer a shortcut to a step the builder actually has. */
const QUICK_STEPS = QUICK_STEP_KINDS.filter((kind) =>
  BUILDER_STEP_KINDS.includes(kind),
);

export function BuildYourPC() {
  return (
    <section
      id="build"
      aria-labelledby="build-heading"
      className="relative isolate overflow-hidden border-y border-[var(--color-line)] bg-carbon py-20 md:py-28"
    >
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full opacity-40 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.30), rgba(168,85,247,0.14) 55%, transparent 72%)",
        }}
      />

      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
          {/* --- Pitch --------------------------------------------------- */}
          <Reveal>
            <p className="eyebrow">The signature feature</p>
            <h2
              id="build-heading"
              className="mt-4 font-display text-[clamp(2rem,5.5vw,3.5rem)] font-bold uppercase leading-[0.98] tracking-[-0.02em] text-chrome-gradient"
            >
              Build your
              <br />
              own PC
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-silver sm:text-lg">
              Choose the processor, the card, the memory and the case yourself.
              The builder checks that the parts fit together as you go, adds up
              the power draw, and keeps a running total in rupees. When you are
              happy, we assemble and test the machine here in Lahore.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/builder" size="xl" className="w-full sm:w-auto">
                BUILD YOUR PC
              </ButtonLink>
              <ButtonLink
                href="/builder/recommend"
                variant="secondary"
                size="xl"
                className="w-full sm:w-auto"
              >
                HELP ME CHOOSE
              </ButtonLink>
            </div>

            <div className="mt-9">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ash">
                Jump straight to
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {QUICK_STEPS.map((kind) => (
                  <li key={kind}>
                    <Link
                      href={`/builder?step=${kind}`}
                      className={cn(
                        "inline-flex items-center rounded-full border border-line-strong px-3.5 py-1.5",
                        "text-xs font-medium text-silver transition-colors duration-200",
                        "hover:border-cyan/50 hover:bg-cyan/5 hover:text-chrome",
                      )}
                    >
                      {KIND_META[kind].label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/assembly"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
                      "text-xs font-medium text-cyan transition-colors duration-200 hover:text-chrome",
                    )}
                  >
                    We build it for you
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </div>
          </Reveal>

          {/* --- How it works -------------------------------------------- */}
          <Reveal delay={0.08}>
            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="metal group relative overflow-hidden rounded-2xl p-6"
                >
                  <span
                    aria-hidden="true"
                    className="tnum absolute right-5 top-4 font-mono text-4xl font-bold text-white/[0.04]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <step.icon
                    className={cn("h-7 w-7", step.accent)}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 font-display text-base font-semibold text-chrome">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ash">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default BuildYourPC;
