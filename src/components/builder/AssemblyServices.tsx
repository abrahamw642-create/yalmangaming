"use client";

/**
 * Assembly and bench services.
 *
 * Service pricing is seeded sample data (see `ASSEMBLY_SERVICES` in
 * `@/lib/types`), so every figure here carries the same "sample" marker as a
 * product price and the panel says so once, plainly.
 */

import * as React from "react";
import { Check, Wrench } from "lucide-react";
import { servicesSubtotal } from "@/lib/build-serialize";
import { useBuild } from "@/lib/build-store";
import { ASSEMBLY_SERVICES } from "@/lib/types";
import { cn, formatPKR } from "@/lib/utils";
import { SamplePricingNote } from "@/components/ui";

export function AssemblyServices({ className }: { className?: string }) {
  const { build, toggleService, setAssembleForMe } = useBuild();
  const subtotal = servicesSubtotal(build.services);
  const chosen = build.services.length;

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <header>
        <p className="eyebrow mb-3">Assembly</p>
        <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-chrome-gradient sm:text-4xl">
          Pick the parts.
          <br />
          We build the machine.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">
          Bring the configuration to the bench at Hafeez Centre and we assemble,
          cable, flash, test and hand it over running. Or take the parts and
          build it yourself — both are fine.
        </p>
      </header>

      {/* --- Master switch --------------------------------------------------- */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
          build.assembleForMe
            ? "border-cyan/40 bg-cyan/[0.06]"
            : "border-line bg-white/[0.02]",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              build.assembleForMe
                ? "border-cyan/40 bg-cyan/15 text-cyan"
                : "border-line bg-white/[0.03] text-ash",
            )}
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-chrome">
              Have Yalman Gaming assemble this build
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-silver">
              Turns on our standard bench process. Untick anything you do not
              want.
            </p>
          </div>
        </div>

        <Toggle
          checked={build.assembleForMe}
          onChange={setAssembleForMe}
          label="Have Yalman Gaming assemble this build"
        />
      </div>

      {/* --- Service list ---------------------------------------------------- */}
      <ul className="flex flex-col gap-2">
        {ASSEMBLY_SERVICES.map((service) => {
          const checked = build.services.includes(service.id);
          return (
            <li key={service.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  checked
                    ? "border-cyan/35 bg-cyan/[0.05]"
                    : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleService(service.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "border-cyan bg-cyan text-void"
                      : "border-line-strong bg-transparent",
                  )}
                >
                  {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-chrome">
                      {service.label}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "tnum font-mono text-sm font-medium",
                          service.price === 0 ? "text-emerald" : "text-chrome",
                        )}
                      >
                        {service.price === 0
                          ? "Included"
                          : formatPKR(service.price)}
                      </span>
                      {service.price > 0 && (
                        <span
                          className="font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
                          title="Sample pricing pending confirmation from Yalman Gaming."
                        >
                          sample
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-silver">
                    {service.description}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* --- Subtotal --------------------------------------------------------- */}
      <div className="metal flex items-baseline justify-between gap-4 rounded-2xl px-5 py-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
            Services subtotal
          </p>
          <p className="mt-0.5 text-xs text-silver">
            {chosen === 0
              ? "No services selected"
              : `${chosen} service${chosen === 1 ? "" : "s"} selected`}
          </p>
        </div>
        <p className="tnum font-display text-2xl font-bold text-chrome">
          {formatPKR(subtotal)}
        </p>
      </div>

      <SamplePricingNote />
    </div>
  );
}

/** Accessible switch. A real checkbox underneath, styled as a track and knob. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border transition-colors",
        checked ? "border-cyan/50 bg-cyan/25" : "border-line-strong bg-white/5",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full transition-all duration-200",
          checked ? "left-[calc(100%-1.75rem)] bg-cyan" : "left-1 bg-iron",
        )}
        aria-hidden="true"
      />
    </button>
  );
}
