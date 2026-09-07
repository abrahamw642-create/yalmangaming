/**
 * The full specification table on the product page.
 *
 * Two sources, in order of trust: the product's own `specSheet` (what Yalman
 * entered for this SKU), and — where the sheet is thin — the real, structured
 * compatibility columns. Nothing is inferred or filled in: a column with no
 * value produces no row.
 */

import { groupSpecs, type SpecRow } from "@/lib/specs";
import {
  COMPARE_FIELDS,
  formatCompareValue,
  type CompareValue,
} from "@/lib/filters";
import { cn } from "@/lib/utils";

export function SpecificationTable({
  rows,
  className,
}: {
  rows: SpecRow[];
  className?: string;
}) {
  const groups = groupSpecs(rows);
  if (!groups.length) return null;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {groups.map((group) => (
        <section key={group.group}>
          <h3 className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-cyan">
            {group.group}
          </h3>
          <dl className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            {group.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 px-4 py-2.5",
                  // Zebra striping keeps long spec sheets scannable.
                  index % 2 === 1 && "bg-white/[0.02]",
                )}
              >
                <dt className="text-sm text-ash">{row.label}</dt>
                <dd className="tnum font-mono text-sm text-chrome">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/**
 * Turns the populated structured columns into spec rows, reusing the labels and
 * grouping the comparison table already defines so the two views agree.
 */
export function derivedSpecRows(
  source: Record<string, unknown> | null | undefined,
): SpecRow[] {
  if (!source) return [];

  const rows: SpecRow[] = [];
  for (const field of COMPARE_FIELDS) {
    const raw = source[field.key];
    const value: CompareValue =
      typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
        ? raw
        : null;
    if (value === null || value === "") continue;
    // Booleans that are false are still meaningful for "RGB lighting: No".
    rows.push({
      group: field.group,
      label: field.label,
      value: formatCompareValue(field, value),
    });
  }
  return rows;
}

/**
 * Merges the stored spec sheet with the derived column rows, keeping the stored
 * row whenever both describe the same label.
 */
export function mergeSpecRows(sheet: SpecRow[], derived: SpecRow[]): SpecRow[] {
  const seen = new Set(sheet.map((row) => row.label.toLowerCase()));
  return [...sheet, ...derived.filter((row) => !seen.has(row.label.toLowerCase()))];
}
