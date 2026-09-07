"use client";

/**
 * One component step: what is currently chosen for this kind, why it does or
 * does not work, and the catalogue to change it.
 *
 * Once a single-slot kind is filled the picker collapses to the chosen part —
 * the step visibly *resolves*, the way a configurator should — but "Change"
 * reopens it instantly, so nobody is locked into an earlier decision.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, RotateCcw } from "lucide-react";
import { groupParts } from "@/lib/build-serialize";
import { useBuild } from "@/lib/build-store";
import { KIND_META, type BuilderPart, type ComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { CompatibilityAlert } from "./CompatibilityAlert";
import { PartPicker } from "./PartPicker";
import { PartSummaryRow } from "./PartRow";
import { KindGlyph } from "./StepNav";

export function ComponentStep({
  kind,
  parts,
  onFocusKind,
}: {
  kind: ComponentKind;
  parts: BuilderPart[];
  onFocusKind?: (kind: ComponentKind) => void;
}) {
  const { build, report, addPart, removePart, clearKind } = useBuild();
  const reduceMotion = useReducedMotion();

  const meta = KIND_META[kind];
  const selected = build.selection[kind] ?? [];
  const groups = React.useMemo(() => groupParts(selected), [selected]);

  // Open when there is nothing to show; the caller remounts this component on
  // every kind change (keyed by kind), so this initial value is always right.
  const [pickerOpen, setPickerOpen] = React.useState(selected.length === 0);

  const kindHasIssue = report.issues.some(
    (issue) => issue.severity !== "info" && issue.kinds.includes(kind),
  );

  // Multi-slot kinds keep the catalogue open so a second drive or a third fan
  // is one more tap; single-slot kinds resolve to the chosen part.
  const handlePicked = () => {
    if (!meta.multiple) setPickerOpen(false);
  };

  /**
   * The ✕ on a grouped row removes every copy of that part — which is what it
   * should do on a row of three identical fans. The ± stepper is the one-at-a-
   * time control.
   */
  const removeAll = (part: BuilderPart, quantity: number) => {
    for (let i = 0; i < quantity; i++) removePart(kind, part.id);
    if (selected.every((p) => p.id === part.id)) setPickerOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-cyan">
            <KindGlyph kind={kind} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight text-chrome sm:text-3xl">
                {meta.label}
              </h2>
              {meta.required ? (
                <Badge tone="cyan">Required</Badge>
              ) : (
                <Badge tone="neutral">Optional</Badge>
              )}
              {meta.multiple && <Badge tone="violet">Multiple allowed</Badge>}
            </div>
            {meta.hint && (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-silver">
                {meta.hint}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* --- Current selection --------------------------------------------- */}
      <AnimatePresence initial={false}>
        {groups.length > 0 && (
          <motion.section
            key="selected"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">In your build</p>
                <button
                  type="button"
                  onClick={() => {
                    clearKind(kind);
                    setPickerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ash transition-colors hover:text-rose"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Clear
                </button>
              </div>

              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {groups.map(({ part, quantity }) => (
                    <motion.li
                      key={part.id}
                      layout={reduceMotion ? false : "position"}
                      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                    >
                      <PartSummaryRow
                        part={part}
                        kind={kind}
                        quantity={quantity}
                        flagged={kindHasIssue}
                        onRemove={() => removeAll(part, quantity)}
                        onIncrement={() => addPart(kind, part)}
                        onDecrement={() => removePart(kind, part.id)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              {!pickerOpen && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setPickerOpen(true)}
                  className="mt-1 w-full sm:w-auto"
                >
                  {meta.multiple ? (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add another {meta.label.toLowerCase()}
                    </>
                  ) : (
                    `Change ${meta.label.toLowerCase()}`
                  )}
                </Button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* --- Issues touching this kind ------------------------------------- */}
      <CompatibilityAlert report={report} only={kind} onFocusKind={onFocusKind} />

      {/* --- Catalogue ----------------------------------------------------- */}
      <AnimatePresence initial={false}>
        {pickerOpen && (
          <motion.section
            key="picker"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">
                  {groups.length > 0 ? `Change ${meta.label}` : `Choose ${meta.label}`}
                </p>
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash transition-colors hover:text-chrome"
                  >
                    Close
                  </button>
                )}
              </div>
              <PartPicker kind={kind} parts={parts} onPicked={handlePicked} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
