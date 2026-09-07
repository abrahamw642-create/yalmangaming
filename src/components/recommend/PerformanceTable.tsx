"use client";

/**
 * Expected performance for a recommended build.
 *
 * This component renders stored measurements and nothing else. It cannot
 * calculate, scale or interpolate a frame rate, and it has no code path that
 * produces a number the `Benchmark` table does not already hold — a game with
 * no row gets an explicit "no verified data" line, which is information the
 * customer needs rather than a gap to hide.
 *
 * Every figure is shown with the `source` it came from and the `cpuContext` it
 * was measured on, because 470 FPS in CS2 is a property of a pairing, not of a
 * graphics card on its own.
 */

import * as React from "react";
import { Activity, CircleSlash, Info } from "lucide-react";
import type { BenchmarkRow, PerformanceReport } from "@/lib/benchmarks";
import { cn } from "@/lib/utils";

/**
 * Mirrors `NO_DATA_LABEL` in `@/lib/benchmarks`. That module reads Prisma at
 * module scope, so a client component cannot import a value from it without
 * dragging the database client into the browser bundle — the string is restated
 * here rather than shipping a server module to every visitor.
 */
const NO_DATA_LABEL = "No verified data yet";

const NO_DATA_DETAIL =
  "Yalman Gaming has not measured this combination, and we do not publish estimated frame rates. Ask us in the shop or on WhatsApp and we will test it.";

export function PerformanceTable({
  report,
  className,
}: {
  report: PerformanceReport;
  className?: string;
}) {
  const { entries, resolution, targetFps, productName } = report;

  return (
    <section aria-labelledby="performance-heading" className={className}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Expected performance</p>
          <h3
            id="performance-heading"
            className="font-display text-xl font-bold tracking-tight text-chrome"
          >
            What we have actually measured
          </h3>
          {productName && (
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-silver">
              Whatever we hold on record for the{" "}
              <span className="text-chrome">{productName}</span> at {resolution}.
              We never estimate a frame rate, so a title with no measurement
              shows as one.
            </p>
          )}
        </div>
        {targetFps !== null && (
          <p className="tnum font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
            Your target · {targetFps} FPS
          </p>
        )}
      </header>

      {entries.length === 0 ? (
        <NoDataPanel
          title={NO_DATA_LABEL}
          detail={
            productName
              ? `We have no recorded figures for the ${productName} at ${resolution}. ${NO_DATA_DETAIL}`
              : NO_DATA_DETAIL
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[38rem] border-collapse text-left">
            <caption className="sr-only">
              Recorded average frame rates at {resolution}, with the source and
              the processor each figure was measured on. Games with no recorded
              figure are marked &ldquo;{NO_DATA_LABEL}&rdquo;.
            </caption>
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <Th className="w-[30%]">Game</Th>
                <Th className="w-[14%]">Preset</Th>
                <Th className="w-[14%] text-right">Average</Th>
                <Th className="w-[14%] text-right">1% low</Th>
                <Th className="w-[28%]">Measured on</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                entry.rows.length === 0 ? (
                  <tr key={entry.game} className="border-b border-line last:border-0">
                    <Td className="font-medium text-chrome">{entry.game}</Td>
                    <td colSpan={4} className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-sm text-ash">
                        <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
                        {NO_DATA_LABEL}
                      </span>
                    </td>
                  </tr>
                ) : (
                  entry.rows.map((row, index) => (
                    <BenchmarkTableRow
                      key={row.id}
                      row={row}
                      game={index === 0 ? entry.game : null}
                      targetFps={targetFps}
                    />
                  ))
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      <Footnote report={report} />
    </section>
  );
}

function BenchmarkTableRow({
  row,
  game,
  targetFps,
}: {
  row: BenchmarkRow;
  /** Only the first row of a game repeats its name. */
  game: string | null;
  targetFps: number | null;
}) {
  // A comparison against the customer's own target is the one derived value
  // here, and it is a comparison of two stored numbers — not a new figure.
  const meets = targetFps === null ? null : row.avgFps >= targetFps;

  return (
    <tr className="border-b border-line last:border-0">
      <Td className="font-medium text-chrome">{game ?? ""}</Td>
      <Td className="text-silver">{row.preset}</Td>
      <td className="px-3 py-3 text-right">
        <span
          className={cn(
            "tnum font-mono text-sm font-semibold",
            meets === null ? "text-chrome" : meets ? "text-emerald" : "text-ember",
          )}
        >
          {row.avgFps} FPS
        </span>
        {meets !== null && (
          <span className="sr-only">
            {meets ? " — meets your target" : " — below your target"}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <span className="tnum font-mono text-sm text-silver">
          {row.onePercentLow === null ? "—" : `${row.onePercentLow} FPS`}
        </span>
      </td>
      <Td>
        <span className="block text-xs leading-relaxed text-silver">
          {row.cpuContext ?? "Processor not recorded"}
        </span>
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ash">
          {row.source}
        </span>
        {row.notes && (
          <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ash">
            {row.notes}
          </span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-ash",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 align-top text-sm", className)}>{children}</td>;
}

function NoDataPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-5">
      <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-ash" aria-hidden="true" />
      <div>
        <p className="font-display text-sm font-semibold text-chrome">{title}</p>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-silver">{detail}</p>
      </div>
    </div>
  );
}

/**
 * The honesty footer. Says how much of the customer's list we can evidence and
 * where the numbers came from — both read straight off the report.
 */
function Footnote({ report }: { report: PerformanceReport }) {
  const asked = report.entries.length;
  const covered = report.covered;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {asked > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ash">
          <Activity className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {covered === asked
              ? `We have recorded figures for all ${asked} of the ${asked === 1 ? "title" : "titles"} you named at ${report.resolution}.`
              : covered === 0
                ? `We have no recorded figures for ${asked === 1 ? "the title" : "any of the titles"} you named at ${report.resolution}. That is a gap in our records, not a verdict on the build.`
                : `We have recorded figures for ${covered} of the ${asked} titles you named at ${report.resolution}. The rest are gaps in our records, not verdicts on the build.`}
          </span>
        </p>
      )}

      {report.sources.length > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ash">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {report.sources.length === 1 ? "Source" : "Sources"}:{" "}
            {report.sources.join(" · ")}
            {report.cpuContexts.length > 0 && (
              <>
                {" "}
                Measured on {report.cpuContexts.join(", ")} — a different
                processor moves these numbers, and none of them come from your
                exact configuration.
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
