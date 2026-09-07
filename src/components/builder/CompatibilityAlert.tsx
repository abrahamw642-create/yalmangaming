"use client";

/**
 * The build's compatibility verdict.
 *
 * Severity maps straight onto the engine's contract:
 *   error   → NOT COMPATIBLE (red)    — blocks the cart and the save
 *   warning → WARNING (amber)         — allowed, but said out loud
 *   info    → note (neutral)
 *
 * Every issue shows the engine's own `title`, `detail` and `fix`. Nothing is
 * paraphrased here: the rule that fired is the one the customer reads.
 */

import * as React from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import type {
  CompatibilityIssue,
  CompatibilityReport,
  ComponentKind,
} from "@/lib/types";
import { KIND_META } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KindGlyph } from "./StepNav";

const STATUS: Record<
  CompatibilityReport["status"],
  { label: string; tone: string; ring: string; Icon: typeof Check }
> = {
  ok: {
    label: "OK",
    tone: "text-emerald",
    ring: "border-emerald/30 bg-emerald/[0.07]",
    Icon: Check,
  },
  warning: {
    label: "Warning",
    tone: "text-ember",
    ring: "border-ember/30 bg-ember/[0.07]",
    Icon: TriangleAlert,
  },
  error: {
    label: "Not compatible",
    tone: "text-rose",
    ring: "border-rose/35 bg-rose/[0.07]",
    Icon: X,
  },
};

const SEVERITY: Record<
  CompatibilityIssue["severity"],
  { tone: string; ring: string; Icon: typeof Check; label: string }
> = {
  error: {
    tone: "text-rose",
    ring: "border-rose/30 bg-rose/[0.05]",
    Icon: X,
    label: "Not compatible",
  },
  warning: {
    tone: "text-ember",
    ring: "border-ember/30 bg-ember/[0.05]",
    Icon: TriangleAlert,
    label: "Warning",
  },
  info: {
    tone: "text-silver",
    ring: "border-line bg-white/[0.02]",
    Icon: Info,
    label: "Note",
  },
};

export function CompatibilityStatusPill({
  status,
  className,
}: {
  status: CompatibilityReport["status"];
  className?: string;
}) {
  const config = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "font-mono text-[0.625rem] font-medium uppercase tracking-wider",
        config.ring,
        config.tone,
        className,
      )}
    >
      <config.Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function CompatibilityAlert({
  report,
  /** Limit to issues that involve this kind — used inside a component step. */
  only,
  /** Hide the status header; the summary panel draws its own. */
  hideHeader = false,
  onFocusKind,
  className,
}: {
  report: CompatibilityReport;
  only?: ComponentKind;
  hideHeader?: boolean;
  onFocusKind?: (kind: ComponentKind) => void;
  className?: string;
}) {
  const issues = only
    ? report.issues.filter((issue) => issue.kinds.includes(only))
    : report.issues;

  const config = STATUS[report.status];

  if (only && issues.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!hideHeader && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-3.5 py-3",
            config.ring,
          )}
        >
          <config.Icon
            className={cn("mt-0.5 h-4 w-4 shrink-0", config.tone)}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-mono text-[0.6875rem] font-semibold uppercase tracking-wider",
                config.tone,
              )}
            >
              {config.label}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-silver">
              {report.status === "error"
                ? "Some selected parts cannot work together. Fix the errors below to continue."
                : report.status === "warning"
                  ? "Everything fits, but there are notes worth reading."
                  : report.missing.length > 0
                    ? "No conflicts so far. Keep going — some required parts are still empty."
                    : "Every part in this build works with every other part."}
            </p>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onFocusKind={onFocusKind} />
          ))}
        </ul>
      )}

      {!only && report.missing.length > 0 && (
        <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
            Still to choose
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.missing.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onFocusKind?.(kind)}
                disabled={!onFocusKind}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-line-strong",
                  "px-2.5 py-1 text-xs text-silver transition-colors",
                  onFocusKind && "hover:border-cyan/50 hover:text-cyan",
                )}
              >
                <KindGlyph kind={kind} className="h-3 w-3" />
                {KIND_META[kind].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  onFocusKind,
}: {
  issue: CompatibilityIssue;
  onFocusKind?: (kind: ComponentKind) => void;
}) {
  const config = SEVERITY[issue.severity];

  return (
    <li className={cn("rounded-xl border px-3.5 py-3", config.ring)}>
      <div className="flex items-start gap-2.5">
        <config.Icon
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.tone)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold leading-snug", config.tone)}>
            {issue.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-silver">
            {issue.detail}
          </p>
          {issue.fix && (
            <p className="mt-1.5 text-xs leading-relaxed text-chrome">
              <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                Fix ·{" "}
              </span>
              {issue.fix}
            </p>
          )}
          {onFocusKind && issue.kinds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {issue.kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onFocusKind(kind)}
                  className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-silver transition-colors hover:border-cyan/50 hover:text-cyan"
                >
                  <KindGlyph kind={kind} className="h-2.5 w-2.5" />
                  {KIND_META[kind].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
