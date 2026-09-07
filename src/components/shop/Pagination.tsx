/**
 * Listing pagination. Real `<a>` links, not buttons: a page of results is a
 * URL, so it must be crawlable, middle-clickable and reachable without JS.
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { queryHref, type ProductQuery } from "@/lib/filters";
import { cn } from "@/lib/utils";

/**
 * Window of page numbers around the current one, with `null` marking an
 * ellipsis. Always shows the first and last page so the ends stay reachable.
 */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, pageCount, page]);
  for (const offset of [-1, 1]) {
    const candidate = page + offset;
    if (candidate > 1 && candidate < pageCount) pages.add(candidate);
  }
  // Keep the strip a constant width near the ends.
  if (page <= 3) [2, 3, 4].forEach((p) => p < pageCount && pages.add(p));
  if (page >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => p > 1 && pages.add(p));
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) out.push(null);
    out.push(value);
    previous = value;
  }
  return out;
}

export function Pagination({
  query,
  basePath,
  page,
  pageCount,
  className,
}: {
  query: ProductQuery;
  basePath: string;
  page: number;
  pageCount: number;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => queryHref(basePath, { ...query, page: target });
  const items = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      <PageLink
        href={href(page - 1)}
        disabled={page <= 1}
        label="Previous page"
        rel="prev"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </PageLink>

      {items.map((item, index) =>
        item === null ? (
          <span
            key={`gap-${index}`}
            className="px-1 text-sm text-ash"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <PageLink
            key={item}
            href={href(item)}
            current={item === page}
            label={`Page ${item}`}
          >
            <span className="tnum">{item}</span>
          </PageLink>
        ),
      )}

      <PageLink
        href={href(page + 1)}
        disabled={page >= pageCount}
        label="Next page"
        rel="next"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
  rel?: string;
}) {
  const base =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-all duration-200";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(base, "cursor-not-allowed border border-[var(--color-line)] text-ash opacity-40")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      scroll
      className={cn(
        base,
        current
          ? "border border-cyan/50 bg-cyan/10 text-cyan"
          : "border border-[var(--color-line)] text-silver hover:border-line-strong hover:text-chrome",
      )}
    >
      {children}
    </Link>
  );
}
