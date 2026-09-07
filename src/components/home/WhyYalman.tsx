/**
 * Section 6 — Why Yalman Gaming.
 *
 * Every point is rendered straight from `WHY_POINTS` in `@/lib/site`, which is
 * the file the store owner's facts live in. Nothing is written here: adding a
 * reason means adding it there, where it sits next to the note about not
 * inventing claims.
 *
 * `WHY_POINTS` names its icon and accent as strings, so both are resolved
 * through explicit maps. A string lookup against the whole lucide barrel would
 * fail silently at runtime and pull the entire icon set into the bundle; an
 * unknown key here simply falls back.
 */

import {
  Activity,
  BadgeCheck,
  MapPin,
  MessageCircle,
  Sparkles,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/ui";
import { WHY_POINTS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const ICONS: Record<string, LucideIcon> = {
  wrench: Wrench,
  "badge-check": BadgeCheck,
  "message-circle": MessageCircle,
  activity: Activity,
  "map-pin": MapPin,
  star: Star,
};

/**
 * `WHY_POINTS` uses "amber" where the design system's token is `ember`; the
 * map absorbs that rather than either file having to change.
 */
const ACCENT_CLASSES: Record<string, string> = {
  cyan: "text-cyan",
  violet: "text-violet",
  amber: "text-ember",
  ember: "text-ember",
  emerald: "text-emerald",
  rose: "text-rose",
  lime: "text-lime",
  sky: "text-sky",
};

export function WhyYalman() {
  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      className="relative isolate overflow-hidden border-y border-[var(--color-line)] bg-carbon py-20 md:py-28"
    >
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-50" />

      <div className="container-page">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Why us"
            title={<span id="why-heading">Why Yalman Gaming</span>}
            description="A hardware shop in Hafeez Centre that builds the machines it sells."
          />
        </Reveal>

        <Reveal delay={0.05} className="mt-12">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map((point) => {
              const Icon = ICONS[point.icon] ?? Sparkles;
              const accent = ACCENT_CLASSES[point.accent] ?? "text-cyan";

              return (
                <li
                  key={point.title}
                  className={cn(
                    "metal group relative flex h-full flex-col rounded-2xl p-6",
                    "transition-colors duration-300 hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-xl",
                      "border border-[var(--color-line)] bg-white/[0.03]",
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", accent)}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>

                  <h3 className="mt-5 font-display text-base font-semibold text-chrome">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ash">
                    {point.detail}
                  </p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export default WhyYalman;
