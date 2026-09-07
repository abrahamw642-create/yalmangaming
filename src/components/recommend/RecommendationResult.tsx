"use client";

/**
 * The recommendation, rendered.
 *
 * Three things this view refuses to do, because the whole flow is only worth
 * anything if a customer can trust it:
 *
 *   - It never hides a compatibility error. If the engine could not fully
 *     repair the build, the failure is at the top of the page in red and the
 *     actions that would persist it are disabled.
 *   - It never rounds the budget. Over the ceiling is stated in rupees.
 *   - It never shows a frame rate that is not a stored measurement.
 *
 * Every part carries the reason it was chosen, built from that part's own
 * columns by `@/lib/recommend` — so a customer can disagree with a choice on
 * the merits rather than being asked to take it on faith.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ImageOff,
  Info,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  Badge,
  Button,
  Meter,
  Price,
  SamplePricingNote,
  StockIndicator,
} from "@/components/ui";
import {
  CompatibilityAlert,
  CompatibilityStatusPill,
} from "@/components/builder/CompatibilityAlert";
import { PowerPanel } from "@/components/builder/PowerPanel";
import { BudgetMeter } from "@/components/builder/BudgetMeter";
import { KindGlyph } from "@/components/builder/StepNav";
import { partSpecChips } from "@/components/builder/PartRow";
import { PerformanceTable } from "./PerformanceTable";
import { RecommendActions } from "./RecommendActions";
import type { PerformanceReport } from "@/lib/benchmarks";
import type { PartPick, RecommendNote, Recommendation } from "@/lib/recommend";
import { cn, formatPKR } from "@/lib/utils";

export function RecommendationResult({
  recommendation,
  performance,
  onEdit,
  onRestart,
  className,
}: {
  recommendation: Recommendation;
  performance: PerformanceReport;
  /** Back to the wizard with the answers intact. */
  onEdit: () => void;
  /** Back to the wizard with a clean slate. */
  onRestart: () => void;
  className?: string;
}) {
  const { budget, report, parts, notes } = recommendation;

  return (
    <div className={cn("flex flex-col gap-10", className)}>
      <Headline recommendation={recommendation} onEdit={onEdit} onRestart={onRestart} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        {/* --- Main column ------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-10">
          {notes.length > 0 && <Notes notes={notes} />}

          {/* The verdict comes before the parts: a customer should not scroll
              past nine components to discover the machine does not work. */}
          {(report.issues.length > 0 || report.missing.length > 0) && (
            <section aria-labelledby="compatibility-heading">
              <h3 id="compatibility-heading" className="eyebrow mb-3">
                Compatibility
              </h3>
              <CompatibilityAlert report={report} />
            </section>
          )}

          <section aria-labelledby="parts-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">The build</p>
                <h3
                  id="parts-heading"
                  className="font-display text-xl font-bold tracking-tight text-chrome"
                >
                  {parts.length} parts, and why each one is here
                </h3>
              </div>
              <p className="tnum font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
                {formatPKR(budget.total)} total
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {parts.map((pick) => (
                <PartCard key={pick.kind} pick={pick} />
              ))}
            </ul>

            <SamplePricingNote className="mt-4" />
          </section>

          <PerformanceTable report={performance} />

          <BudgetBreakdown recommendation={recommendation} />
        </div>

        {/* --- Sticky summary ----------------------------------------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-4">
            <RecommendActions recommendation={recommendation} />
            <PowerPanel power={report.power} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Headline                                                                   */
/* -------------------------------------------------------------------------- */

function Headline({
  recommendation,
  onEdit,
  onRestart,
}: {
  recommendation: Recommendation;
  onEdit: () => void;
  onRestart: () => void;
}) {
  const { budget, report, goal, input } = recommendation;

  return (
    <header className="metal rounded-2xl p-5 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CompatibilityStatusPill status={report.status} />
            <Badge tone="violet">{goal.label}</Badge>
            <Badge tone="cyan">
              {input.resolution} · {input.targetFps} FPS
            </Badge>
            {recommendation.achievable ? (
              <Badge tone="emerald">Within budget</Badge>
            ) : (
              <Badge tone="ember">Read the notes</Badge>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-chrome-gradient sm:text-3xl">
            {recommendation.suggestedName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-silver">
            {recommendation.summary}
          </p>

          {input.games.length > 0 && (
            <p className="mt-3 text-xs text-ash">
              Specced for {input.games.join(", ")}.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Change my answers
            </Button>
            <Button variant="ghost" size="sm" onClick={onRestart}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Start again
            </Button>
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-72">
          <Price
            price={budget.total}
            samplePrice={recommendation.samplePricing}
            size="xl"
          />
          <BudgetMeter
            className="mt-4"
            spent={budget.total}
            min={budget.min || null}
            max={budget.max}
            label="Components against your ceiling"
          />
          {budget.overBy > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-ember">
              {formatPKR(budget.overBy)} over the ceiling you set. This is the
              closest complete machine we can build.
            </p>
          ) : budget.remaining > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-silver">
              {formatPKR(budget.remaining)} of your ceiling left over.
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

const NOTE_STYLE: Record<RecommendNote["tone"], { ring: string; tone: string }> = {
  info: { ring: "border-line bg-white/[0.02]", tone: "text-silver" },
  warning: { ring: "border-ember/30 bg-ember/[0.06]", tone: "text-ember" },
  error: { ring: "border-rose/35 bg-rose/[0.07]", tone: "text-rose" },
};

const NOTE_ICON: Record<RecommendNote["tone"], typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  error: TriangleAlert,
};

function Notes({ notes }: { notes: RecommendNote[] }) {
  return (
    <section aria-label="Notes on this recommendation">
      <ul className="flex flex-col gap-2">
        {notes.map((note, index) => {
          const style = NOTE_STYLE[note.tone];
          const Icon = NOTE_ICON[note.tone];
          return (
            <li
              key={index}
              className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3", style.ring)}
            >
              <Icon
                className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", style.tone)}
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-silver">{note.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* One part                                                                   */
/* -------------------------------------------------------------------------- */

function PartCard({ pick }: { pick: PartPick }) {
  const { part } = pick;
  const chips = partSpecChips(part);

  return (
    <li className="metal rounded-2xl p-4">
      <div className="flex gap-4">
        <PartThumb src={part.imageUrl} alt={part.name} kind={pick.kind} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                <KindGlyph kind={pick.kind} className="h-3 w-3" />
                {pick.label}
              </p>
              <h4 className="mt-1 font-display text-base font-semibold leading-snug text-chrome">
                <Link
                  href={`/product/${part.slug}`}
                  className="transition-colors hover:text-cyan"
                >
                  {part.name}
                  <ArrowUpRight
                    className="ml-1 inline h-3 w-3 align-baseline opacity-60"
                    aria-hidden="true"
                  />
                </Link>
              </h4>
              {part.brandName && (
                <p className="mt-0.5 text-xs text-ash">{part.brandName}</p>
              )}
            </div>

            {/* Takes its own row on a phone — the price plus the "sample"
                marker plus a stock line will not share 220px with a part name
                without pushing the page sideways. */}
            <div className="min-w-0 basis-full sm:shrink-0 sm:basis-auto sm:text-right">
              <Price
                price={part.price}
                salePrice={part.salePrice}
                samplePrice={part.samplePrice}
                size="sm"
                className="sm:justify-end"
              />
              <StockIndicator stock={part.stock} showCount className="mt-1" />
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-md border border-line bg-white/[0.03] px-2 py-0.5 font-mono text-[0.625rem] text-silver"
                >
                  {chip}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs leading-relaxed text-silver">{pick.rationale}</p>

          {pick.repaired && pick.repairReason && (
            <p className="flex items-start gap-1.5 rounded-lg border border-cyan/25 bg-cyan/[0.05] px-2.5 py-1.5 text-[0.6875rem] leading-relaxed text-cyan">
              <Wrench className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {/* The engine's own wording, verbatim — a paraphrase here could
                  disagree with the rule that actually fired. */}
              <span>Swapped in after the first pass: {pick.repairReason}.</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Catalogue art is 400×300 line work on a transparent ground, not photography —
 * so it is contained with padding rather than cropped to fill, and a missing or
 * failed URL falls back to the kind's own glyph instead of a torn-page icon.
 */
function PartThumb({
  src,
  alt,
  kind,
}: {
  src: string | null;
  alt: string;
  kind: PartPick["kind"];
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = !!src && !failed;

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-line bg-carbon p-2 sm:h-20 sm:w-20">
      {showImage ? (
        // A plain <img>: `next.config.ts` ships an empty `images.remotePatterns`
        // allow-list, and this component must not care where the art is hosted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-iron">
          {kind ? (
            <KindGlyph kind={kind} className="h-6 w-6" />
          ) : (
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Where the money went                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The planned split beside what each slot actually cost.
 *
 * Shown because the plan and the outcome routinely disagree — a socket has no
 * board inside its share, a case has to be big enough for the card — and a
 * customer who can see that is in a position to argue with it.
 */
function BudgetBreakdown({ recommendation }: { recommendation: Recommendation }) {
  const { parts, budget, goal } = recommendation;
  const peak = Math.max(...parts.map((p) => Math.max(p.price, p.allocated)), 1);

  return (
    <section aria-labelledby="budget-heading">
      <div className="mb-4">
        <p className="eyebrow mb-2">Where the money went</p>
        <h3
          id="budget-heading"
          className="font-display text-xl font-bold tracking-tight text-chrome"
        >
          Planned split vs actual spend
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-silver">
          We split {formatPKR(budget.max)} using the emphasis a{" "}
          {goal.label.toLowerCase()} build calls for, shifted for{" "}
          {recommendation.input.resolution} and a {recommendation.input.targetFps}{" "}
          FPS target — then bought the best compatible part in each slot.
        </p>
      </div>

      <ul className="flex flex-col gap-3 rounded-2xl border border-line p-4">
        {parts.map((pick) => {
          const over = pick.allocated > 0 && pick.price > pick.allocated;
          return (
            <li key={pick.kind}>
              <Meter
                value={pick.price}
                max={peak}
                tone={over ? "ember" : "cyan"}
                label={pick.label}
                caption={
                  pick.allocated > 0
                    ? `${formatPKR(pick.price)} of ${formatPKR(pick.allocated)} planned`
                    : formatPKR(pick.price)
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
