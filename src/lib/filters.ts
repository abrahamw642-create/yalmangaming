/**
 * Catalog filter vocabulary — the shared language between the server query
 * layer (`@/lib/catalog`) and the client filter UI.
 *
 * Deliberately free of any database import: the sidebar, the sort control and
 * the comparison table all import these types and this URL codec, so nothing
 * here may drag Prisma into the client bundle.
 *
 * Filter state lives in the **query string**, never in React state. A filtered
 * listing is then shareable, bookmarkable and survives a refresh, and the page
 * itself can stay a Server Component that simply reads its awaited
 * `searchParams`.
 */

import type { SpecRow } from "./specs";
import type { ComponentKind, SortOption } from "./types";
import { CORE_KINDS, PERIPHERAL_KINDS, SORT_OPTIONS } from "./types";

/* -------------------------------------------------------------------------- */
/* Card payload                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The flat shape every product tile renders from. Re-exported by
 * `@/components/shop/ProductCard` because that is the import path the rest of
 * the site codes against; this file is its canonical home so that pure data
 * modules can reference it without importing a client component.
 */
export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  brandName: string | null;
  headline: string | null;
  price: number;
  salePrice: number | null;
  samplePrice: boolean;
  stock: number;
  rating: number;
  reviewCount: number;
  imageUrl: string | null;
  keySpec: string | null;
  isNew?: boolean;
  onDeal?: boolean;
  /** Alt text from `ProductImage.alt` when the catalogue supplies one. */
  imageAlt?: string | null;
  /** Threshold below which the tile shows "Only N left". */
  lowStockAt?: number;
};

/* -------------------------------------------------------------------------- */
/* Facet dimensions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every dimension the sidebar can offer as a multi-select list. Price,
 * availability, rating and RGB are handled separately because they are ranges
 * or toggles rather than value lists.
 */
export const FACET_KEYS = [
  "kind",
  "brand",
  "socket",
  "chipset",
  "memoryType",
  "vramGb",
  "wattage",
  "resolution",
  "refreshRate",
  "panelSizeIn",
  "formFactor",
  "caseStyle",
  "storageInterface",
] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

export type FacetDef = {
  key: FacetKey;
  /** Query-string parameter. Kept short — these end up in shared links. */
  param: string;
  label: string;
  /** Values are numeric; sorted numerically rather than alphabetically. */
  numeric: boolean;
  /** Renders a raw column value as a human label. */
  format: (value: string) => string;
};

const STORAGE_INTERFACE_LABELS: Record<string, string> = {
  "nvme-gen5": "NVMe PCIe 5.0",
  "nvme-gen4": "NVMe PCIe 4.0",
  "nvme-gen3": "NVMe PCIe 3.0",
  nvme: "NVMe",
  sata: "SATA SSD",
  hdd: "Hard Drive",
};

const RESOLUTION_LABELS: Record<string, string> = {
  "1920x1080": '1080p — 1920 × 1080',
  "2560x1440": "1440p — 2560 × 1440",
  "3440x1440": "Ultrawide — 3440 × 1440",
  "3840x2160": "4K — 3840 × 2160",
};

const identity = (v: string) => v;

export const FACET_DEFS: Record<FacetKey, FacetDef> = {
  kind: { key: "kind", param: "kind", label: "Category", numeric: false, format: identity },
  brand: { key: "brand", param: "brand", label: "Brand", numeric: false, format: identity },
  socket: { key: "socket", param: "socket", label: "Socket", numeric: false, format: identity },
  chipset: { key: "chipset", param: "chipset", label: "Chipset", numeric: false, format: identity },
  memoryType: {
    key: "memoryType",
    param: "mem",
    label: "Memory Type",
    numeric: false,
    format: identity,
  },
  vramGb: {
    key: "vramGb",
    param: "vram",
    label: "Video Memory",
    numeric: true,
    format: (v) => `${v} GB`,
  },
  wattage: {
    key: "wattage",
    param: "watt",
    label: "Wattage",
    numeric: true,
    format: (v) => `${v} W`,
  },
  resolution: {
    key: "resolution",
    param: "res",
    label: "Resolution",
    numeric: false,
    format: (v) => RESOLUTION_LABELS[v] ?? v,
  },
  refreshRate: {
    key: "refreshRate",
    param: "hz",
    label: "Refresh Rate",
    numeric: true,
    format: (v) => `${v} Hz`,
  },
  panelSizeIn: {
    key: "panelSizeIn",
    param: "size",
    label: "Screen Size",
    numeric: true,
    format: (v) => `${v}″`,
  },
  formFactor: {
    key: "formFactor",
    param: "ff",
    label: "Form Factor",
    numeric: false,
    format: identity,
  },
  caseStyle: {
    key: "caseStyle",
    param: "style",
    label: "Case Style",
    numeric: false,
    format: identity,
  },
  storageInterface: {
    key: "storageInterface",
    param: "iface",
    label: "Interface",
    numeric: false,
    format: (v) => STORAGE_INTERFACE_LABELS[v] ?? v,
  },
};

