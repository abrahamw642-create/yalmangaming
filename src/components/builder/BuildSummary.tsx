"use client";

/**
 * The live build summary.
 *
 * Always on screen — a sticky column on desktop, the contents of the sheet
 * behind the bottom bar on mobile. Everything it shows is derived from the
 * store on every render, so it cannot lag behind the configuration.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, RotateCcw } from "lucide-react";
import { groupParts, selectedServices } from "@/lib/build-serialize";
import { budgetBandOf, useBuild } from "@/lib/build-store";
import {
  BUILDER_STEP_KINDS,
  KIND_META,
  type ComponentKind,
} from "@/lib/types";
import { cn, formatPKR } from "@/lib/utils";
import { SamplePricingNote } from "@/components/ui";
import { BudgetMeter } from "./BudgetMeter";
import { BuildActions } from "./BuildActions";
import {
  CompatibilityAlert,
  CompatibilityStatusPill,
} from "./CompatibilityAlert";
import { PartSummaryRow } from "./PartRow";
import { PowerPanel } from "./PowerPanel";
import { KindGlyph, type StepId } from "./StepNav";

export function BuildSummary({
  onFocusStep,
  showActions = true,
  className,
}: {
  onFocusStep?: (step: StepId) => void;
  showActions?: boolean;
  className?: string;
}) {
  const {
    build,
    report,
    total,
    componentsSubtotal,
    servicesSubtotal,
    removePart,
    addPart,
    reset,
  } = useBuild();
  const reduceMotion = useReducedMotion();

  const band = budgetBandOf(build);
  const services = selectedServices(build.services);
  const chosenParts = Object.values(build.selection).flat();
  const anySample = chosenParts.some((p) => p.samplePrice);

  /** Kinds a rule is currently complaining about, for the rose outline. */
  const flaggedKinds = React.useMemo(() => {
    const set = new Set<ComponentKind>();
    for (const issue of report.issues) {
      if (issue.severity === "info") continue;
      for (const kind of issue.kinds) set.add(kind);
    }
    return set;
  }, [report.issues]);

  const filledKinds = BUILDER_STEP_KINDS.filter(
    (kind) => (build.selection[kind] ?? []).length > 0,
  );
  const emptyOptional = BUILDER_STEP_KINDS.filter(
    (kind) =>
      !KIND_META[kind].required && (build.selection[kind] ?? []).length === 0,
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* --- Header ---------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Your build</p>
          <h2 className="mt-1 truncate font-display text-lg font-bold text-chrome">
            {build.name.trim() || "Untitled Build"}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[0.6875rem] text-ash">
            {band && <span>{band.label}</span>}
            {build.resolution && <span>· {build.resolution}</span>}
            {build.targetFps && <span>· {build.targetFps} FPS</span>}
          </div>
        </div>
        <CompatibilityStatusPill status={report.status} className="shrink-0" />
      </div>

      {/* --- Parts ------------------------------------------------------------ */}
      {chosenParts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
          <p className="text-sm font-medium text-chrome">Nothing chosen yet</p>
          <p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-silver">
            Every part you pick appears here with a running total, a live
            wattage estimate and a compatibility check.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filledKinds.flatMap((kind) =>
              groupParts(build.selection[kind] ?? []).map(
                ({ part, quantity }) => (
                  <motion.li
                    key={`${kind}-${part.id}`}
                    layout={reduceMotion ? false : "position"}
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <PartSummaryRow
                      part={part}
                      kind={kind}
                      quantity={quantity}
                      flagged={flaggedKinds.has(kind)}
                      onEdit={onFocusStep ? () => onFocusStep(kind) : undefined}
                      onIncrement={() => addPart(kind, part)}
                      onDecrement={() => removePart(kind, part.id)}
                      onRemove={() => {
                        for (let i = 0; i < quantity; i++)
                          removePart(kind, part.id);
                      }}
                    />
                  </motion.li>
                ),
              ),
            )}
          </AnimatePresence>
        </ul>
      )}

      {/* --- Required but empty ------------------------------------------------ */}
      {report.missing.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {report.missing.map((kind) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => onFocusStep?.(kind)}
                disabled={!onFocusStep}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border border-dashed",
                  "border-line-strong px-3 py-2.5 text-left transition-colors",
                  onFocusStep && "hover:border-cyan/50 hover:bg-cyan/[0.04]",
                )}
              >
                <KindGlyph kind={kind} className="h-3.5 w-3.5 text-ash" />
                <span className="flex-1 text-xs text-silver">
                  Choose a {KIND_META[kind].label.toLowerCase()}
                </span>
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-ash">
                  required
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {emptyOptional.length > 0 && onFocusStep && (
        <div className="flex flex-wrap gap-1.5">
          {emptyOptional.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onFocusStep(kind)}
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[0.6875rem] text-ash transition-colors hover:border-line-strong hover:text-silver"
            >
              <Plus className="h-2.5 w-2.5" aria-hidden="true" />
              {KIND_META[kind].label}
            </button>
          ))}
        </div>
      )}

      {/* --- Services ---------------------------------------------------------- */}
      {services.length > 0 && (
        <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
          <button
            type="button"
            onClick={() => onFocusStep?.("services")}
            disabled={!onFocusStep}
            className="mb-2 block font-mono text-[0.625rem] uppercase tracking-wider text-ash hover:text-cyan"
          >
            Assembly services · {services.length}
          </button>
          <ul className="flex flex-col gap-1">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="truncate text-silver">{service.label}</span>
                <span
                  className={cn(
                    "tnum shrink-0 font-mono",
                    service.price === 0 ? "text-emerald" : "text-chrome",
                  )}
                >
                  {service.price === 0 ? "Included" : formatPKR(service.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Totals ------------------------------------------------------------ */}
      <div className="metal rounded-xl px-4 py-3.5">
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-ash">Components</dt>
            <dd className="tnum font-mono text-sm text-silver">
              {formatPKR(componentsSubtotal)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-ash">Services</dt>
            <dd className="tnum font-mono text-sm text-silver">
              {formatPKR(servicesSubtotal)}
            </dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-line pt-2.5">
            <dt className="font-display text-sm font-semibold text-chrome">
              Total
            </dt>
            <dd className="tnum font-display text-2xl font-bold text-chrome">
              {formatPKR(total)}
            </dd>
          </div>
        </dl>

        {anySample && (
          <p
            className="mt-1 text-right font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
            title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
          >
            includes sample pricing
          </p>
        )}

        {(build.budgetMin !== null || build.budgetMax !== null) && (
          <BudgetMeter
            className="mt-3 border-t border-line pt-3"
            spent={componentsSubtotal}
            min={build.budgetMin}
            max={build.budgetMax}
            compact
          />
        )}
      </div>

      {/* --- Power -------------------------------------------------------------- */}
      <PowerPanel power={report.power} compact />

      {/* --- Compatibility ------------------------------------------------------ */}
      {report.issues.length > 0 && (
        // `StepId` is a superset of `ComponentKind`, so the step handler is
        // already a valid kind handler — jumping to a flagged part is one tap.
        <CompatibilityAlert
          report={report}
          hideHeader
          onFocusKind={onFocusStep}
        />
      )}

      {/* --- Actions ------------------------------------------------------------ */}
      {showActions && (
        <>
          <BuildActions />
          {anySample && <SamplePricingNote />}
          {chosenParts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Clear every part and start this build again? This cannot be undone.",
                  )
                ) {
                  reset();
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ash transition-colors hover:text-rose"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Start over
            </button>
          )}
        </>
      )}
    </div>
  );
}
