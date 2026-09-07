"use client";

/**
 * Step 2 — the budget band.
 *
 * Bands rather than a slider: a customer walking into Hafeez Centre thinks in
 * "around two and a half lakh", not in exact rupees, and a band keeps the
 * builder honest about the fact that final pricing is confirmed in the shop.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Wallet } from "lucide-react";
import { budgetBandOf, useBuild } from "@/lib/build-store";
import { BUDGET_BANDS } from "@/lib/types";
import { cn, formatShortPKR } from "@/lib/utils";
import { BudgetMeter } from "./BudgetMeter";

export function BudgetStep() {
  const { build, setBudget, componentsSubtotal } = useBuild();
  const reduceMotion = useReducedMotion();
  const current = budgetBandOf(build);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="eyebrow mb-3">Step 02 · Budget</p>
        <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-chrome-gradient sm:text-4xl">
          What are you looking to spend?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">
          A band, not a limit. The builder tracks your running total against it
          so you can see where the money is going as you pick parts.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {BUDGET_BANDS.map((band) => {
          const active = build.budgetId === band.id;
          return (
            <motion.button
              key={band.id}
              type="button"
              onClick={() => setBudget(active ? null : band)}
              aria-pressed={active}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors duration-200",
                active
                  ? "border-cyan/45 bg-cyan/[0.07]"
                  : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.05]",
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "tnum font-display text-lg font-bold tracking-tight",
                    active ? "text-cyan" : "text-chrome",
                  )}
                >
                  {band.max === null
                    ? `${formatShortPKR(band.min)}+`
                    : band.min === 0
                      ? `Up to ${formatShortPKR(band.max)}`
                      : `${formatShortPKR(band.min)} – ${formatShortPKR(band.max)}`}
                </span>
                {active && (
                  <Check className="mt-1 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                )}
              </span>
              <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                {band.label}
              </span>
              <span className="text-xs leading-relaxed text-silver">
                {band.blurb}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* --- Running total against the band --------------------------------- */}
      <div className="metal rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-cyan" aria-hidden="true" />
          <p className="font-display text-sm font-semibold text-chrome">
            {current ? current.label : "No band selected"}
          </p>
        </div>

        <BudgetMeter
          spent={componentsSubtotal}
          min={build.budgetMin}
          max={build.budgetMax}
          label="Components so far"
        />

        <p className="mt-4 text-xs leading-relaxed text-ash">
          Assembly services are added on top of the component total and are
          shown separately in your build summary.
        </p>
      </div>
    </div>
  );
}
