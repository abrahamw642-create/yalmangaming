import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Money — every figure on this site is whole Pakistani Rupees                 */
/* -------------------------------------------------------------------------- */

/**
 * Grouping only — the currency label is added by hand.
 *
 * `style: "currency"` is deliberately NOT used: which symbol ICU emits for PKR
 * varies by build ("Rs", "PKR" and "₨" are all possible for en-PK), so the
 * same code rendered "Rs 300,000" locally and could render something else on
 * the server. Formatting the number and prefixing the label ourselves makes the
 * output identical everywhere.
 */
const pkrDigits = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** `PKR 249,000` */
export function formatPKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `PKR ${pkrDigits.format(amount)}`;
}

/** `249,000` — for places that render the currency label separately. */
export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    amount,
  );
}

/** `2.5L` / `250k` style short form for budget sliders and chips. */
export function formatShortPKR(amount: number): string {
  if (amount >= 100_000) {
    const lakhs = amount / 100_000;
    return `${lakhs % 1 === 0 ? lakhs : lakhs.toFixed(1)}L`;
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}

/** The price a customer actually pays. */
export function effectivePrice(p: {
  price: number;
  salePrice?: number | null;
}): number {
  return p.salePrice && p.salePrice > 0 && p.salePrice < p.price
    ? p.salePrice
    : p.price;
}

export function discountPercent(p: {
  price: number;
  salePrice?: number | null;
}): number | null {
  if (!p.salePrice || p.salePrice >= p.price) return null;
  return Math.round(((p.price - p.salePrice) / p.price) * 100);
}

/* -------------------------------------------------------------------------- */
/* Strings                                                                    */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function pluralize(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`);
}

/** Deterministic, URL-safe share code. Avoids look-alike characters. */
export function shareCode(length = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function orderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `YG-${stamp}-${shareCode(3)}`;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