const PARAM_TO_FACET: Record<string, FacetKey> = Object.fromEntries(
  FACET_KEYS.map((k) => [FACET_DEFS[k].param, k]),
) as Record<string, FacetKey>;

/**
 * Which facets are worth offering for a given kind. Used to keep a scoped
 * listing tidy — an unscoped `/shop` falls back to "show any dimension that
 * actually has more than one value".
 */
export const KIND_FACET_KEYS: Partial<Record<ComponentKind, FacetKey[]>> = {
  cpu: ["brand", "socket"],
  motherboard: ["brand", "socket", "chipset", "memoryType", "formFactor"],
  gpu: ["brand", "vramGb"],
  ram: ["brand", "memoryType"],
  storage: ["brand", "storageInterface"],
  psu: ["brand", "wattage"],
  case: ["brand", "caseStyle", "formFactor"],
  cooler: ["brand", "socket"],
  fan: ["brand"],
  monitor: ["brand", "resolution", "refreshRate", "panelSizeIn"],
  prebuilt: ["brand", "vramGb"],
};

/* -------------------------------------------------------------------------- */
/* Facet result payload                                                       */
/* -------------------------------------------------------------------------- */

export type FacetBucket = { value: string; label: string; count: number };

export type Facets = {
  /** Real price bounds of the result set, for the price inputs. */
  price: { min: number; max: number };
  availability: { inStock: number; outOfStock: number };
  rgb: { yes: number; no: number };
  /** "4 stars & up" style buckets. `value` is the minimum rating. */
  rating: FacetBucket[];
  buckets: Record<FacetKey, FacetBucket[]>;
};

export const EMPTY_FACETS: Facets = {
  price: { min: 0, max: 0 },
  availability: { inStock: 0, outOfStock: 0 },
  rgb: { yes: 0, no: 0 },
  rating: [],
  buckets: {
    kind: [],
    brand: [],
    socket: [],
    chipset: [],
    memoryType: [],
    vramGb: [],
    wattage: [],
    resolution: [],
    refreshRate: [],
    panelSizeIn: [],
    formFactor: [],
    caseStyle: [],
    storageInterface: [],
  },
};

/** Minimum-rating steps offered in the sidebar, strongest first. */
export const RATING_STEPS = [4.5, 4, 3.5, 3] as const;

/* -------------------------------------------------------------------------- */
/* Query shape                                                                */
/* -------------------------------------------------------------------------- */

export type ProductQuery = {
  /** Free-text search across name, SKU and headline. */
  q?: string | null;
  /** Category slug — resolved server-side against the Category tree. */
  category?: string | null;
  /** Selected values per facet dimension. */
  facets?: Partial<Record<FacetKey, string[]>>;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStockOnly?: boolean;
  minRating?: number | null;
  /** `true` = RGB only, `false` = no RGB, `null`/undefined = either. */
  rgb?: boolean | null;
  onDeal?: boolean;
  isNew?: boolean;
  featuredOnly?: boolean;
  sort?: SortOption;
  page?: number;
  perPage?: number;

  /**
   * Convenience shorthands other areas may pass instead of building a `facets`
   * record — e.g. `getProducts({ kind: "gpu", limit: 8 })`. Normalised into
   * `facets` / `perPage` by `normalizeProductQuery`.
   */
  kind?: string | string[];
  brand?: string | string[];
  limit?: number;
};

export const DEFAULT_SORT: SortOption = "featured";
export const DEFAULT_PER_PAGE = 24;
export const MAX_PER_PAGE = 96;
export const PER_PAGE_OPTIONS = [12, 24, 48, 96];

/** Maximum products the comparison table will hold. */
export const MAX_COMPARE = 4;

const SORT_IDS = new Set<string>(SORT_OPTIONS.map((o) => o.id));

