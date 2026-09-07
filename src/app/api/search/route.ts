/**
 * `GET /api/search?q=…`
 *
 * Powers the ⌘K palette. Two things happen to every query:
 *
 *  1. **Ranked product hits** — `searchProducts` from `@/lib/catalog`, which
 *     puts a name that *starts with* the term above one that merely contains it.
 *  2. **Intent parsing** — "gaming pc under 300k", "1440p 165hz monitor",
 *     "ddr5 motherboard", "rtx 5070" are how people actually search a hardware
 *     shop. The recognised parts are turned into a real filtered-listing URL
 *     returned alongside the hits, so one Enter lands on a filtered grid rather
 *     than a text search that would have missed half of it.
 *
 * The suggested URL is built with `serializeProductQuery`, so it is exactly the
 * URL the shop pages parse back — there is no second, private filter format.
 *
 * Read-only and unauthenticated, but the query is still bounded before it
 * reaches the database.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProducts, searchProducts } from "@/lib/catalog";
import {
  queryHref,
  type FacetKey,
  type ProductCardData,
  type ProductQuery,
} from "@/lib/filters";
import { KIND_META, isComponentKind, type ComponentKind } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import type {
  SearchGroup,
  SearchResponse,
  SearchSuggestion,
} from "@/components/layout/SearchDialog";

// Prices and stock move constantly; a cached search feed would lie.
export const dynamic = "force-dynamic";

const MAX_HITS = 8;
const MIN_QUERY = 2;

const querySchema = z.string().trim().min(0).max(120);

/* -------------------------------------------------------------------------- */
/* Kind ↔ category routing                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The category slug that best represents a component kind. These are the real
 * `Category.slug` values seeded in `prisma/data/categories.ts`, so a suggestion
 * always resolves to a page with its own heading and description.
 */
const KIND_CATEGORY_SLUG: Record<ComponentKind, string> = {
  prebuilt: "gaming-pcs",
  gpu: "graphics-cards",
  cpu: "processors",
  motherboard: "motherboards",
  ram: "memory",
  storage: "storage",
  cooler: "cooling",
  fan: "case-fans",
  psu: "power-supplies",
  case: "cases",
  os: "operating-systems",
  monitor: "monitors",
  keyboard: "keyboards",
  mouse: "mice",
  headset: "headsets",
  microphone: "microphones",
  webcam: "webcams",
  chair: "chairs",
  controller: "controllers",
  mousepad: "mousepads",
  speaker: "speakers",
};

/* -------------------------------------------------------------------------- */
/* Intent parsing                                                             */
/* -------------------------------------------------------------------------- */

type Intent = {
  kinds: ComponentKind[];
  minPrice: number | null;
  maxPrice: number | null;
  resolution: string | null;
  refreshRate: number | null;
  panelSizeIn: number | null;
  memoryType: string | null;
  vramGb: number | null;
  wattage: number | null;
  storageInterface: string | null;
  onDeal: boolean;
  inStockOnly: boolean;
  /** What is left after every recognised phrase is removed. */
  term: string;
  /** Short human labels for the chips under the suggestion. */
  chips: string[];
};

/**
 * Kind vocabulary, matched longest-phrase-first and removed as it matches, so
 * "mousepad" cannot also register as "mouse" and "gaming pc" is not read as a
 * bare "pc".
 */
