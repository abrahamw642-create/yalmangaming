"use client";

/**
 * The catalogue for one component kind, ranked against the rest of the build.
 *
 * Every candidate is scored by `rankCandidates`, which swaps the part into a
 * copy of the current selection and re-runs the real engine — so the picker can
 * never drift out of sync with what validation will say a second later.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { rankCandidates, type CandidateVerdict } from "@/lib/compatibility";
import { KIND_META, type BuilderPart, type ComponentKind } from "@/lib/types";
import { useBuild } from "@/lib/build-store";
import { cn, formatPKR } from "@/lib/utils";
import { EmptyState } from "@/components/ui";
import { PartPickRow, partSpecChips } from "./PartRow";
import { KindGlyph } from "./StepNav";

type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
  { id: "name", label: "A–Z" },
];

/** How many rows render before the "show more" button. */
const PAGE = 14;

function priceOf(part: BuilderPart): number {
  return part.salePrice && part.salePrice > 0 && part.salePrice < part.price
    ? part.salePrice
    : part.price;
}

/** Free-text match across the fields a customer would actually type. */
function matches(part: BuilderPart, query: string): boolean {
  if (!query) return true;
  const haystack = [
    part.name,
    part.brandName ?? "",
    part.sku,
    part.headline ?? "",
    ...partSpecChips(part),
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function PartPicker({
  kind,
  parts,
  onPicked,
  className,
}: {
  kind: ComponentKind;
  parts: BuilderPart[];
  /** Fired after a part is added, so the step can collapse the picker. */
  onPicked?: (part: BuilderPart) => void;
  className?: string;
}) {
  const { build, addPart, componentsSubtotal } = useBuild();
  const reduceMotion = useReducedMotion();

  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("recommended");
  const [brand, setBrand] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(PAGE);

  const meta = KIND_META[kind];
  const selectedIds = React.useMemo(
    () => new Set((build.selection[kind] ?? []).map((p) => p.id)),
    [build.selection, kind],
  );

  // Ranking is the expensive step (one engine pass per candidate), so it is
  // memoised against the parts list and the rest of the selection only —
  // typing in the search box must not re-run it.
  const verdicts = React.useMemo(
    () => rankCandidates(kind, parts, build.selection),
    [kind, parts, build.selection],
  );

  const brands = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const part of parts) {
      if (!part.brandName) continue;
      counts.set(part.brandName, (counts.get(part.brandName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name]) => name);
  }, [parts]);

  const filtered = React.useMemo(() => {
    const rows = verdicts.filter(
      (v) =>
        matches(v.part, query) && (brand === null || v.part.brandName === brand),
    );

    const byName = (a: CandidateVerdict, b: CandidateVerdict) =>
      a.part.name.localeCompare(b.part.name);

    const sorted = [...rows];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => priceOf(a.part) - priceOf(b.part) || byName(a, b));
        break;
      case "price-desc":
        sorted.sort((a, b) => priceOf(b.part) - priceOf(a.part) || byName(a, b));
        break;
      case "name":
        sorted.sort(byName);
        break;
      default:
        // Recommended: things that work, that we have on the shelf, cheapest
        // first — the order a salesperson would hand them over in.
        sorted.sort(
          (a, b) =>
            Number(b.compatible) - Number(a.compatible) ||
            a.warnings.length - b.warnings.length ||
            Number(b.part.stock > 0) - Number(a.part.stock > 0) ||
            priceOf(a.part) - priceOf(b.part) ||
            byName(a, b),
        );
    }

    // Whatever the sort, an option that cannot physically work is never
    // allowed to sit above one that can.
    return [
      ...sorted.filter((v) => v.compatible),
      ...sorted.filter((v) => !v.compatible),
    ];
  }, [verdicts, query, brand, sort]);

  // A new search or filter should start from the top of the list again.
  React.useEffect(() => {
    setLimit(PAGE);
  }, [query, brand, sort, kind]);

  const compatibleCount = filtered.filter((v) => v.compatible).length;
  const visible = filtered.slice(0, limit);

  const budgetLeft =
    build.budgetMax !== null ? build.budgetMax - componentsSubtotal : null;

  const handlePick = (part: BuilderPart) => {
    addPart(kind, part);
    onPicked?.(part);
  };

  if (parts.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={<KindGlyph kind={kind} className="h-6 w-6" />}
        title={`No ${meta.plural.toLowerCase()} listed yet`}
        description="Nothing is in the catalogue for this step yet. Ask Yalman Gaming on WhatsApp about what is currently in stock."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* --- Controls ------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${meta.plural.toLowerCase()}`}
              aria-label={`Search ${meta.plural.toLowerCase()}`}
              className={cn(
                "h-11 w-full rounded-xl border border-line bg-carbon pl-9 pr-9",
                "text-sm text-chrome placeholder:text-ash",
                "focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ash hover:text-chrome"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-carbon p-1"
            role="group"
            aria-label="Sort parts"
          >
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                aria-pressed={sort === option.id}
                className={cn(
                  "h-9 whitespace-nowrap rounded-lg px-3 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
                  sort === option.id
                    ? "bg-cyan/15 text-cyan"
                    : "text-ash hover:text-chrome",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {brands.length > 1 && (
          <div
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
            role="group"
            aria-label="Filter by brand"
          >
            <BrandChip
              label="All brands"
              active={brand === null}
              onClick={() => setBrand(null)}
            />
            {brands.map((name) => (
              <BrandChip
                key={name}
                label={name}
                active={brand === name}
                onClick={() => setBrand(brand === name ? null : name)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="tnum font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
            {compatibleCount} compatible
            {filtered.length > compatibleCount &&
              ` · ${filtered.length - compatibleCount} blocked`}
          </p>
          {budgetLeft !== null && (
            <p
              className={cn(
                "tnum font-mono text-[0.6875rem] uppercase tracking-wider",
                budgetLeft < 0 ? "text-rose" : "text-ash",
              )}
            >
              {budgetLeft < 0
                ? `${formatPKR(Math.abs(budgetLeft))} over budget`
                : `${formatPKR(budgetLeft)} left in budget`}
            </p>
          )}
        </div>
      </div>

      {/* --- List ---------------------------------------------------------- */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="Nothing matches that search"
          description="Try a shorter search, or clear the brand filter."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visible.map((verdict) => (
              <motion.li
                key={verdict.part.id}
                layout={reduceMotion ? false : "position"}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <PartPickRow
                  part={verdict.part}
                  verdict={verdict}
                  selected={selectedIds.has(verdict.part.id)}
                  onSelect={() => handlePick(verdict.part)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {filtered.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="h-11 rounded-xl border border-line-strong text-sm font-semibold text-chrome transition-colors hover:border-cyan/50 hover:text-cyan"
        >
          Show {Math.min(PAGE, filtered.length - visible.length)} more
        </button>
      )}
    </div>
  );
}

function BrandChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-cyan/40 bg-cyan/10 text-cyan"
          : "border-line bg-white/[0.02] text-silver hover:border-line-strong hover:text-chrome",
      )}
    >
      {label}
    </button>
  );
}
