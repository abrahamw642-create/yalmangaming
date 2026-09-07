"use client";

/**
 * Cart state for the whole storefront.
 *
 * The cart is deliberately client-owned and stored in `localStorage`: a
 * visitor can browse, configure a machine and fill a cart without an account
 * or a cookie being written. Nothing here is authoritative — prices, stock and
 * compatibility are all re-derived on the server before an order is accepted.
 *
 * SSR safety: storage is only ever touched inside effects, so the server and
 * the first client render agree on an empty cart and hydration never mismatches.
 * `hydrated` tells the UI when the real cart has landed.
 */

import * as React from "react";
import type { BuildState, CompatibilityReport } from "@/lib/types";
import {
  CART_STORAGE_KEY,
  addLine,
  cartCount,
  cartSubtotal,
  cartTotals,
  lineFromBuild,
  lineFromProduct,
  parsePersistedCart,
  removeLine,
  toOrderLines,
  updateLineQty,
  type AppliedCoupon,
  type CartLine,
  type CartProductInput,
  type CartTotals,
  type PersistedCart,
} from "@/lib/cart";

export type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  /** Subtotal, coupon discount, delivery estimate and the resulting total. */
  totals: CartTotals;
  coupon: AppliedCoupon | null;
  /** False until the persisted cart has been read — render a skeleton, not "empty". */
  hydrated: boolean;
  open: boolean;
  setOpen: (next: boolean) => void;
  addProduct: (product: CartProductInput, quantity?: number) => void;
  addBuild: (build: BuildState, report: CompatibilityReport) => void;
  updateQty: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  setCoupon: (coupon: AppliedCoupon | null) => void;
};

const CartContext = React.createContext<CartContextValue | null>(null);

/** Minimum gap between server revalidations, so opening the drawer repeatedly is free. */
const REVALIDATE_INTERVAL_MS = 30_000;

/** The response shape of `POST /api/cart`. */
type RevalidatedLine = {
  id: string;
  status: "ok" | "insufficient-stock" | "out-of-stock" | "unavailable";
  name?: string;
  unitPrice?: number;
  listPrice?: number | null;
  stock?: number;
  samplePrice?: boolean;
  imageUrl?: string | null;
  compatibilityStatus?: "ok" | "warning" | "error";
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartLine[]>([]);
  const [coupon, setCouponState] = React.useState<AppliedCoupon | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // The exact string last persisted. Comparing against it stops two open tabs
  // from bouncing identical writes off each other via the `storage` event.
  const lastWritten = React.useRef<string | null>(null);
  const lastRevalidated = React.useRef(0);

  /* --- Hydrate ----------------------------------------------------------- */
  React.useEffect(() => {
    const stored = safeRead();
    setItems(stored.items);
    setCouponState(stored.coupon);
    setHydrated(true);
  }, []);

  /* --- Persist ----------------------------------------------------------- */
  React.useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedCart = { v: 1, items, coupon };
    const serialized = JSON.stringify(payload);
    if (serialized === lastWritten.current) return;
    lastWritten.current = serialized;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, serialized);
    } catch {
      // Private browsing or a full quota — the cart still works for this page
      // view, it just will not survive a reload.
    }
  }, [items, coupon, hydrated]);

  /* --- Follow the cart in other tabs -------------------------------------- */
  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== CART_STORAGE_KEY) return;
      if (event.newValue === lastWritten.current) return;
      lastWritten.current = event.newValue;
      const next = parsePersistedCart(event.newValue);
      setItems(next.items);
      setCouponState(next.coupon);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* --- Refresh prices and stock from the server --------------------------- */
  const revalidate = React.useCallback(async (current: CartLine[]) => {
    if (current.length === 0) return;
    const now = Date.now();
    if (now - lastRevalidated.current < REVALIDATE_INTERVAL_MS) return;
    lastRevalidated.current = now;

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: toOrderLines(current) }),
      });
      if (!response.ok) return;

      const data = (await response.json()) as { lines?: RevalidatedLine[] };
      if (!Array.isArray(data.lines)) return;
      const byId = new Map(data.lines.map((line) => [line.id, line]));

      setItems((previous) =>
        previous
          // A line the server no longer recognises has been pulled from the
          // catalog; silently keeping it would only fail at checkout.
          .filter((line) => byId.get(line.id)?.status !== "unavailable")
          .map((line) => {
            const fresh = byId.get(line.id);
            if (!fresh) return line;

            const unitPrice = fresh.unitPrice ?? line.unitPrice;
            // The server is only sent identifiers, so it cannot know what the
            // customer was quoted — the comparison belongs here.
            const moved = unitPrice !== line.unitPrice;

            return {
              ...line,
              name: fresh.name ?? line.name,
              unitPrice,
              listPrice: fresh.listPrice ?? line.listPrice,
              stock: fresh.stock ?? line.stock,
              samplePrice: fresh.samplePrice ?? line.samplePrice,
              imageUrl: fresh.imageUrl ?? line.imageUrl,
              priceChanged: moved || line.priceChanged,
              meta:
                line.meta && fresh.compatibilityStatus
                  ? {
                      ...line.meta,
                      compatibility: {
                        ...line.meta.compatibility,
                        status: fresh.compatibilityStatus,
                      },
                    }
                  : line.meta,
            };
          }),
      );
    } catch {
      // Offline or the API is down — the cart keeps its last known figures and
      // the order endpoint will price it properly anyway.
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    void revalidate(items);
    // Runs on hydration only; opening the drawer triggers the other pass below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  React.useEffect(() => {
    if (open) void revalidate(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* --- Mutations ---------------------------------------------------------- */
  const addProduct = React.useCallback(
    (product: CartProductInput, quantity = 1) => {
      setItems((previous) => addLine(previous, lineFromProduct(product, quantity)));
      setOpen(true);
    },
    [],
  );

  const addBuild = React.useCallback(
    (build: BuildState, report: CompatibilityReport) => {
      setItems((previous) => addLine(previous, lineFromBuild(build, report)));
      setOpen(true);
    },
    [],
  );

  const updateQty = React.useCallback((lineId: string, quantity: number) => {
    setItems((previous) => updateLineQty(previous, lineId, quantity));
  }, []);

  const remove = React.useCallback((lineId: string) => {
    setItems((previous) => removeLine(previous, lineId));
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
    setCouponState(null);
  }, []);

  const setCoupon = React.useCallback((next: AppliedCoupon | null) => {
    setCouponState(next);
  }, []);

  const value = React.useMemo<CartContextValue>(
    () => ({
      items,
      count: cartCount(items),
      subtotal: cartSubtotal(items),
      totals: cartTotals(items, coupon),
      coupon,
      hydrated,
      open,
      setOpen,
      addProduct,
      addBuild,
      updateQty,
      remove,
      clear,
      setCoupon,
    }),
    [items, coupon, hydrated, open, addProduct, addBuild, updateQty, remove, clear, setCoupon],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>. Wrap the store layout in it.");
  }
  return context;
}

function safeRead(): PersistedCart {
  try {
    return parsePersistedCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return { v: 1, items: [], coupon: null };
  }
}