const KIND_PHRASES: { phrase: string; kind: ComponentKind }[] = [
  { phrase: "gaming desktop", kind: "prebuilt" },
  { phrase: "prebuilt pc", kind: "prebuilt" },
  { phrase: "gaming pcs", kind: "prebuilt" },
  { phrase: "gaming pc", kind: "prebuilt" },
  { phrase: "desktop pc", kind: "prebuilt" },
  { phrase: "prebuilt", kind: "prebuilt" },

  { phrase: "graphics cards", kind: "gpu" },
  { phrase: "graphics card", kind: "gpu" },
  { phrase: "graphic card", kind: "gpu" },
  { phrase: "video card", kind: "gpu" },
  { phrase: "gpu", kind: "gpu" },

  { phrase: "processors", kind: "cpu" },
  { phrase: "processor", kind: "cpu" },
  { phrase: "cpu", kind: "cpu" },

  { phrase: "motherboards", kind: "motherboard" },
  { phrase: "motherboard", kind: "motherboard" },
  { phrase: "mainboard", kind: "motherboard" },
  { phrase: "mobo", kind: "motherboard" },

  { phrase: "power supplies", kind: "psu" },
  { phrase: "power supply", kind: "psu" },
  { phrase: "psu", kind: "psu" },
  { phrase: "smps", kind: "psu" },

  { phrase: "liquid cooler", kind: "cooler" },
  { phrase: "cpu cooler", kind: "cooler" },
  { phrase: "air cooler", kind: "cooler" },
  { phrase: "coolers", kind: "cooler" },
  { phrase: "cooler", kind: "cooler" },
  { phrase: "aio", kind: "cooler" },

  { phrase: "case fans", kind: "fan" },
  { phrase: "case fan", kind: "fan" },

  { phrase: "pc cases", kind: "case" },
  { phrase: "pc case", kind: "case" },
  { phrase: "cabinet", kind: "case" },
  { phrase: "chassis", kind: "case" },
  { phrase: "cases", kind: "case" },
  { phrase: "case", kind: "case" },

  { phrase: "hard drive", kind: "storage" },
  { phrase: "hard disk", kind: "storage" },
  { phrase: "storage", kind: "storage" },
  { phrase: "nvme", kind: "storage" },
  { phrase: "ssd", kind: "storage" },
  { phrase: "hdd", kind: "storage" },

  { phrase: "operating system", kind: "os" },
  { phrase: "windows", kind: "os" },

  { phrase: "monitors", kind: "monitor" },
  { phrase: "monitor", kind: "monitor" },
  { phrase: "display", kind: "monitor" },
  { phrase: "screen", kind: "monitor" },

  { phrase: "mousepads", kind: "mousepad" },
  { phrase: "mousepad", kind: "mousepad" },
  { phrase: "mouse pad", kind: "mousepad" },
  { phrase: "deskmat", kind: "mousepad" },

  { phrase: "keyboards", kind: "keyboard" },
  { phrase: "keyboard", kind: "keyboard" },

  { phrase: "headphones", kind: "headset" },
  { phrase: "headphone", kind: "headset" },
  { phrase: "headsets", kind: "headset" },
  { phrase: "headset", kind: "headset" },

  { phrase: "microphones", kind: "microphone" },
  { phrase: "microphone", kind: "microphone" },
  { phrase: "mic", kind: "microphone" },

  { phrase: "webcams", kind: "webcam" },
  { phrase: "webcam", kind: "webcam" },

  { phrase: "gaming chairs", kind: "chair" },
  { phrase: "gaming chair", kind: "chair" },
  { phrase: "chairs", kind: "chair" },
  { phrase: "chair", kind: "chair" },

  { phrase: "controllers", kind: "controller" },
  { phrase: "controller", kind: "controller" },
  { phrase: "gamepad", kind: "controller" },

  { phrase: "speakers", kind: "speaker" },
  { phrase: "speaker", kind: "speaker" },

  { phrase: "mice", kind: "mouse" },
  { phrase: "mouse", kind: "mouse" },

  { phrase: "memory", kind: "ram" },
  { phrase: "ram", kind: "ram" },
];

/** Resolution shorthand → the raw `Product.resolution` value it filters on. */
const RESOLUTION_PHRASES: { pattern: RegExp; value: string; chip: string }[] = [
  { pattern: /\b(?:ultrawide|uwqhd|3440\s*x\s*1440)\b/, value: "3440x1440", chip: "Ultrawide" },
  { pattern: /\b(?:4k|uhd|2160p|3840\s*x\s*2160)\b/, value: "3840x2160", chip: "4K" },
  { pattern: /\b(?:1440p|qhd|2k|2560\s*x\s*1440)\b/, value: "2560x1440", chip: "1440p" },
  { pattern: /\b(?:1080p|fhd|full\s*hd|1920\s*x\s*1080)\b/, value: "1920x1080", chip: "1080p" },
];

