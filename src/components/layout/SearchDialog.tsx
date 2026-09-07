"use client";

/**
 * Site search — the ⌘K / Ctrl-K palette.
 *
 * Mounted once by the store layout. Every trigger on the site (the header
 * icon, the mobile sheet) calls `openSearch()` rather than owning its own copy,
 * so there is exactly one dialog, one keyboard listener and one debounce timer
 * however many buttons point at it.
 *
 * Open state lives in a module-level store read through `useSyncExternalStore`
 * instead of React context: a trigger can then sit anywhere in the tree —
 * including inside another portal — without the layout having to wrap it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Clock,
  CornerDownLeft,
  ImageOff,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import type { ProductCardData } from "@/lib/filters";
import { cn, effectivePrice, formatPKR } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Wire format                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The `GET /api/search` payload.
 *
 * Declared here rather than in the route handler so the route can `import type`
 * it (a type-only import is erased, so the client module never reaches the
 * server bundle) and the two halves cannot drift.
 */
export type SearchSuggestion = {
  /** Human sentence describing what the filtered listing will show. */
  label: string;
  href: string;
  /** The filters the intent parser recognised, for the chips under the label. */
  chips: string[];
};

export type SearchGroup = {
  kind: string;
  label: string;
  items: ProductCardData[];
};

export type SearchResponse = {
  query: string;
  /** Number of products behind `allHref` — always the two agree. */
  total: number;
  /** Where "see all results" goes: the filtered listing when the query carried
   *  an intent, otherwise the plain text search. */
  allHref: string;
  groups: SearchGroup[];
  suggestion: SearchSuggestion | null;
};

/* -------------------------------------------------------------------------- */
/* Open-state store                                                           */
/* -------------------------------------------------------------------------- */

let dialogOpen = false;
const openListeners = new Set<() => void>();

function setDialogOpen(next: boolean) {
  if (dialogOpen === next) return;
  dialogOpen = next;
  for (const listener of openListeners) listener();
}

export function openSearch() {
  setDialogOpen(true);
}

export function closeSearch() {
  setDialogOpen(false);
}

function subscribeOpen(listener: () => void) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function useSearchOpen(): boolean {
  return React.useSyncExternalStore(
    subscribeOpen,
    () => dialogOpen,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */
/* Recent searches                                                            */
/* -------------------------------------------------------------------------- */

const RECENT_KEY = "yalman:recent-searches:v1";
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    // Private mode, disabled storage or corrupt JSON — search still works.
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* Nothing to do; the list is a convenience, not state anything depends on. */
  }
}

/* -------------------------------------------------------------------------- */
/* Trigger                                                                    */
/* -------------------------------------------------------------------------- */

