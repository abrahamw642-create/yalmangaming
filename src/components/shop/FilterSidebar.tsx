"use client";

/**
 * The faceted filter panel.
 *
 * Every control writes to the query string and lets the Server Component page
 * re-render — there is no client-side copy of the product list to keep in sync,
 * and a filtered listing is a real, shareable URL.
 *
 * The facet counts come from `getProducts`, which computes each dimension with
 * every filter *except that dimension* applied. That is what makes multi-select
 * behave: ticking a second brand widens the result instead of emptying it, and
 * a value that would yield nothing is never offered in the first place.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import {
  FACET_DEFS,
  FACET_KEYS,
  KIND_FACET_KEYS,
  activeFilterChips,
  clearedQuery,
  countActiveFilters,
  facetValues,
  queryHref,
  toggleFacet,
  withFilter,
  type FacetBucket,
  type FacetKey,
  type Facets,
  type ProductQuery,
} from "@/lib/filters";
import { isComponentKind } from "@/lib/types";
import { cn, formatPKR, formatShortPKR } from "@/lib/utils";

type SidebarProps = {
  query: ProductQuery;
  facets: Facets;
  /** Path the filters navigate within, e.g. `/shop` or `/shop/graphics-cards`. */
  basePath: string;
  total: number;
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Which dimensions to offer                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A thirteen-section sidebar helps nobody. On an unscoped listing only the
 * dimensions that apply to everything are shown; once the listing is down to a
 * single kind, that kind's own specs appear. Anything already selected stays
 * visible so it can always be un-selected.
 */
