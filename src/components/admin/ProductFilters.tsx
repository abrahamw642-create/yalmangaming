"use client";

/**
 * Yalman Gaming admin — the product table's filter bar.
 *
 * Filters are URL state, not component state: every control writes into the
 * query string and the server page re-queries. That makes a filtered view
 * shareable, bookmarkable and survivable across a refresh — which matters when
 * the working list is "the 204 products that still show sample pricing".
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import {
  ADMIN_PRODUCT_SORTS,
  KIND_OPTIONS,
  PRODUCT_STATUSES,
} from "@/components/admin/schema";
import { Input, Select } from "@/components/admin/ui";
import type { NormalizedProductQuery } from "@/lib/admin-queries";

type Option = { id: string; label: string };

export function ProductFilters({
  query,
  brands,
  categories,
}: {
  query: NormalizedProductQuery;
  brands: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = React.useState(query.q ?? "");
  const [pending, startTransition] = React.useTransition();

  // The prop is the source of truth: navigating back, or clearing filters,
  // has to put the box back in step with the URL.
  React.useEffect(() => {
    setTerm(query.q ?? "");
  }, [query.q]);

  const navigate = React.useCallback(
    (changes: Partial<Record<string, string | null>>) => {
      const params = new URLSearchParams();
      const current: Record<string, string | null> = {
        q: query.q,
        kind: query.kind,
        status: query.status,
        brandId: query.brandId,
        categoryId: query.categoryId,
        flag: query.flag,
        sort: query.sort === "updated" ? null : query.sort,
      };

      for (const [key, value] of Object.entries({ ...current, ...changes })) {
        if (value) params.set(key, value);
      }
      // Any change to the filters invalidates the page number.
      const search = params.toString();
      startTransition(() => {
        router.push(search ? `${pathname}?${search}` : pathname);
      });
    },
    [pathname, query, router],
  );

  const hasFilters =
    Boolean(query.q) ||
    Boolean(query.kind) ||
    Boolean(query.status) ||
    Boolean(query.brandId) ||
    Boolean(query.categoryId) ||
    Boolean(query.flag) ||
    query.sort !== "updated";

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-line)] px-4 py-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ q: term.trim() || null });
        }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ash" />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search name, SKU, slug or brand"
            aria-label="Search products"
            className="pl-9"
          />
        </div>

        <Select
          value={query.kind ?? ""}
          onChange={(event) => navigate({ kind: event.target.value || null })}
          aria-label="Filter by product type"
          className="w-auto min-w-40"
        >
          <option value="">All types</option>
          {KIND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          value={query.status ?? ""}
          onChange={(event) => navigate({ status: event.target.value || null })}
          aria-label="Filter by status"
          className="w-auto min-w-32"
        >
          <option value="">Any status</option>
          {PRODUCT_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          value={query.brandId ?? ""}
          onChange={(event) => navigate({ brandId: event.target.value || null })}
          aria-label="Filter by brand"
          className="w-auto min-w-36"
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.label}
            </option>
          ))}
        </Select>

        <Select
          value={query.categoryId ?? ""}
          onChange={(event) => navigate({ categoryId: event.target.value || null })}
          aria-label="Filter by category"
          className="w-auto min-w-48"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>

        <Select
          value={query.sort}
          onChange={(event) => navigate({ sort: event.target.value })}
          aria-label="Sort products"
          className="w-auto min-w-44"
        >
          {ADMIN_PRODUCT_SORTS.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.label}
            </option>
          ))}
        </Select>

        {/* Submitting the form is what commits a typed search term. */}
        <button type="submit" className="sr-only">
          Apply search
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              startTransition(() => router.push(pathname));
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-line-strong)] px-3 text-xs text-silver transition-colors hover:border-rose/50 hover:text-rose"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}

        <span
          aria-live="polite"
          className="font-mono text-[0.6875rem] text-ash"
        >
          {pending ? "Filtering…" : ""}
        </span>
      </form>
    </div>
  );
}
