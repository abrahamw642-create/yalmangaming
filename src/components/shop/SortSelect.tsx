"use client";

/**
 * Sort and page-size controls.
 *
 * Both write to the query string rather than to component state, so the order a
 * shopper chose survives a refresh and travels in a shared link. The page stays
 * a Server Component; only this control is interactive.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  PER_PAGE_OPTIONS,
  queryHref,
  withFilter,
  type ProductQuery,
} from "@/lib/filters";
import { SORT_OPTIONS, type SortOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SortSelect({
  query,
  basePath,
  showPerPage = true,
  className,
}: {
  query: ProductQuery;
  basePath: string;
  showPerPage?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const go = (next: ProductQuery) => {
    startTransition(() => {
      router.push(queryHref(basePath, next), { scroll: false });
    });
  };

  return (
    <div className={cn("flex items-center gap-2", pending && "opacity-70", className)}>
      <SelectShell label="Sort" id="sort-select">
        <select
          id="sort-select"
          value={query.sort ?? "featured"}
          onChange={(event) =>
            go(withFilter(query, { sort: event.target.value as SortOption }))
          }
          className="peer h-9 appearance-none rounded-lg bg-transparent py-0 pl-2.5 pr-7 text-xs font-medium text-chrome outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-graphite text-chrome">
              {option.label}
            </option>
          ))}
        </select>
      </SelectShell>

      {showPerPage && (
        <SelectShell label="Per page" id="per-page-select" className="hidden sm:flex">
          <select
            id="per-page-select"
            value={String(query.perPage ?? 24)}
            onChange={(event) =>
              go(withFilter(query, { perPage: Number(event.target.value) }))
            }
            className="peer h-9 appearance-none rounded-lg bg-transparent py-0 pl-2.5 pr-7 text-xs font-medium text-chrome outline-none"
          >
            {PER_PAGE_OPTIONS.map((size) => (
              <option key={size} value={size} className="bg-graphite text-chrome">
                {size} / page
              </option>
            ))}
          </select>
        </SelectShell>
      )}
    </div>
  );
}

function SelectShell({
  label,
  id,
  children,
  className,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="metal relative flex items-center rounded-lg">
        {children}
        <ChevronDown
          className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ash"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