function visibleFacetKeys(query: ProductQuery, facets: Facets): FacetKey[] {
  const selectedKinds = facetValues(query, "kind");
  const kindBuckets = facets.buckets.kind;
  const soleKind =
    selectedKinds.length === 1
      ? selectedKinds[0]
      : kindBuckets.length === 1
        ? kindBuckets[0].value
        : null;

  const allowed: FacetKey[] =
    soleKind && isComponentKind(soleKind)
      ? (KIND_FACET_KEYS[soleKind] ?? ["brand"])
      : ["kind", "brand"];

  return FACET_KEYS.filter((key) => {
    const selected = facetValues(query, key).length > 0;
    if (selected) return true;
    if (!allowed.includes(key)) return false;

    const buckets = facets.buckets[key];
    // One option is not a choice.
    return buckets.length > 1;
  });
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

/** The desktop rail. Pair it with `<MobileFilters>` for small screens. */
export function FilterSidebar(props: SidebarProps) {
  return (
    <aside className={cn("hidden lg:block", props.className)} aria-label="Product filters">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
        <FilterPanel {...props} />
      </div>
    </aside>
  );
}

/**
 * Trigger + slide-over for phones and tablets. Separate from the rail so a page
 * can put the button in its toolbar row without dragging the desktop aside
 * along with it.
 */
export function MobileFilters(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  const activeCount = countActiveFilters(props.query);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "metal inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-wide text-chrome lg:hidden",
          props.className,
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        FILTERS
        {activeCount > 0 && (
          <span className="tnum ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan px-1.5 text-[0.6875rem] font-bold text-void">
            {activeCount}
          </span>
        )}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-void/80 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Product filters"
            className="glass-strong absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <p className="font-display text-sm font-semibold text-chrome">Filters</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-silver hover:bg-white/5 hover:text-chrome"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <FilterPanel {...props} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-[var(--color-line)] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-b from-cyan to-sky text-sm font-semibold tracking-wide text-void"
              >
                SHOW {props.total} {props.total === 1 ? "RESULT" : "RESULTS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

function FilterPanel({
  query,
  facets,
  basePath,
  total,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const go = React.useCallback(
    (next: ProductQuery) => {
      startTransition(() => {
        router.push(queryHref(basePath, next), { scroll: false });
      });
      onNavigate?.();
    },
    [basePath, onNavigate, router],
  );

  const keys = visibleFacetKeys(query, facets);
  const activeCount = countActiveFilters(query);

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ash">
          Refine
          {pending && <Spinner className="h-3 w-3 text-cyan" />}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => go(clearedQuery(query))}
            className="text-xs font-medium text-cyan transition-opacity hover:opacity-80"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* --- Availability ------------------------------------------------ */}
      <FilterSection title="Availability" defaultOpen>
        <CheckRow
          checked={!!query.inStockOnly}
          count={facets.availability.inStock}
          label="In stock only"
          onChange={() => go(withFilter(query, { inStockOnly: !query.inStockOnly }))}
        />
        {facets.availability.outOfStock > 0 && (
          <p className="tnum px-1 pt-1 text-[0.6875rem] text-ash">
            {facets.availability.outOfStock} currently out of stock
          </p>
        )}
      </FilterSection>

      {/* --- Price -------------------------------------------------------- */}
      <FilterSection title="Price" defaultOpen>
        <PriceFilter query={query} facets={facets} onApply={go} />
      </FilterSection>

      {/* --- Rating ------------------------------------------------------- */}
      {facets.rating.length > 0 && (
        <FilterSection title="Customer Rating">
          <div className="flex flex-col gap-0.5">
            {facets.rating.map((bucket) => {
              const value = Number(bucket.value);
              const checked = query.minRating === value;
              return (
                <CheckRow
                  key={bucket.value}
                  checked={checked}
                  count={bucket.count}
                  label={bucket.label}
                  onChange={() =>
                    go(withFilter(query, { minRating: checked ? null : value }))
                  }
                />
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* --- Facet lists -------------------------------------------------- */}
      {keys.map((key) => (
        <FilterSection
          key={key}
          title={FACET_DEFS[key].label}
          defaultOpen={facetValues(query, key).length > 0 || key === "brand" || key === "kind"}
        >
          <BucketList
            buckets={facets.buckets[key]}
            selected={facetValues(query, key)}
            searchable={facets.buckets[key].length > 12}
            searchLabel={`Search ${FACET_DEFS[key].label.toLowerCase()}`}
            onToggle={(value) => go(toggleFacet(query, key, value))}
          />
        </FilterSection>
      ))}

      {/* --- Lighting ----------------------------------------------------- */}
      {facets.rgb.yes > 0 && facets.rgb.no > 0 && (
        <FilterSection title="Lighting">
          <CheckRow
            checked={query.rgb === true}
            count={facets.rgb.yes}
            label="RGB lighting"
            onChange={() => go(withFilter(query, { rgb: query.rgb === true ? null : true }))}
          />
          <CheckRow
            checked={query.rgb === false}
            count={facets.rgb.no}
            label="No RGB"
            onChange={() => go(withFilter(query, { rgb: query.rgb === false ? null : false }))}
          />
        </FilterSection>
      )}

      <p className="tnum mt-3 border-t border-[var(--color-line)] pt-3 text-xs text-ash">
        {total} {total === 1 ? "product" : "products"} match
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function FilterSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-[var(--color-line)] py-3 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-chrome marker:hidden">
        {title}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-ash transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

function CheckRow({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5",
        "transition-colors hover:bg-white/[0.04]",
        count === 0 && "opacity-45",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-cyan)]",
          checked ? "border-cyan bg-cyan text-void" : "border-line-strong",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-silver">{label}</span>
      {count !== undefined && (
        <span className="tnum shrink-0 font-mono text-[0.6875rem] text-ash">{count}</span>
      )}
    </label>
  );
}

const COLLAPSED_BUCKETS = 8;

function BucketList({
  buckets,
  selected,
  searchable,
  searchLabel,
  onToggle,
}: {
  buckets: FacetBucket[];
  selected: string[];
  searchable: boolean;
  searchLabel: string;
  onToggle: (value: string) => void;
}) {
  const [term, setTerm] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  const filtered = term
    ? buckets.filter((bucket) => bucket.label.toLowerCase().includes(term.toLowerCase()))
    : buckets;

  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_BUCKETS);
  const hidden = filtered.length - visible.length;

  return (
    <div className="flex flex-col gap-0.5">
      {searchable && (
        <div className="relative mb-1.5">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ash"
            aria-hidden="true"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label={searchLabel}
            placeholder={searchLabel}
            className="h-9 w-full rounded-lg border border-[var(--color-line)] bg-void/60 pl-8 pr-2 text-xs text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none"
          />
        </div>
      )}

      {visible.map((bucket) => (
        <CheckRow
          key={bucket.value}
          checked={selected.includes(bucket.value)}
          label={bucket.label}
          count={bucket.count}
          onChange={() => onToggle(bucket.value)}
        />
      ))}

      {!filtered.length && (
        <p className="px-1 py-1 text-xs text-ash">No matches.</p>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 self-start px-1 text-xs font-medium text-cyan transition-opacity hover:opacity-80"
        >
          Show {hidden} more
        </button>
      )}
      {expanded && filtered.length > COLLAPSED_BUCKETS && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 self-start px-1 text-xs font-medium text-ash transition-colors hover:text-silver"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function PriceFilter({
  query,
  facets,
  onApply,
}: {
  query: ProductQuery;
  facets: Facets;
  onApply: (next: ProductQuery) => void;
}) {
  const [min, setMin] = React.useState(query.minPrice?.toString() ?? "");
  const [max, setMax] = React.useState(query.maxPrice?.toString() ?? "");

  // Re-sync when navigation changes the URL (back button, chip removal).
  React.useEffect(() => {
    setMin(query.minPrice?.toString() ?? "");
  }, [query.minPrice]);
  React.useEffect(() => {
    setMax(query.maxPrice?.toString() ?? "");
  }, [query.maxPrice]);

  const bounds = facets.price;
  const hasRange = bounds.max > bounds.min;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const lo = min.trim() === "" ? null : Math.max(0, Number.parseInt(min, 10) || 0);
    const hi = max.trim() === "" ? null : Math.max(0, Number.parseInt(max, 10) || 0);
    onApply(
      withFilter(query, {
        minPrice: lo !== null && hi !== null ? Math.min(lo, hi) : lo,
        maxPrice: lo !== null && hi !== null ? Math.max(lo, hi) : hi,
      }),
    );
  };

  // Four bands across the real price spread of the current result set.
  const bands = React.useMemo(() => {
    if (!hasRange) return [];
    const step = Math.round((bounds.max - bounds.min) / 4);
    if (step <= 0) return [];
    return [0, 1, 2, 3].map((i) => ({
      min: bounds.min + step * i,
      max: i === 3 ? null : bounds.min + step * (i + 1),
    }));
  }, [bounds.min, bounds.max, hasRange]);

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      {hasRange && (
        <p className="tnum font-mono text-[0.6875rem] text-ash">
          {formatPKR(bounds.min)} – {formatPKR(bounds.max)}
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={min}
          onChange={(event) => setMin(event.target.value)}
          aria-label="Minimum price in rupees"
          placeholder={hasRange ? String(bounds.min) : "Min"}
          className="tnum h-9 w-full rounded-lg border border-[var(--color-line)] bg-void/60 px-2.5 font-mono text-xs text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none"
        />
        <span className="text-ash" aria-hidden="true">
          –
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={max}
          onChange={(event) => setMax(event.target.value)}
          aria-label="Maximum price in rupees"
          placeholder={hasRange ? String(bounds.max) : "Max"}
          className="tnum h-9 w-full rounded-lg border border-[var(--color-line)] bg-void/60 px-2.5 font-mono text-xs text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none"
        />
        <button
          type="submit"
          className="metal h-9 shrink-0 rounded-lg px-3 text-xs font-semibold text-chrome transition-colors hover:text-white"
        >
          GO
        </button>
      </div>

      {bands.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bands.map((band) => (
            <button
              key={`${band.min}-${band.max ?? "up"}`}
              type="button"
              onClick={() =>
                onApply(withFilter(query, { minPrice: band.min, maxPrice: band.max }))
              }
              className="tnum rounded-full border border-line-strong px-2.5 py-1 font-mono text-[0.6875rem] text-silver transition-colors hover:border-cyan/50 hover:text-chrome"
            >
              {formatShortPKR(band.min)}
              {band.max ? `–${formatShortPKR(band.max)}` : "+"}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Active chips                                                               */
/* -------------------------------------------------------------------------- */

/** Removable pills above the grid, mirroring what the sidebar has applied. */
export function ActiveFilterChips({
  query,
  basePath,
  facets,
  className,
}: {
  query: ProductQuery;
  basePath: string;
  /** Supplies display names for values the URL only holds as slugs. */
  facets?: Facets;
  className?: string;
}) {
  const chips = activeFilterChips(query, facets);
  if (!chips.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={queryHref(basePath, chip.next)}
          scroll={false}
          className="group inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/[0.03] py-1 pl-3 pr-2 text-xs text-silver transition-colors hover:border-rose/50 hover:text-chrome"
        >
          {chip.label}
          <X
            className="h-3 w-3 text-ash transition-colors group-hover:text-rose"
            aria-hidden="true"
          />
          <span className="sr-only">Remove filter</span>
        </Link>
      ))}
      <Link
        href={queryHref(basePath, clearedQuery(query))}
        scroll={false}
        className="text-xs font-medium text-cyan transition-opacity hover:opacity-80"
      >
        Clear all
      </Link>
    </div>
  );
}

/** Small summary line used above the grid. */
export function ResultCount({
  total,
  page,
  perPage,
}: {
  total: number;
  page: number;
  perPage: number;
}) {
  if (total === 0) return <p className="text-sm text-ash">No products</p>;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <p className="tnum text-sm text-ash">
      Showing <span className="font-medium text-silver">{from}</span>–
      <span className="font-medium text-silver">{to}</span> of{" "}
      <span className="font-medium text-silver">{total}</span>
    </p>
  );
}
