"use client";

/**
 * Power budget for the build.
 *
 * Every number comes from `estimatePower` — the same function the compatibility
 * engine uses to decide whether a PSU is undersized — so the breakdown a
 * customer reads and the rule that fires are the same arithmetic.
 */

import * as React from "react";
import { PlugZap, Zap } from "lucide-react";
import { Meter } from "@/components/ui";
import { KIND_META, type PowerEstimate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KindGlyph } from "./StepNav";

/** PSU load bands. Above ~85% transient spikes start tripping protection. */
function loadTone(percent: number): "emerald" | "ember" | "rose" {
  if (percent <= 70) return "emerald";
  if (percent <= 85) return "ember";
  return "rose";
}

function loadNote(percent: number): string {
  if (percent <= 40)
    return "Plenty of headroom — quiet fan curve and room for a GPU upgrade.";
  if (percent <= 70) return "Comfortable load. This is where a PSU is happiest.";
  if (percent <= 85)
    return "Working hard. It will run, but the fan will be audible under load.";
  return "Too close to the limit. Transient spikes can trip the unit's protection.";
}

export function PowerPanel({
  power,
  compact = false,
  className,
}: {
  power: PowerEstimate;
  compact?: boolean;
  className?: string;
}) {
  const { breakdown, estimatedWatts, recommendedPsuW, selectedPsuW, loadPercent } =
    power;

  const listed = breakdown.reduce((sum, row) => sum + row.watts, 0);
  // `estimatePower` adds a flat allowance for VRM losses, USB devices and the
  // rest of the board on top of the per-part figures. Showing it keeps the
  // column adding up to the headline number instead of quietly falling short.
  const baseline = Math.max(0, estimatedWatts - listed);
  const peak = Math.max(...breakdown.map((r) => r.watts), 1);

  if (estimatedWatts === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-line bg-white/[0.02] px-3.5 py-3",
          className,
        )}
      >
        <p className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Power
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-silver">
          Pick a processor or graphics card and the wattage estimate starts
          here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* --- Headline ------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
            Estimated draw
          </p>
          <p className="tnum mt-0.5 font-display text-xl font-bold text-chrome">
            {estimatedWatts}
            <span className="ml-0.5 text-sm font-medium text-silver">W</span>
          </p>
        </div>
        <div className="rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-2.5">
          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-cyan/80">
            Recommended PSU
          </p>
          <p className="tnum mt-0.5 font-display text-xl font-bold text-cyan">
            {recommendedPsuW}
            <span className="ml-0.5 text-sm font-medium text-cyan/70">W</span>
          </p>
        </div>
      </div>

      {/* --- Selected PSU load ---------------------------------------------- */}
      {selectedPsuW !== null && loadPercent !== null ? (
        <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
          <Meter
            value={Math.min(loadPercent, 100)}
            max={100}
            tone={loadTone(loadPercent)}
            label={`Load on your ${selectedPsuW}W supply`}
            caption={`${loadPercent}%`}
          />
          <p className="mt-2 text-xs leading-relaxed text-silver">
            {loadNote(loadPercent)}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
          <PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ash" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-silver">
            No power supply chosen yet. Aim for {recommendedPsuW}W.
          </p>
        </div>
      )}

      {/* --- Per-component breakdown ---------------------------------------- */}
      {!compact && breakdown.length > 0 && (
        <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
            Where the watts go
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {breakdown.map((row, i) => (
              <li key={`${row.kind}-${i}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <KindGlyph
                      kind={row.kind}
                      className="h-3 w-3 shrink-0 text-ash"
                    />
                    <span className="truncate text-xs text-silver">
                      {row.label}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-xs font-medium text-chrome">
                    {row.watts}W
                  </span>
                </div>
                <div
                  className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/6"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan/70 to-sky/70"
                    style={{ width: `${Math.round((row.watts / peak) * 100)}%` }}
                  />
                </div>
              </li>
            ))}

            {baseline > 0 && (
              <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <span className="text-xs text-ash">
                  Board, fans and USB baseline
                </span>
                <span className="tnum font-mono text-xs text-silver">
                  {baseline}W
                </span>
              </li>
            )}
          </ul>

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-ash">
            Estimated under a sustained gaming load, with headroom for CPU boost
            and GPU transient spikes. Idle draw is far lower.
          </p>
        </div>
      )}
    </div>
  );
}