/** The header's search affordance. Shows the shortcut where there is room. */
export function SearchTrigger({
  className,
  showShortcut = false,
}: {
  className?: string;
  showShortcut?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search products"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-line-strong bg-white/[0.03]",
        "px-3 py-2 text-sm text-silver transition-all duration-200",
        "hover:border-cyan/50 hover:bg-cyan/5 hover:text-chrome hover:shadow-glow-xs",
        className,
      )}
    >
      <Search size={18} aria-hidden="true" />
      {/* The label and shortcut only appear where the header has room for them
          — below 2xl the icon alone has to share the row with the nav. */}
      {showShortcut && (
        <>
          <span className="hidden 2xl:inline">Search</span>
          <kbd className="hidden rounded border border-line-strong bg-white/5 px-1.5 py-0.5 font-mono text-[0.625rem] text-ash 2xl:inline">
            ⌘K
          </kbd>
        </>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog                                                                     */
/* -------------------------------------------------------------------------- */

type NavRow =
  | { kind: "href"; key: string; href: string; label: string }
  | { kind: "term"; key: string; term: string };

const DEBOUNCE_MS = 220;
const MIN_QUERY = 2;

/** Shown before anyone types — the routes people actually came for. */
const QUICK_LINKS: { label: string; href: string }[] = [
  { label: "Gaming PCs", href: "/shop/gaming-pcs" },
  { label: "Graphics Cards", href: "/shop/graphics-cards" },
  { label: "Processors", href: "/shop/processors" },
  { label: "Gaming Monitors", href: "/shop/monitors" },
  { label: "Deals", href: "/deals" },
  { label: "Custom PC Builder", href: "/builder" },
];

export function SearchDialog() {
  const open = useSearchOpen();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  /* The shortcut listener lives on the always-mounted shell rather than inside
     the panel, so ⌘K works from any page without the dialog being rendered. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setDialogOpen(!dialogOpen);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!mounted || !open) return null;
  return createPortal(<SearchPanel />, document.body);
}

function SearchPanel() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY;

  /* --- Mount: focus, scroll lock, recent list ---------------------------- */
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    setRecent(readRecent());
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      // Returning focus matters most for keyboard users who opened with ⌘K.
      previouslyFocused?.focus?.();
    };
  }, []);

  /* --- Escape + focus trap ----------------------------------------------- */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* --- Debounced fetch ---------------------------------------------------- */
  React.useEffect(() => {
    if (!searching) {
      setData(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    setFailed(false);

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const payload = (await response.json()) as SearchResponse;
        setData(payload);
        setActive(0);
      } catch (error) {
        // An aborted request is the expected outcome of typing another letter,
        // not a failure worth telling anyone about.
        if ((error as Error).name === "AbortError") return;
        setFailed(true);
        setData(null);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, searching]);

  /* --- Navigable rows ----------------------------------------------------- */
  const rows = React.useMemo<NavRow[]>(() => {
    if (!searching) {
      return [
        ...recent.map<NavRow>((term) => ({
          kind: "term",
          key: `recent:${term}`,
          term,
        })),
        ...QUICK_LINKS.map<NavRow>((link) => ({
          kind: "href",
          key: `quick:${link.href}`,
          href: link.href,
          label: link.label,
        })),
      ];
    }

    const list: NavRow[] = [];
    if (data?.suggestion) {
      list.push({
        kind: "href",
        key: "suggestion",
        href: data.suggestion.href,
        label: data.suggestion.label,
      });
    }
    for (const group of data?.groups ?? []) {
      for (const item of group.items) {
        list.push({
          kind: "href",
          key: `p:${item.id}`,
          href: `/product/${item.slug}`,
          label: item.name,
        });
      }
    }
    // Always offer the full listing as the last stop.
    if (data && data.total > 0) {
      list.push({
        kind: "href",
        key: "all",
        href: data.allHref,
        label: `See all ${data.total} results`,
      });
    }
    return list;
  }, [searching, recent, data]);

  const indexOf = React.useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.key, index));
    return map;
  }, [rows]);

  React.useEffect(() => {
    // Clamp rather than reset: shrinking results should not throw the cursor
    // back to the top while someone is still arrowing down.
    setActive((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  /* Keep the highlighted row in view when arrowing past the fold. */
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const remember = React.useCallback((term: string) => {
    const clean = term.trim();
    if (clean.length < MIN_QUERY) return;
    setRecent((current) => {
      const next = [clean, ...current.filter((v) => v !== clean)].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  const select = React.useCallback(
    (row: NavRow) => {
      if (row.kind === "term") {
        setQuery(row.term);
        inputRef.current?.focus();
        return;
      }
      remember(trimmed);
      closeSearch();
      router.push(row.href);
    },
    [remember, router, trimmed],
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (rows.length ? (current + 1) % rows.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        rows.length ? (current - 1 + rows.length) % rows.length : 0,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) {
        select(row);
        return;
      }
      // Nothing highlighted (no hits yet) — fall through to the full listing.
      if (searching) {
        remember(trimmed);
        closeSearch();
        router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const hasResults = (data?.groups.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={closeSearch}
        className="absolute inset-0 bg-void/85 backdrop-blur-sm"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Yalman Gaming"
        className="glass-strong relative flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-lift"
      >
        {/* --- Input --------------------------------------------------- */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={18} className="shrink-0 text-ash" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search products, or try “gaming pc under 300k”"
            aria-label="Search products"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-base text-chrome outline-none",
              "placeholder:text-ash",
              // Safari draws its own clear button on type=search; ours is next to it.
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="rounded-lg p-1.5 text-ash transition-colors hover:bg-white/5 hover:text-chrome"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          <kbd className="hidden rounded border border-line-strong bg-white/5 px-1.5 py-0.5 font-mono text-[0.625rem] text-ash sm:inline">
            ESC
          </kbd>
        </div>

        {/* --- Results ------------------------------------------------- */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {!searching && (
            <>
              {recent.length > 0 && (
                <section aria-label="Recent searches">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="eyebrow">Recent</p>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-ash transition-colors hover:text-chrome"
                    >
                      Clear
                    </button>
                  </div>
                  <ul>
                    {recent.map((term) => {
                      const key = `recent:${term}`;
                      const index = indexOf.get(key) ?? -1;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            data-active={index === active}
                            onMouseMove={() => setActive(index)}
                            onClick={() => select({ kind: "term", key, term })}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                              "text-silver transition-colors",
                              index === active
                                ? "bg-white/[0.06] text-chrome"
                                : "hover:bg-white/[0.04] hover:text-chrome",
                            )}
                          >
                            <Clock size={14} className="shrink-0 text-ash" aria-hidden="true" />
                            <span className="truncate">{term}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section aria-label="Browse">
                <p className="eyebrow px-3 py-2">Browse</p>
                <ul className="grid gap-0.5 sm:grid-cols-2">
                  {QUICK_LINKS.map((link) => {
                    const key = `quick:${link.href}`;
                    const index = indexOf.get(key) ?? -1;
                    return (
                      <li key={key}>
                        <Link
                          href={link.href}
                          data-active={index === active}
                          onMouseMove={() => setActive(index)}
                          onClick={closeSearch}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm",
                            "text-silver transition-colors",
                            index === active
                              ? "bg-white/[0.06] text-chrome"
                              : "hover:bg-white/[0.04] hover:text-chrome",
                          )}
                        >
                          {link.label}
                          <ArrowRight size={14} className="text-ash" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          {searching && loading && !data && <ResultsSkeleton />}

          {searching && failed && (
            <p className="px-3 py-10 text-center text-sm text-silver">
              Search is unavailable right now.{" "}
              <Link
                href="/shop"
                onClick={closeSearch}
                className="font-semibold text-cyan underline-offset-4 hover:underline"
              >
                Browse the shop instead
              </Link>
              .
            </p>
          )}

          {searching && data && (
            <>
              {data.suggestion && (
                <SuggestionRow
                  suggestion={data.suggestion}
                  active={indexOf.get("suggestion") === active}
                  onMouseMove={() => setActive(indexOf.get("suggestion") ?? 0)}
                  onSelect={() => {
                    remember(trimmed);
                    closeSearch();
                  }}
                />
              )}

              {data.groups.map((group) => (
                <section key={group.kind} aria-label={group.label}>
                  <p className="eyebrow px-3 pb-1 pt-3">{group.label}</p>
                  <ul>
                    {group.items.map((item) => {
                      const key = `p:${item.id}`;
                      const index = indexOf.get(key) ?? -1;
                      return (
                        <li key={key}>
                          <ProductRow
                            product={item}
                            active={index === active}
                            onMouseMove={() => setActive(index)}
                            onSelect={() => {
                              remember(trimmed);
                              closeSearch();
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {!hasResults && !data.suggestion && !loading && (
                <div className="px-3 py-10 text-center">
                  <p className="font-display text-base font-semibold text-chrome">
                    No products match “{data.query}”
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm text-silver">
                    Try a shorter term, a brand name, or tell us what you are
                    after and we will spec it with you.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link
                      href="/shop"
                      onClick={closeSearch}
                      className="inline-flex h-9 items-center rounded-xl border border-line-strong px-4 text-xs font-semibold text-chrome transition-colors hover:border-cyan/50"
                    >
                      Browse everything
                    </Link>
                    <Link
                      href="/builder"
                      onClick={closeSearch}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan to-sky px-4 text-xs font-bold tracking-wide text-void shadow-glow-sm transition-all hover:brightness-110"
                    >
                      <Wrench size={13} aria-hidden="true" />
                      BUILD YOUR PC
                    </Link>
                  </div>
                </div>
              )}

              {data.total > 0 && (
                <Link
                  href={data.allHref}
                  data-active={indexOf.get("all") === active}
                  onMouseMove={() => setActive(indexOf.get("all") ?? 0)}
                  onClick={() => {
                    remember(trimmed);
                    closeSearch();
                  }}
                  className={cn(
                    "mt-2 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5",
                    "text-sm font-medium text-silver transition-colors",
                    indexOf.get("all") === active
                      ? "bg-white/[0.06] text-chrome"
                      : "hover:bg-white/[0.04] hover:text-chrome",
                  )}
                >
                  See all {data.total} result{data.total === 1 ? "" : "s"}
                  <ArrowRight size={14} className="text-cyan" aria-hidden="true" />
                </Link>
              )}
            </>
          )}
        </div>

        {/* --- Footer hints -------------------------------------------- */}
        <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5">
          <p className="hidden items-center gap-3 font-mono text-[0.625rem] uppercase tracking-wider text-ash sm:flex">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line-strong bg-white/5 px-1">↑</kbd>
              <kbd className="rounded border border-line-strong bg-white/5 px-1">↓</kbd>
              move
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line-strong bg-white/5 px-1">
                <CornerDownLeft size={9} aria-hidden="true" />
              </kbd>
              open
            </span>
          </p>
          <Link
            href="/builder"
            onClick={closeSearch}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan transition-opacity hover:opacity-80"
          >
            <Wrench size={13} aria-hidden="true" />
            Build a custom PC instead
          </Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

function SuggestionRow({
  suggestion,
  active,
  onMouseMove,
  onSelect,
}: {
  suggestion: SearchSuggestion;
  active: boolean;
  onMouseMove: () => void;
  onSelect: () => void;
}) {
  return (
    <Link
      href={suggestion.href}
      data-active={active}
      onMouseMove={onMouseMove}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-3",
        "transition-colors",
        active ? "border-cyan/50 bg-cyan/10" : "hover:border-cyan/40 hover:bg-cyan/10",
      )}
    >
      <SlidersHorizontal size={16} className="shrink-0 text-cyan" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-chrome">
          {suggestion.label}
        </span>
        {suggestion.chips.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {suggestion.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-cyan"
              >
                {chip}
              </span>
            ))}
          </span>
        )}
      </span>
      <ArrowRight size={14} className="shrink-0 text-cyan" aria-hidden="true" />
    </Link>
  );
}

function ProductRow({
  product,
  active,
  onMouseMove,
  onSelect,
}: {
  product: ProductCardData;
  active: boolean;
  onMouseMove: () => void;
  onSelect: () => void;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      data-active={active}
      onMouseMove={onMouseMove}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
      )}
    >
      <Thumb src={product.imageUrl} alt={product.imageAlt ?? product.name} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-chrome">
          {product.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ash">
          {[product.brandName, product.keySpec].filter(Boolean).join(" · ") ||
            "—"}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="tnum block font-mono text-sm font-semibold text-chrome">
          {formatPKR(effectivePrice(product))}
        </span>
        {product.samplePrice && (
          <span
            className="block font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
            title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
          >
            sample
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Catalogue art is transparent line art on a 400×300 canvas, so it is contained
 * with padding rather than cropped like a photograph.
 */
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = React.useState(false);

  if (!src || failed) {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-carbon text-ash">
        <ImageOff size={14} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-carbon p-1">
      {/* A plain <img>: `next/image` is configured with an empty
          `remotePatterns`, and this avoids per-row optimiser requests for
          40px thumbnails that are already vector art. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-1 p-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="skeleton h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-2/3 rounded" />
            <div className="skeleton h-2.5 w-1/3 rounded" />
          </div>
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export default SearchDialog;
