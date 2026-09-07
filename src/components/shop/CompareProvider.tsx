"use client";

/**
 * Client-side selection stores: the comparison tray and the wishlist.
 *
 * Both are module-level external stores read through `useSyncExternalStore`
 * rather than React context. Two reasons:
 *
 *  1. SSR safety — `localStorage` is never touched during render. The server
 *     snapshot is a frozen empty array, and hydration happens in `subscribe`,
 *     which React only ever calls in an effect on the client.
 *  2. No provider dependency — a `<ProductCard>` dropped anywhere on the site
 *     can join the comparison without the surrounding layout (owned by another
 *     area) having to wrap the tree. `CompareProvider` still exists for the
 *     layout to mount, but nothing breaks in its absence.
 */

import * as React from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { MAX_COMPARE } from "@/lib/filters";
import { cn } from "@/lib/utils";

const COMPARE_KEY = "yalman:compare:v1";
const WISHLIST_KEY = "yalman:wishlist:v1";

/* -------------------------------------------------------------------------- */
/* Tiny persisted id-set store                                                */
/* -------------------------------------------------------------------------- */

const EMPTY: readonly string[] = Object.freeze([]);

type IdStore = {
  get(): readonly string[];
  subscribe(listener: () => void): () => void;
  set(next: string[]): void;
};

function createIdStore(storageKey: string, max: number): IdStore {
  let value: readonly string[] = EMPTY;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const read = (): string[] => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v): v is string => typeof v === "string").slice(0, max);
    } catch {
      // Private mode, disabled storage or corrupt JSON — start clean rather
      // than taking the page down.
      return [];
    }
  };

  const write = (next: readonly string[]) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Storage full or blocked; the in-memory value still works this session. */
    }
  };

  return {
    get: () => value,
    subscribe(listener) {
      // First subscriber pulls from storage. `subscribe` runs inside an effect,
      // so this is always post-hydration and never during render.
      if (!hydrated) {
        hydrated = true;
        const stored = read();
        if (stored.length) value = Object.freeze(stored);
      }
      listeners.add(listener);

      // Keep two tabs of the same shop in step.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== storageKey) return;
        value = Object.freeze(read());
        emit();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    set(next) {
      const capped = Array.from(new Set(next)).slice(0, max);
      value = Object.freeze(capped);
      write(capped);
      emit();
    },
  };
}

const compareStore = createIdStore(COMPARE_KEY, MAX_COMPARE);
const wishlistStore = createIdStore(WISHLIST_KEY, 200);

function useIdStore(store: IdStore): readonly string[] {
  return React.useSyncExternalStore(
    store.subscribe,
    store.get,
    () => EMPTY,
  );
}

/* -------------------------------------------------------------------------- */
/* Compare                                                                    */
/* -------------------------------------------------------------------------- */

export type CompareApi = {
  ids: readonly string[];
  count: number;
  full: boolean;
  has(id: string): boolean;
  toggle(id: string): void;
  add(id: string): void;
  remove(id: string): void;
  clear(): void;
  max: number;
};

export function useCompare(): CompareApi {
  const ids = useIdStore(compareStore);

  return React.useMemo<CompareApi>(
    () => ({
      ids,
      count: ids.length,
      full: ids.length >= MAX_COMPARE,
      has: (id) => ids.includes(id),
      toggle: (id) =>
        compareStore.set(
          ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
        ),
      add: (id) => {
        if (!ids.includes(id)) compareStore.set([...ids, id]);
      },
      remove: (id) => compareStore.set(ids.filter((v) => v !== id)),
      clear: () => compareStore.set([]),
      max: MAX_COMPARE,
    }),
    [ids],
  );
}

/* -------------------------------------------------------------------------- */
/* Wishlist                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A saved-items list held in the browser. The `WishlistItem` table needs a
 * signed-in user; until someone signs in, saving locally is the honest thing to
 * do — nothing is claimed to be stored on Yalman's side.
 */
export function useWishlist() {
  const ids = useIdStore(wishlistStore);

  return React.useMemo(
    () => ({
      ids,
      count: ids.length,
      has: (id: string) => ids.includes(id),
      toggle: (id: string) =>
        wishlistStore.set(
          ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
        ),
      remove: (id: string) => wishlistStore.set(ids.filter((v) => v !== id)),
      clear: () => wishlistStore.set([]),
    }),
    [ids],
  );
}

/* -------------------------------------------------------------------------- */
/* Provider + tray                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Optional wrapper kept for the store layout. The stores work without it, so
 * this deliberately renders nothing of its own.
 */
export function CompareProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * The floating tray that appears once something is being compared. Mounted by
 * the listing and product pages rather than the layout, so there is exactly one
 * on screen regardless of what the layout does.
 */
export function CompareBar({ className }: { className?: string }) {
  const compare = useCompare();
  if (compare.count === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pt-2",
        "pointer-events-none",
        className,
      )}
    >
      <div className="glass-strong pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl px-4 py-3 shadow-lift">
        <Scale className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-silver">
          <span className="tnum font-semibold text-chrome">{compare.count}</span>
          <span className="tnum text-ash"> / {compare.max}</span>{" "}
          selected to compare
        </p>
        <button
          type="button"
          onClick={compare.clear}
          className="rounded-lg px-2 py-1 text-xs font-medium text-ash transition-colors hover:text-chrome"
        >
          Clear
        </button>
        <Link
          href="/compare"
          className="inline-flex h-9 items-center rounded-xl bg-gradient-to-b from-cyan to-sky px-4 text-xs font-semibold tracking-wide text-void transition-all hover:brightness-110"
        >
          COMPARE
        </Link>
      </div>
    </div>
  );
}
