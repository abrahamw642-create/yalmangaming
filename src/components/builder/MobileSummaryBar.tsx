"use client";

/**
 * Mobile build summary.
 *
 * The desktop layout keeps the summary permanently in the right column; on a
 * phone that space does not exist, so it becomes a sticky bar pinned above the
 * thumb with the total and the compatibility state always readable, and the
 * full panel one tap away in a sheet.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronUp, X } from "lucide-react";
import { useBuild } from "@/lib/build-store";
import { cn, formatPKR } from "@/lib/utils";
import { BuildSummary } from "./BuildSummary";
import { CompatibilityStatusPill } from "./CompatibilityAlert";
import type { StepId } from "./StepNav";

export function MobileSummaryBar({
  onFocusStep,
  className,
}: {
  onFocusStep?: (step: StepId) => void;
  className?: string;
}) {
  const { build, report, total } = useBuild();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => setMounted(true), []);

  // Freeze the page behind the sheet, and restore whatever overflow the page
  // had rather than assuming it was the default.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const partCount = Object.values(build.selection).flat().length;

  return (
    <>
      <div
        className={cn(
          "glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-line-strong",
          // Hides at `xl`, which is exactly where the sticky summary column
          // appears — between the two there would otherwise be no summary.
          "pb-[env(safe-area-inset-bottom)] xl:hidden",
          className,
        )}
      >
        <div className="container-page flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="tnum font-display text-lg font-bold text-chrome">
                {formatPKR(total)}
              </span>
              <CompatibilityStatusPill status={report.status} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[0.625rem] uppercase tracking-wider text-ash">
              {partCount} {partCount === 1 ? "part" : "parts"}
              {report.power.estimatedWatts > 0 &&
                ` · ${report.power.estimatedWatts}W · ${report.power.recommendedPsuW}W PSU`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 rounded-xl px-5",
              "bg-gradient-to-b from-cyan to-sky font-semibold text-void shadow-glow-sm",
              "active:brightness-95",
            )}
          >
            View build
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="fixed inset-0 z-50 flex flex-col justify-end xl:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  aria-label="Close build summary"
                  onClick={() => setOpen(false)}
                  className="absolute inset-0 bg-void/80 backdrop-blur-sm"
                />

                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Build summary"
                  initial={reduceMotion ? { y: 0 } : { y: "100%" }}
                  animate={{ y: 0 }}
                  exit={reduceMotion ? { y: 0 } : { y: "100%" }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 36,
                  }}
                  className="glass-strong relative max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-line-strong"
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-graphite/90 px-5 py-3 backdrop-blur">
                    <span
                      className="mx-auto h-1 w-10 rounded-full bg-white/15"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ash hover:text-chrome"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
                    <BuildSummary
                      onFocusStep={(step) => {
                        onFocusStep?.(step);
                        setOpen(false);
                      }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
