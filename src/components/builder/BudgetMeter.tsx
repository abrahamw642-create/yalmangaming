"use client";

/**
 * Spend against the chosen budget band.
 *
 * The band is a stated intention, not a rule — going over is allowed and the
 * meter simply says so plainly rather than blocking anything.
 */

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Meter } from "@/components/ui";
import { cn, formatPKR } from "@/lib/utils";

export function BudgetMeter({
  spent,
  min,
  max,
  label = "Budget",
  compact = false,
  className,
}: {
  spent: number;
  min: number | null;
  max: number | null;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  // No band chosen, or an open-ended one: there is nothing to measure against,
  // so show the running total rather than an invented ceiling.
  if (max === null) {
    return (
      <div className={cn("flex items-baseline justify-between gap-3", className)}>
        <span className="text-xs text-ash">
          {min !== null ? `${label} · ${formatPKR(min)}+` : label}
        </span>
        <span className="tnum font-mono text-xs font-medium text-silver">
          {formatPKR(spent)} spent
        </span>
      </div>
    );
  }

  const over = spent > max;
  const under = min !== null && spent > 0 && spent < min;
  const tone = over ? "rose" : under ? "cyan" : "emerald";
  const pct = max > 0 ? Math.round((spent / max) * 100) : 0;

  return (
    <div className={className}>
      {/* The label doubles as the meter's accessible name, so it is always
          passed — even in the compact sidebar variant. */}
      <Meter
        value={Math.min(spent, max)}
        max={max}
        tone={tone}
        label={compact ? label : `${label} · ${formatPKR(max)} ceiling`}
        caption={
          compact
            ? `${formatPKR(spent)} / ${formatPKR(max)}`
            : `${formatPKR(spent)} · ${pct}%`
        }
      />

      {compact ? (
        over ? (
          <p className="mt-1.5 text-xs text-rose">
            {formatPKR(spent - max)} over budget
          </p>
        ) : null
      ) : over ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-rose">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {formatPKR(spent - max)} over your band. That is fine — the band is
            only a guide — but a cheaper part in one slot usually buys more
            performance in another.
          </span>
        </p>
      ) : under && min !== null ? (
        <p className="mt-2 text-xs leading-relaxed text-silver">
          {formatPKR(min - spent)} of your band is still unspent.
        </p>
      ) : null}
    </div>
  );
}