const STORAGE_PHRASES: { pattern: RegExp; value: string; chip: string }[] = [
  { pattern: /\b(?:gen\s*5|pcie\s*5(?:\.0)?)\b/, value: "nvme-gen5", chip: "PCIe 5.0" },
  { pattern: /\b(?:gen\s*4|pcie\s*4(?:\.0)?)\b/, value: "nvme-gen4", chip: "PCIe 4.0" },
  { pattern: /\b(?:gen\s*3|pcie\s*3(?:\.0)?)\b/, value: "nvme-gen3", chip: "PCIe 3.0" },
  { pattern: /\bsata\b/, value: "sata", chip: "SATA" },
];

/** Words that carry no filtering signal once the structured parts are out. */
const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "with", "of", "in", "on", "to", "at",
  "best", "top", "good", "cheap", "budget", "new", "show", "me", "find",
  "buy", "price", "prices", "pkr", "rs", "rupees", "please", "want", "need",
  "under", "below", "over", "above", "between", "upto", "max", "min", "less",
  "more", "than", "up",
]);

/** `300k` / `3 lakh` / `2.5 lac` / `300,000` → 300000. Returns null on nonsense. */
function parseAmount(digits: string, unit?: string): number | null {
  const base = Number.parseFloat(digits.replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;

  const suffix = unit?.toLowerCase();
  let value = base;
  if (suffix === "k") value = base * 1_000;
  else if (suffix === "lakh" || suffix === "lac" || suffix === "l") value = base * 100_000;
  else if (suffix === "m" || suffix === "million") value = base * 1_000_000;

  // A bare "3" almost certainly means lakhs in a Pakistani price context, but
  // guessing would be worse than ignoring it — only explicit units scale.
  const rounded = Math.round(value);
  return rounded >= 100 && rounded <= 100_000_000 ? rounded : null;
}

const AMOUNT = String.raw`([\d.,]+)\s*(k|lakh|lac|l|m|million)?`;
const CURRENCY = String.raw`(?:pkr|rs\.?)?\s*`;

const BETWEEN_RE = new RegExp(
  String.raw`\bbetween\s*${CURRENCY}${AMOUNT}\s*(?:-|–|to|and)\s*${CURRENCY}${AMOUNT}`,
  "i",
);
const UNDER_RE = new RegExp(
  String.raw`\b(?:under|below|less\s+than|up\s*to|upto|max(?:imum)?|within)\s*${CURRENCY}${AMOUNT}`,
  "i",
);
const OVER_RE = new RegExp(
  String.raw`\b(?:over|above|more\s+than|min(?:imum)?|starting\s+(?:at|from)|from)\s*${CURRENCY}${AMOUNT}`,
  "i",
);

/**
 * Not exported: a route module may only export HTTP handlers and Next's own
 * config fields, so this stays local.
 */
function parseSearchIntent(raw: string): Intent {
  let rest = ` ${raw.toLowerCase()} `;
  const chips: string[] = [];

  const strip = (match: string) => {
    rest = rest.replace(match.toLowerCase(), " ");
  };

  /* --- Price ------------------------------------------------------------- */
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  const between = rest.match(BETWEEN_RE);
  if (between) {
    const low = parseAmount(between[1], between[2]);
    const high = parseAmount(between[3], between[4]);
    if (low !== null && high !== null) {
      minPrice = Math.min(low, high);
      maxPrice = Math.max(low, high);
      chips.push(`${formatPKR(minPrice)} – ${formatPKR(maxPrice)}`);
      strip(between[0]);
    }
  }

  if (maxPrice === null) {
    const under = rest.match(UNDER_RE);
    if (under) {
      const value = parseAmount(under[1], under[2]);
      if (value !== null) {
        maxPrice = value;
        chips.push(`Under ${formatPKR(value)}`);
        strip(under[0]);
      }
    }
  }

  if (minPrice === null) {
    const over = rest.match(OVER_RE);
    if (over) {
      const value = parseAmount(over[1], over[2]);
      if (value !== null) {
        minPrice = value;
        chips.push(`Over ${formatPKR(value)}`);
        strip(over[0]);
      }
    }
  }

  /* --- Display specs ------------------------------------------------------ */
  let resolution: string | null = null;
  for (const entry of RESOLUTION_PHRASES) {
    const match = rest.match(entry.pattern);
    if (!match) continue;
    resolution = entry.value;
    chips.push(entry.chip);
    strip(match[0]);
    break;
  }

  let refreshRate: number | null = null;
  const hz = rest.match(/\b(\d{2,3})\s*hz\b/);
  if (hz) {
    const value = Number.parseInt(hz[1], 10);
    if (value >= 30 && value <= 600) {
      refreshRate = value;
      chips.push(`${value}Hz`);
      strip(hz[0]);
    }
  }

  let panelSizeIn: number | null = null;
  // No bare "in": "15 in stock" is not a 15-inch anything.
  const inches = rest.match(/\b(\d{2}(?:\.\d)?)\s*(?:inch|inches|")/);
  if (inches) {
    const value = Number.parseFloat(inches[1]);
    if (value >= 15 && value <= 60) {
      panelSizeIn = value;
      chips.push(`${value}″`);
      strip(inches[0]);
    }
  }

  /* --- Memory, VRAM, wattage, interface ----------------------------------- */
  let memoryType: string | null = null;
  const ddr = rest.match(/\bddr([45])\b/);
  if (ddr) {
    memoryType = `DDR${ddr[1]}`;
    chips.push(memoryType);
    strip(ddr[0]);
  }

  let vramGb: number | null = null;
  // Only an explicit "vram" turns a capacity into a VRAM filter — a bare
  // "16gb" is far more often a memory kit than a graphics card.
  const vram = rest.match(/\b(\d{1,2})\s*gb\s*(?:vram|video\s*memory)\b/) ??
    rest.match(/\bvram\s*(\d{1,2})\s*gb\b/);
  if (vram) {
    const value = Number.parseInt(vram[1], 10);
    if (value >= 1 && value <= 64) {
      vramGb = value;
      chips.push(`${value}GB VRAM`);
      strip(vram[0]);
    }
  }

  let wattage: number | null = null;
  const watts = rest.match(/\b(\d{3,4})\s*(?:w|watt|watts)\b/);
  if (watts) {
    const value = Number.parseInt(watts[1], 10);
    if (value >= 200 && value <= 2000) {
      wattage = value;
      chips.push(`${value}W`);
      strip(watts[0]);
    }
  }

  let storageInterface: string | null = null;
  for (const entry of STORAGE_PHRASES) {
    const match = rest.match(entry.pattern);
    if (!match) continue;
    storageInterface = entry.value;
    chips.push(entry.chip);
    strip(match[0]);
    break;
  }

  /* --- Flags -------------------------------------------------------------- */
  let onDeal = false;
  const deal = rest.match(/\b(?:deal|deals|sale|discount|discounted|offer)\b/);
  if (deal) {
    onDeal = true;
    chips.push("On deal");
    strip(deal[0]);
  }

  let inStockOnly = false;
  const stock = rest.match(/\bin\s*stock\b/);
  if (stock) {
    inStockOnly = true;
    chips.push("In stock");
    strip(stock[0]);
  }

  /* --- Kinds -------------------------------------------------------------- */
  const kinds: ComponentKind[] = [];
  for (const { phrase, kind } of KIND_PHRASES) {
    if (kinds.includes(kind)) continue;
    const pattern = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`);
    const match = rest.match(pattern);
    if (!match) continue;
    kinds.push(kind);
    strip(match[0]);
  }

  // A display spec with no stated product can only mean a monitor; a memory
  // type on its own means a kit. Both are the reading a shopper expects.
  if (!kinds.length && (resolution || refreshRate || panelSizeIn)) kinds.push("monitor");
  if (!kinds.length && memoryType) kinds.push("ram");
  if (!kinds.length && vramGb) kinds.push("gpu");
  if (!kinds.length && wattage) kinds.push("psu");
  if (!kinds.length && storageInterface) kinds.push("storage");

  if (kinds.length === 1) chips.unshift(KIND_META[kinds[0]].plural);

  /* --- Residual free text -------------------------------------------------- */
  const term = rest
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !STOPWORDS.has(word))
    .join(" ")
    .trim();

  return {
    kinds,
    minPrice,
    maxPrice,
    resolution,
    refreshRate,
    panelSizeIn,
    memoryType,
    vramGb,
    wattage,
    storageInterface,
    onDeal,
    inStockOnly,
    term,
    chips,
  };
}

function hasStructure(intent: Intent): boolean {
  return (
    intent.kinds.length > 0 ||
    intent.minPrice !== null ||
    intent.maxPrice !== null ||
    intent.resolution !== null ||
    intent.refreshRate !== null ||
    intent.panelSizeIn !== null ||
    intent.memoryType !== null ||
    intent.vramGb !== null ||
    intent.wattage !== null ||
    intent.storageInterface !== null ||
    intent.onDeal ||
    intent.inStockOnly
  );
}

/** Turns the parsed intent into the query the listing pages already speak. */
function toProductQuery(intent: Intent, includeTerm: boolean): ProductQuery {
  const facets: Partial<Record<FacetKey, string[]>> = {};

  // A single kind travels in the path (`/shop/graphics-cards`); several have to
  // become a facet on the unscoped listing.
  if (intent.kinds.length > 1) facets.kind = [...intent.kinds];
  if (intent.resolution) facets.resolution = [intent.resolution];
  if (intent.refreshRate !== null) facets.refreshRate = [String(intent.refreshRate)];
  if (intent.panelSizeIn !== null) facets.panelSizeIn = [String(intent.panelSizeIn)];
  if (intent.memoryType) facets.memoryType = [intent.memoryType];
  if (intent.vramGb !== null) facets.vramGb = [String(intent.vramGb)];
  if (intent.wattage !== null) facets.wattage = [String(intent.wattage)];
  if (intent.storageInterface) facets.storageInterface = [intent.storageInterface];

  return {
    q: includeTerm && intent.term.length >= MIN_QUERY ? intent.term : null,
    facets,
    minPrice: intent.minPrice,
    maxPrice: intent.maxPrice,
    onDeal: intent.onDeal || undefined,
    inStockOnly: intent.inStockOnly || undefined,
  };
}

function basePathFor(intent: Intent): string {
  if (intent.kinds.length === 1) return `/shop/${KIND_CATEGORY_SLUG[intent.kinds[0]]}`;
  return "/shop";
}

/** "1440p Monitors at 165Hz under PKR 90,000" — a sentence, not a filter dump. */
function suggestionLabel(intent: Intent): string {
  const noun =
    intent.kinds.length === 1 ? KIND_META[intent.kinds[0]].plural : "Products";

  const prefix: string[] = [];
  if (intent.resolution) {
    prefix.push(
      RESOLUTION_PHRASES.find((r) => r.value === intent.resolution)?.chip ?? "",
    );
  }
  if (intent.memoryType) prefix.push(intent.memoryType);
  if (intent.storageInterface) {
    prefix.push(
      STORAGE_PHRASES.find((s) => s.value === intent.storageInterface)?.chip ?? "",
    );
  }
  if (intent.vramGb !== null) prefix.push(`${intent.vramGb}GB`);

  const suffix: string[] = [];
  if (intent.panelSizeIn !== null) suffix.push(`at ${intent.panelSizeIn}″`);
  if (intent.refreshRate !== null) suffix.push(`at ${intent.refreshRate}Hz`);
  if (intent.wattage !== null) suffix.push(`rated ${intent.wattage}W`);
  if (intent.minPrice !== null && intent.maxPrice !== null) {
    suffix.push(`from ${formatPKR(intent.minPrice)} to ${formatPKR(intent.maxPrice)}`);
  } else if (intent.maxPrice !== null) {
    suffix.push(`under ${formatPKR(intent.maxPrice)}`);
  } else if (intent.minPrice !== null) {
    suffix.push(`over ${formatPKR(intent.minPrice)}`);
  }
  if (intent.onDeal) suffix.push("on deal");
  if (intent.inStockOnly) suffix.push("in stock");

  return [...prefix.filter(Boolean), noun, ...suffix].join(" ");
}

/** Groups hits by component kind, in the builder's canonical order. */
function groupByKind(items: ProductCardData[]): SearchGroup[] {
  const groups = new Map<string, ProductCardData[]>();
  for (const item of items) {
    const list = groups.get(item.kind) ?? [];
    list.push(item);
    groups.set(item.kind, list);
  }

  return Array.from(groups, ([kind, list]) => ({
    kind,
    label: isComponentKind(kind) ? KIND_META[kind].plural : kind,
    items: list,
  })).sort((a, b) => {
    const orderOf = (kind: string) =>
      isComponentKind(kind) ? KIND_META[kind].order : 99;
    return orderOf(a.kind) - orderOf(b.kind);
  });
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed query." }, { status: 400 });
  }

  const raw = parsed.data;
  const empty: SearchResponse = {
    query: raw,
    total: 0,
    allHref: "/shop",
    groups: [],
    suggestion: null,
  };

  if (raw.length < MIN_QUERY) {
    return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
  }

  const intent = parseSearchIntent(raw);

  let items: ProductCardData[] = [];
  let total = 0;
  let allHref = `/shop?q=${encodeURIComponent(raw)}`;
  let suggestion: SearchSuggestion | null = null;
  let resolved = false;

  if (hasStructure(intent)) {
    const basePath = basePathFor(intent);
    const category =
      intent.kinds.length === 1 ? KIND_CATEGORY_SLUG[intent.kinds[0]] : null;

    // The residual term is only worth applying if it actually narrows to
    // something — "gaming pc under 300k" leaves nothing useful behind, and a
    // stray word must not send the shopper to an empty grid.
    let usedTerm = true;
    let listing = await getProducts({
      ...toProductQuery(intent, true),
      category,
      limit: MAX_HITS,
    });
    if (listing.total === 0 && intent.term.length >= MIN_QUERY) {
      usedTerm = false;
      listing = await getProducts({
        ...toProductQuery(intent, false),
        category,
        limit: MAX_HITS,
      });
    }

    // Only commit to the intent when it actually found stock. Promising a
    // filtered page that turns out to be empty is worse than a plain search.
    if (listing.total > 0) {
      resolved = true;
      items = listing.items;
      total = listing.total;
      // Built from exactly the query that produced `listing`, so the count on
      // the "see all" row and the page it opens can never disagree — and the
      // rows above it are the same products that page will show.
      allHref = queryHref(basePath, toProductQuery(intent, usedTerm));
      suggestion = {
        label: suggestionLabel(intent),
        href: allHref,
        chips: intent.chips,
      };
    }
  }

  if (!resolved) {
    // Plain ranked text search: `searchProducts` puts a name that *starts with*
    // the term above one that merely contains it, which is what someone typing
    // an exact model number is after.
    items = await searchProducts(raw, MAX_HITS);
    // The true count behind "see all", from the same query `/shop?q=` runs.
    const listing = await getProducts({ q: raw, limit: 1 });
    total = listing.total;
  }

  const payload: SearchResponse = {
    query: raw,
    total,
    allHref,
    groups: groupByKind(items),
    suggestion,
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