export function isSortOption(value: string): value is SortOption {
  return SORT_IDS.has(value);
}

/** Values selected for one dimension, always an array. */
export function facetValues(query: ProductQuery, key: FacetKey): string[] {
  return query.facets?.[key] ?? [];
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Folds the convenience shorthands into the canonical `facets` record so the
 * rest of the pipeline only ever reads one representation.
 */
export function normalizeProductQuery(query: ProductQuery = {}): ProductQuery {
  const facets: Partial<Record<FacetKey, string[]>> = { ...query.facets };

  const kinds = asArray(query.kind);
  if (kinds.length) facets.kind = unique([...(facets.kind ?? []), ...kinds]);

  const brands = asArray(query.brand);
  if (brands.length) facets.brand = unique([...(facets.brand ?? []), ...brands]);

  const perPage = clampInt(query.limit ?? query.perPage ?? DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);

  return {
    ...query,
    kind: undefined,
    brand: undefined,
    limit: undefined,
    facets,
    perPage,
    page: clampInt(query.page ?? 1, 1, 10_000),
    sort: query.sort && isSortOption(query.sort) ? query.sort : DEFAULT_SORT,
  };
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/* -------------------------------------------------------------------------- */
/* URL codec                                                                  */
/* -------------------------------------------------------------------------- */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Reads a param that may arrive repeated, comma-joined, or not at all. */
function readList(sp: SearchParamsRecord, param: string): string[] {
  const raw = sp[param];
  if (raw === undefined) return [];
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  // Cap the list so a hand-edited URL cannot balloon the query.
  return unique(parts).slice(0, 40);
}

function readOne(sp: SearchParamsRecord, param: string): string | null {
  const raw = sp[param];
  if (raw === undefined) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : null;
}

function readInt(sp: SearchParamsRecord, param: string): number | null {
  const raw = readOne(sp, param);
  if (raw === null) return null;
  const n = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function readFloat(sp: SearchParamsRecord, param: string): number | null {
  const raw = readOne(sp, param);
  if (raw === null) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Parses awaited `searchParams` into a validated query. Never throws. */
export function parseProductQuery(
  sp: SearchParamsRecord = {},
  category?: string | null,
): ProductQuery {
  const facets: Partial<Record<FacetKey, string[]>> = {};
  for (const key of FACET_KEYS) {
    const values = readList(sp, FACET_DEFS[key].param);
    if (values.length) facets[key] = values;
  }

  const sortRaw = readOne(sp, "sort");
  const rgbRaw = readOne(sp, "rgb");
  const min = readInt(sp, "min");
  const max = readInt(sp, "max");

  return normalizeProductQuery({
    q: readOne(sp, "q"),
    category: category ?? readOne(sp, "category"),
    facets,
    // A reversed range is a user slip, not an error — swap rather than 404.
    minPrice: min !== null && max !== null ? Math.min(min, max) : min,
    maxPrice: min !== null && max !== null ? Math.max(min, max) : max,
    inStockOnly: readOne(sp, "stock") === "in",
    minRating: readFloat(sp, "rating"),
    rgb: rgbRaw === "1" ? true : rgbRaw === "0" ? false : null,
    onDeal: readOne(sp, "deal") === "1",
    isNew: readOne(sp, "new") === "1",
    featuredOnly: readOne(sp, "featured") === "1",
    sort: sortRaw && isSortOption(sortRaw) ? sortRaw : DEFAULT_SORT,
    page: readInt(sp, "page") ?? 1,
    perPage: readInt(sp, "per") ?? DEFAULT_PER_PAGE,
  });
}

/**
 * Serialises a query back to a query string. Defaults are omitted so a plain
 * listing URL stays clean, and `category` is left out because it travels in the
 * path (`/shop/[category]`).
 */
export function serializeProductQuery(query: ProductQuery): string {
  const q = normalizeProductQuery(query);
  const sp = new URLSearchParams();

  if (q.q) sp.set("q", q.q);
  for (const key of FACET_KEYS) {
    const values = q.facets?.[key];
    if (values?.length) sp.set(FACET_DEFS[key].param, values.join(","));
  }
  if (q.minPrice != null) sp.set("min", String(q.minPrice));
  if (q.maxPrice != null) sp.set("max", String(q.maxPrice));
  if (q.inStockOnly) sp.set("stock", "in");
  if (q.minRating != null) sp.set("rating", String(q.minRating));
  if (q.rgb === true) sp.set("rgb", "1");
  if (q.rgb === false) sp.set("rgb", "0");
  if (q.onDeal) sp.set("deal", "1");
  if (q.isNew) sp.set("new", "1");
  if (q.featuredOnly) sp.set("featured", "1");
  if (q.sort && q.sort !== DEFAULT_SORT) sp.set("sort", q.sort);
  if (q.perPage && q.perPage !== DEFAULT_PER_PAGE) sp.set("per", String(q.perPage));
  if (q.page && q.page > 1) sp.set("page", String(q.page));

  return sp.toString();
}

/** `/shop?vram=16&sort=price-asc` */
export function queryHref(basePath: string, query: ProductQuery): string {
  const qs = serializeProductQuery(query);
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Returns a copy of `query` with `value` toggled inside `key`, and the page
 * reset — changing a filter while on page 4 of the old result set is never what
 * anyone means.
 */
export function toggleFacet(
  query: ProductQuery,
  key: FacetKey,
  value: string,
): ProductQuery {
  const current = facetValues(query, key);
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];

  const facets = { ...query.facets };
  if (next.length) facets[key] = next;
  else delete facets[key];

  return { ...query, facets, page: 1 };
}

/** Applies a partial change and resets pagination. */
export function withFilter(query: ProductQuery, patch: Partial<ProductQuery>): ProductQuery {
  return { ...query, ...patch, page: 1 };
}

/** Drops every filter but keeps sort, page size and the free-text term. */
export function clearedQuery(query: ProductQuery): ProductQuery {
  return {
    q: query.q,
    category: query.category,
    sort: query.sort,
    perPage: query.perPage,
    page: 1,
    facets: {},
  };
}

export function countActiveFilters(query: ProductQuery): number {
  let n = 0;
  for (const key of FACET_KEYS) n += facetValues(query, key).length;
  if (query.minPrice != null) n++;
  if (query.maxPrice != null) n++;
  if (query.inStockOnly) n++;
  if (query.minRating != null) n++;
  if (query.rgb != null) n++;
  if (query.onDeal) n++;
  if (query.isNew) n++;
  return n;
}

export type FilterChip = {
  id: string;
  label: string;
  /** The query with just this filter removed. */
  next: ProductQuery;
};

/**
 * The removable pills shown above a filtered grid.
 *
 * Pass `facets` where they are available: bucket labels carry the display name
 * a raw column value cannot ("ASUS", not the `asus` slug the URL holds).
 */
export function activeFilterChips(
  query: ProductQuery,
  facets?: Facets,
): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const key of FACET_KEYS) {
    const def = FACET_DEFS[key];
    for (const value of facetValues(query, key)) {
      const bucketLabel = facets?.buckets[key].find((b) => b.value === value)?.label;
      chips.push({
        id: `${key}:${value}`,
        label: `${def.label}: ${bucketLabel ?? def.format(value)}`,
        next: toggleFacet(query, key, value),
      });
    }
  }

  if (query.minPrice != null) {
    chips.push({
      id: "minPrice",
      label: `Min ${query.minPrice.toLocaleString("en-PK")}`,
      next: withFilter(query, { minPrice: null }),
    });
  }
  if (query.maxPrice != null) {
    chips.push({
      id: "maxPrice",
      label: `Max ${query.maxPrice.toLocaleString("en-PK")}`,
      next: withFilter(query, { maxPrice: null }),
    });
  }
  if (query.inStockOnly) {
    chips.push({
      id: "stock",
      label: "In stock only",
      next: withFilter(query, { inStockOnly: false }),
    });
  }
  if (query.minRating != null) {
    chips.push({
      id: "rating",
      label: `${query.minRating}★ & up`,
      next: withFilter(query, { minRating: null }),
    });
  }
  if (query.rgb != null) {
    chips.push({
      id: "rgb",
      label: query.rgb ? "RGB lighting" : "No RGB",
      next: withFilter(query, { rgb: null }),
    });
  }
  if (query.onDeal) {
    chips.push({ id: "deal", label: "On deal", next: withFilter(query, { onDeal: false }) });
  }
  if (query.isNew) {
    chips.push({ id: "new", label: "New arrivals", next: withFilter(query, { isNew: false }) });
  }

  return chips;
}

/* -------------------------------------------------------------------------- */
/* Category slug aliases                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Fallback routing for `/shop/[category]` when no `Category` row matches the
 * slug. The navigation in `@/lib/site` links to slugs like `graphics-cards`;
 * mapping them to component kinds means those links resolve to a real listing
 * whatever the catalogue's category rows happen to be called.
 */
export const CATEGORY_KIND_ALIASES: Record<string, ComponentKind[]> = {
  "gaming-pcs": ["prebuilt"],
  prebuilts: ["prebuilt"],
  "prebuilt-gaming-pcs": ["prebuilt"],
  components: [...CORE_KINDS],
  "pc-components": [...CORE_KINDS],
  accessories: [...PERIPHERAL_KINDS],
  peripherals: [...PERIPHERAL_KINDS],
  "graphics-cards": ["gpu"],
  gpus: ["gpu"],
  processors: ["cpu"],
  cpus: ["cpu"],
  motherboards: ["motherboard"],
  memory: ["ram"],
  ram: ["ram"],
  storage: ["storage"],
  ssds: ["storage"],
  cooling: ["cooler", "fan"],
  coolers: ["cooler"],
  fans: ["fan"],
  "power-supplies": ["psu"],
  psus: ["psu"],
  cases: ["case"],
  "pc-cases": ["case"],
  "operating-systems": ["os"],
  monitors: ["monitor"],
  "gaming-monitors": ["monitor"],
  keyboards: ["keyboard"],
  mice: ["mouse"],
  headsets: ["headset"],
  microphones: ["microphone"],
  webcams: ["webcam"],
  chairs: ["chair"],
  "gaming-chairs": ["chair"],
  controllers: ["controller"],
  mousepads: ["mousepad"],
  speakers: ["speaker"],
};

/* -------------------------------------------------------------------------- */
/* Comparison                                                                 */
/* -------------------------------------------------------------------------- */

export type CompareValue = string | number | boolean | null;

export type CompareProduct = ProductCardData & {
  sku: string;
  warranty: string | null;
  description: string | null;
  categoryName: string | null;
  /** Raw values straight off the real Product columns. */
  attrs: Record<string, CompareValue>;
  specs: SpecRow[];
};

export type CompareField = {
  key: string;
  label: string;
  group: string;
  kind: "text" | "number" | "bool";
  /** Appended to numeric values, including its own leading space if wanted. */
  unit?: string;
  map?: Record<string, string>;
};

/**
 * The comparison rows, drawn from real Product columns only. A row is dropped
 * entirely when none of the compared products carries a value for it, so the
 * table never shows a wall of dashes.
 */
export const COMPARE_FIELDS: CompareField[] = [
  { key: "brandName", label: "Brand", group: "Overview", kind: "text" },
  { key: "sku", label: "SKU", group: "Overview", kind: "text" },
  { key: "warranty", label: "Warranty", group: "Overview", kind: "text" },

  { key: "cores", label: "Cores", group: "Performance", kind: "number" },
  { key: "threads", label: "Threads", group: "Performance", kind: "number" },
  { key: "baseClock", label: "Base clock", group: "Performance", kind: "number", unit: " GHz" },
  { key: "boostClock", label: "Boost clock", group: "Performance", kind: "number", unit: " GHz" },
  { key: "socket", label: "Socket", group: "Performance", kind: "text" },
  { key: "chipset", label: "Chipset", group: "Performance", kind: "text" },
  {
    key: "integratedGraphics",
    label: "Integrated graphics",
    group: "Performance",
    kind: "bool",
  },
  { key: "vramGb", label: "Video memory", group: "Performance", kind: "number", unit: " GB" },
  { key: "memoryType", label: "Memory type", group: "Performance", kind: "text" },
  { key: "memorySpeed", label: "Memory speed", group: "Performance", kind: "number", unit: " MT/s" },
  { key: "memorySlots", label: "Memory slots", group: "Performance", kind: "number" },
  { key: "maxMemoryGb", label: "Max memory", group: "Performance", kind: "number", unit: " GB" },
  { key: "capacityGb", label: "Capacity", group: "Performance", kind: "number", unit: " GB" },
  { key: "moduleCount", label: "Modules", group: "Performance", kind: "number" },
  {
    key: "storageInterface",
    label: "Interface",
    group: "Performance",
    kind: "text",
    map: STORAGE_INTERFACE_LABELS,
  },
  { key: "formFactorDrive", label: "Drive form factor", group: "Performance", kind: "text" },

  { key: "resolution", label: "Resolution", group: "Display", kind: "text" },
  { key: "refreshRate", label: "Refresh rate", group: "Display", kind: "number", unit: " Hz" },
  { key: "panelSizeIn", label: "Screen size", group: "Display", kind: "number", unit: "″" },
  { key: "panelType", label: "Panel type", group: "Display", kind: "text" },

  { key: "tdp", label: "TDP", group: "Power & Thermals", kind: "number", unit: " W" },
  {
    key: "recommendedPsuW",
    label: "Recommended PSU",
    group: "Power & Thermals",
    kind: "number",
    unit: " W",
  },
  { key: "wattage", label: "Output", group: "Power & Thermals", kind: "number", unit: " W" },
  { key: "efficiency", label: "Efficiency", group: "Power & Thermals", kind: "text" },
  { key: "modular", label: "Modularity", group: "Power & Thermals", kind: "text" },
  { key: "psuFormFactor", label: "PSU form factor", group: "Power & Thermals", kind: "text" },
  { key: "coolerType", label: "Cooler type", group: "Power & Thermals", kind: "text" },
  {
    key: "coolingCapacityW",
    label: "Cooling capacity",
    group: "Power & Thermals",
    kind: "number",
    unit: " W",
  },
  {
    key: "radiatorSizeMm",
    label: "Radiator",
    group: "Power & Thermals",
    kind: "number",
    unit: " mm",
  },

  { key: "formFactor", label: "Form factor", group: "Physical", kind: "text" },
  { key: "caseStyle", label: "Case style", group: "Physical", kind: "text" },
  { key: "dimensionsMm", label: "Dimensions", group: "Physical", kind: "text" },
  { key: "gpuLengthMm", label: "Card length", group: "Physical", kind: "number", unit: " mm" },
  {
    key: "coolerHeightMm",
    label: "Cooler height",
    group: "Physical",
    kind: "number",
    unit: " mm",
  },
  {
    key: "maxGpuLengthMm",
    label: "Max card length",
    group: "Physical",
    kind: "number",
    unit: " mm",
  },
  {
    key: "maxCoolerHeightMm",
    label: "Max cooler height",
    group: "Physical",
    kind: "number",
    unit: " mm",
  },
  { key: "includedFans", label: "Included fans", group: "Physical", kind: "number" },
  { key: "m2Slots", label: "M.2 slots", group: "Physical", kind: "number" },
  { key: "sataPorts", label: "SATA ports", group: "Physical", kind: "number" },
  { key: "pcieVersion", label: "PCIe version", group: "Physical", kind: "text" },

  { key: "connectivity", label: "Connectivity", group: "Features", kind: "text" },
  { key: "switchType", label: "Switch type", group: "Features", kind: "text" },
  { key: "rgb", label: "RGB lighting", group: "Features", kind: "bool" },
];

export function formatCompareValue(field: CompareField, value: CompareValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.kind === "bool") return value ? "Yes" : "No";
  if (typeof value === "string" && field.map) return field.map[value] ?? value;
  if (field.kind === "number" && typeof value === "number") {
    return `${value}${field.unit ?? ""}`;
  }
  return String(value);
}

export type CompareRow = {
  field: CompareField;
  values: CompareValue[];
  /** True when the products do not all share the same value. */
  differs: boolean;
};

export type CompareGroup = { group: string; rows: CompareRow[] };

/**
 * Builds the comparison body. Rows where every product is blank are dropped;
 * `differs` drives the highlight so the eye lands on what actually separates
 * the machines.
 */
export function buildCompareRows(products: CompareProduct[]): CompareGroup[] {
  const groups: CompareGroup[] = [];
  const byGroup = new Map<string, CompareRow[]>();

  for (const field of COMPARE_FIELDS) {
    const values = products.map<CompareValue>((p) =>
      field.key in p.attrs
        ? p.attrs[field.key]
        : ((p as unknown as Record<string, CompareValue>)[field.key] ?? null),
    );

    const present = values.filter((v) => v !== null && v !== undefined && v !== "");
    if (!present.length) continue;

    const rendered = values.map((v) => formatCompareValue(field, v));
    const differs = new Set(rendered).size > 1;

    if (!byGroup.has(field.group)) {
      byGroup.set(field.group, []);
      groups.push({ group: field.group, rows: byGroup.get(field.group)! });
    }
    byGroup.get(field.group)!.push({ field, values, differs });
  }

  return groups;
}
