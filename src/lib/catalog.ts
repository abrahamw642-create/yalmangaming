/**
 * Yalman Gaming — catalog data access.
 *
 * Server-only. Every storefront surface that needs product data goes through
 * this module: the shop listings, the product page, the PC builder's part
 * pickers, the home page rails and the search box. Route handlers under
 * `src/app/api/**` call the same functions so the client and the server can
 * never disagree about what the catalogue contains.
 *
 * Faceting note
 * -------------
 * `getProducts` narrows in SQL by the things that meaningfully cut the table
 * (status, category/kind scope, free-text term) and then computes filters and
 * facet counts over the resulting slim rows in memory. That is a deliberate
 * trade: a single physical store's catalogue is thousands of rows at most, and
 * one scan gives *exact, mutually consistent* counts — where a per-dimension
 * `groupBy` would need a dozen round trips and still not honour the
 * "exclude-your-own-dimension" rule that makes multi-select facets behave.
 * `FACET_SCAN_LIMIT` is the ceiling at which this stops being the right call.
 */

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  BUILDER_PART_SELECT,
  parseSpecSheet,
  toBuilderPart,
  type SpecRow,
} from "@/lib/specs";
import {
  CATEGORY_KIND_ALIASES,
  EMPTY_FACETS,
  FACET_DEFS,
  FACET_KEYS,
  MAX_COMPARE,
  RATING_STEPS,
  normalizeProductQuery,
  type CompareProduct,
  type CompareValue,
  type FacetBucket,
  type FacetKey,
  type Facets,
  type ProductCardData,
  type ProductQuery,
} from "@/lib/filters";
import {
  COMPONENT_KINDS,
  KIND_META,
  isComponentKind,
  type BuilderPart,
  type ComponentKind,
  type SortOption,
} from "@/lib/types";
import { effectivePrice } from "@/lib/utils";

export type {
  CompareProduct,
  FacetBucket,
  Facets,
  ProductCardData,
  ProductQuery,
} from "@/lib/filters";

/** Above this the in-memory facet scan should become SQL aggregates. */
const FACET_SCAN_LIMIT = 4000;

/** Only `active` products are ever visible on the storefront. */
const PUBLIC_STATUS = "active";

/* -------------------------------------------------------------------------- */
/* Selects                                                                    */
/* -------------------------------------------------------------------------- */

/** The slim row the facet scan works over — small columns, one thin join. */
const FACET_SELECT = {
  id: true,
  name: true,
  kind: true,
  price: true,
  salePrice: true,
  stock: true,
  rating: true,
  reviewCount: true,
  rgb: true,
  featured: true,
  isNew: true,
  onDeal: true,
  createdAt: true,
  categoryId: true,
  socket: true,
  chipset: true,
  memoryType: true,
  vramGb: true,
  wattage: true,
  resolution: true,
  refreshRate: true,
  panelSizeIn: true,
  formFactor: true,
  caseStyle: true,
  storageInterface: true,
  brand: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

type FacetRow = Prisma.ProductGetPayload<{ select: typeof FACET_SELECT }>;

/** Everything a `ProductCardData` needs, including the key-spec columns. */
const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  headline: true,
  price: true,
  salePrice: true,
  samplePrice: true,
  stock: true,
  lowStockAt: true,
  rating: true,
  reviewCount: true,
  isNew: true,
  onDeal: true,
  brand: { select: { name: true } },
  images: {
    select: { url: true, alt: true },
    orderBy: { sortOrder: "asc" },
    take: 1,
  },
  // Key-spec inputs.
  cores: true,
  threads: true,
  boostClock: true,
  socket: true,
  chipset: true,
  formFactor: true,
  memoryType: true,
  memorySpeed: true,
  capacityGb: true,
  moduleCount: true,
  vramGb: true,
  storageInterface: true,
  wattage: true,
  efficiency: true,
  coolerType: true,
  coolerHeightMm: true,
  radiatorSizeMm: true,
  caseStyle: true,
  resolution: true,
  refreshRate: true,
  panelSizeIn: true,
  panelType: true,
  switchType: true,
  connectivity: true,
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

const PRODUCT_INCLUDE = {
  brand: true,
  category: { include: { parent: true } },
  images: { orderBy: { sortOrder: "asc" } },
  benchmarks: {
    orderBy: [{ game: "asc" }, { resolution: "asc" }, { preset: "asc" }],
  },
  reviews: {
    where: { approved: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  },
} satisfies Prisma.ProductInclude;

export type FullProduct = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}> & {
  /** Flat shape for the compatibility engine and the builder. */
  builderPart: BuilderPart;
  /** Same product as the grid renders it, for related-product rails. */
  card: ProductCardData;
  /** Parsed `specSheet`, ready for `groupSpecs`. */
  specRows: SpecRow[];
};

/* -------------------------------------------------------------------------- */
/* Key spec                                                                   */
/* -------------------------------------------------------------------------- */

const STORAGE_LABELS: Record<string, string> = {
  "nvme-gen5": "NVMe Gen5",
  "nvme-gen4": "NVMe Gen4",
  "nvme-gen3": "NVMe Gen3",
  nvme: "NVMe",
  sata: "SATA",
  hdd: "HDD",
};

/**
 * The single line under a product name on a card: the one number a buyer of
 * *that* kind of part actually scans for. Built from real columns only —
 * anything missing simply drops out of the string.
 */
function keySpecFor(p: CardRow): string | null {
  const join = (...parts: (string | null | undefined | false)[]) => {
    const list = parts.filter((v): v is string => typeof v === "string" && v.length > 0);
    return list.length ? list.join(" · ") : null;
  };

  switch (p.kind) {
    case "cpu":
      return join(
        p.cores ? `${p.cores}C${p.threads ? `/${p.threads}T` : ""}` : null,
        p.boostClock ? `${p.boostClock} GHz boost` : null,
        p.socket,
      );
    case "motherboard":
      return join(p.chipset, p.socket, p.formFactor, p.memoryType);
    case "gpu":
      return join(p.vramGb ? `${p.vramGb}GB VRAM` : null, p.memoryType);
    case "ram":
      return join(
        p.capacityGb
          ? `${p.capacityGb}GB${p.moduleCount ? ` (${p.moduleCount}×${p.capacityGb / p.moduleCount}GB)` : ""}`
          : null,
        p.memoryType,
        p.memorySpeed ? `${p.memorySpeed} MT/s` : null,
      );
    case "storage":
      return join(
        p.capacityGb ? formatCapacity(p.capacityGb) : null,
        p.storageInterface ? (STORAGE_LABELS[p.storageInterface] ?? p.storageInterface) : null,
      );
    case "psu":
      return join(p.wattage ? `${p.wattage}W` : null, p.efficiency);
    case "cooler":
      return join(
        p.coolerType === "aio"
          ? p.radiatorSizeMm
            ? `${p.radiatorSizeMm}mm AIO`
            : "AIO liquid"
          : p.coolerHeightMm
            ? `${p.coolerHeightMm}mm air cooler`
            : "Air cooler",
      );
    case "case":
      return join(p.caseStyle, p.formFactor);
    case "monitor":
      return join(
        p.panelSizeIn ? `${p.panelSizeIn}″` : null,
        p.resolution,
        p.refreshRate ? `${p.refreshRate}Hz` : null,
        p.panelType,
      );
    case "keyboard":
      return join(p.switchType, p.connectivity);
    case "mouse":
    case "headset":
    case "speaker":
    case "microphone":
    case "webcam":
    case "controller":
      return join(p.connectivity);
    default:
      return p.headline;
  }
}

function formatCapacity(gb: number): string {
  return gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000}TB` : `${gb}GB`;
}

function toCard(p: CardRow): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    kind: p.kind,
    brandName: p.brand?.name ?? null,
    headline: p.headline,
    price: p.price,
    salePrice: p.salePrice,
    samplePrice: p.samplePrice,
    stock: p.stock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    imageUrl: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? null,
    keySpec: keySpecFor(p),
    isNew: p.isNew,
    onDeal: p.onDeal,
    lowStockAt: p.lowStockAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  href: string;
  description: string | null;
  kind: string | null;
  icon: string | null;
  accent: string | null;
  featured: boolean;
  sortOrder: number;
  /** Products in this category and everything under it. */
  productCount: number;
  children: CategoryNode[];
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: string | null;
  icon: string | null;
  accent: string | null;
  featured: boolean;
  sortOrder: number;
  parentId: string | null;
};

/**
 * Cached per request: the category table is small and several surfaces
 * (breadcrumbs, sidebar, metadata) resolve slugs on the same render.
 */
const loadCategories = cache(async (): Promise<CategoryRow[]> => {
  return prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      kind: true,
      icon: true,
      accent: true,
      featured: true,
      sortOrder: true,
      parentId: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

const loadKindCounts = cache(async (): Promise<Map<string, number>> => {
  const rows = await prisma.product.groupBy({
    by: ["kind"],
    where: { status: PUBLIC_STATUS },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.kind, r._count._all]));
});

const loadCategoryCounts = cache(async (): Promise<Map<string, number>> => {
  const rows = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { status: PUBLIC_STATUS, categoryId: { not: null } },
    _count: { _all: true },
  });
  return new Map(
    rows.flatMap((r) => (r.categoryId ? [[r.categoryId, r._count._all] as const] : [])),
  );
});

/**
 * The browse tree. Falls back to a synthetic kind-based tree when the Category
 * table is empty so navigation and the category cards still work against a
 * freshly-pushed database.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const [rows, catCounts, kindCounts] = await Promise.all([
    loadCategories(),
    loadCategoryCounts(),
    loadKindCounts(),
  ]);

  if (!rows.length) return syntheticCategoryTree(kindCounts);

  const nodes = new Map<string, CategoryNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      href: `/shop/${row.slug}`,
      description: row.description,
      kind: row.kind,
      icon: row.icon,
      accent: row.accent,
      featured: row.featured,
      sortOrder: row.sortOrder,
      productCount: catCounts.get(row.id) ?? 0,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Roll descendant counts up so a parent shows the size of its whole branch.
  const rollUp = (node: CategoryNode): number => {
    for (const child of node.children) node.productCount += rollUp(child);
    return node.productCount;
  };
  for (const root of roots) rollUp(root);

  return roots;
}

function syntheticCategoryTree(kindCounts: Map<string, number>): CategoryNode[] {
  return COMPONENT_KINDS.filter((kind) => (kindCounts.get(kind) ?? 0) > 0)
    .map((kind) => {
      const meta = KIND_META[kind];
      return {
        id: `kind:${kind}`,
        name: meta.plural,
        slug: kind,
        href: `/shop/${kind}`,
        description: meta.hint || null,
        kind,
        icon: meta.icon,
        accent: null,
        featured: false,
        sortOrder: meta.order,
        productCount: kindCounts.get(kind) ?? 0,
        children: [],
      } satisfies CategoryNode;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type CategoryScope = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  accent: string | null;
  /** Category ids covered — the matched row plus every descendant. */
  categoryIds: string[];
  /** Component kinds covered, from the category rows or the slug alias. */
  kinds: ComponentKind[];
  /** Root-first ancestry, excluding the scope itself. */
  ancestors: { name: string; slug: string }[];
};

/**
 * Resolves `/shop/[category]` to something the query layer can filter on.
 *
 * Three ways a slug can resolve, in order: a real `Category` row (plus its
 * subtree), a known navigation slug from `CATEGORY_KIND_ALIASES`, or the bare
 * component kind. Returns `null` for anything else so the page can 404.
 */
export const getCategoryScope = cache(
  async (slug: string): Promise<CategoryScope | null> => {
    const clean = slug.trim().toLowerCase();
    if (!clean) return null;

    const rows = await loadCategories();
    const match = rows.find((r) => r.slug.toLowerCase() === clean);

    if (match) {
      const byParent = new Map<string, CategoryRow[]>();
      for (const row of rows) {
        if (!row.parentId) continue;
        const list = byParent.get(row.parentId) ?? [];
        list.push(row);
        byParent.set(row.parentId, list);
      }

      const subtree: CategoryRow[] = [];
      const walk = (node: CategoryRow) => {
        subtree.push(node);
        for (const child of byParent.get(node.id) ?? []) walk(child);
      };
      walk(match);

      const ancestors: { name: string; slug: string }[] = [];
      let cursor = match.parentId ? rows.find((r) => r.id === match.parentId) : undefined;
      // Guard against a cycle introduced by bad data rather than looping forever.
      let hops = 0;
      while (cursor && hops++ < 10) {
        ancestors.unshift({ name: cursor.name, slug: cursor.slug });
        cursor = cursor.parentId ? rows.find((r) => r.id === cursor!.parentId) : undefined;
      }

      return {
        slug: match.slug,
        name: match.name,
        description: match.description,
        icon: match.icon,
        accent: match.accent,
        categoryIds: subtree.map((c) => c.id),
        kinds: subtree
          .map((c) => c.kind)
          .filter((k): k is ComponentKind => !!k && isComponentKind(k)),
        ancestors,
      };
    }

    const aliased = CATEGORY_KIND_ALIASES[clean];
    const kinds = aliased ?? (isComponentKind(clean) ? [clean] : null);
    if (!kinds || !kinds.length) return null;

    const single = kinds.length === 1 ? KIND_META[kinds[0]] : null;
    return {
      slug: clean,
      name: single ? single.plural : titleCase(clean),
      description: single?.hint || null,
      icon: single?.icon ?? null,
      accent: null,
      categoryIds: [],
      kinds,
      ancestors: [],
    };
  },
);

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */

export type ProductListResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  facets: Facets;
  /** Resolved category scope, for headings and breadcrumbs. */
  scope: CategoryScope | null;
};

/** Pulls the row's value for one facet dimension as a comparable string. */
function facetValueOf(row: FacetRow, key: FacetKey): string | null {
  switch (key) {
    case "kind":
      return row.kind;
    case "brand":
      return row.brand?.slug ?? null;
    case "socket":
      return row.socket;
    case "chipset":
      return row.chipset;
    case "memoryType":
      return row.memoryType;
    case "vramGb":
      return row.vramGb === null ? null : String(row.vramGb);
    case "wattage":
      return row.wattage === null ? null : String(row.wattage);
    case "resolution":
      return row.resolution;
    case "refreshRate":
      return row.refreshRate === null ? null : String(row.refreshRate);
    case "panelSizeIn":
      return row.panelSizeIn === null ? null : String(row.panelSizeIn);
    case "formFactor":
      return row.formFactor;
    case "caseStyle":
      return row.caseStyle;
    case "storageInterface":
      return row.storageInterface;
  }
}

/** Human label for a bucket value — brands carry a display name, others format. */
function bucketLabel(key: FacetKey, value: string, brandNames: Map<string, string>): string {
  if (key === "brand") return brandNames.get(value) ?? value;
  if (key === "kind") return isComponentKind(value) ? KIND_META[value].plural : value;
  return FACET_DEFS[key].format(value);
}

type Predicate = (row: FacetRow) => boolean;

/**
 * Builds the in-memory predicates, one per dimension, so facet counting can
 * apply "every filter except this one" — the behaviour that lets a shopper
 * tick a second brand without the first one zeroing out the list.
 */
function buildPredicates(query: ProductQuery): Map<string, Predicate> {
  const preds = new Map<string, Predicate>();

  for (const key of FACET_KEYS) {
    const selected = query.facets?.[key];
    if (!selected?.length) continue;
    const set = new Set(selected);
    preds.set(key, (row) => {
      const value = facetValueOf(row, key);
      return value !== null && set.has(value);
    });
  }

  if (query.minPrice != null || query.maxPrice != null) {
    const min = query.minPrice ?? Number.NEGATIVE_INFINITY;
    const max = query.maxPrice ?? Number.POSITIVE_INFINITY;
    preds.set("price", (row) => {
      const paid = effectivePrice(row);
      return paid >= min && paid <= max;
    });
  }

  if (query.inStockOnly) preds.set("availability", (row) => row.stock > 0);
  if (query.minRating != null) {
    const min = query.minRating;
    preds.set("rating", (row) => row.rating >= min);
  }
  if (query.rgb != null) {
    const want = query.rgb;
    preds.set("rgb", (row) => row.rgb === want);
  }
  if (query.onDeal) preds.set("deal", (row) => row.onDeal || isDiscounted(row));
  if (query.isNew) preds.set("new", (row) => row.isNew);
  if (query.featuredOnly) preds.set("featured", (row) => row.featured);

  return preds;
}

function isDiscounted(row: { price: number; salePrice: number | null }): boolean {
  return row.salePrice !== null && row.salePrice > 0 && row.salePrice < row.price;
}

function passes(row: FacetRow, preds: Map<string, Predicate>, except?: string): boolean {
  for (const [key, pred] of preds) {
    if (key === except) continue;
    if (!pred(row)) return false;
  }
  return true;
}

function compareRows(a: FacetRow, b: FacetRow, sort: SortOption): number {
  switch (sort) {
    case "price-asc":
      return effectivePrice(a) - effectivePrice(b);
    case "price-desc":
      return effectivePrice(b) - effectivePrice(a);
    case "newest":
      return b.createdAt.getTime() - a.createdAt.getTime();
    case "rating":
      return b.rating - a.rating || b.reviewCount - a.reviewCount;
    case "name":
      return a.name.localeCompare(b.name, "en");
    case "featured":
    default:
      // Featured is the merchandising order: flagged products first, then the
      // best-rated, and anything unavailable sinks — nobody wants a wall of
      // sold-out cards at the top of a browse page.
      return (
        Number(b.stock > 0) - Number(a.stock > 0) ||
        Number(b.featured) - Number(a.featured) ||
        b.rating - a.rating ||
        b.createdAt.getTime() - a.createdAt.getTime()
      );
  }
}

/**
 * The one function every listing goes through. Returns the page of cards, the
 * true total and facet counts that never offer a filter yielding zero results.
 */
export async function getProducts(opts: ProductQuery = {}): Promise<ProductListResult> {
  const query = normalizeProductQuery(opts);

  const scope = query.category ? await getCategoryScope(query.category) : null;
  // An unresolvable category slug must not silently show the whole shop.
  if (query.category && !scope) {
    return {
      items: [],
      total: 0,
      page: 1,
      perPage: query.perPage ?? 24,
      pageCount: 0,
      facets: EMPTY_FACETS,
      scope: null,
    };
  }

  const where: Prisma.ProductWhereInput = { status: PUBLIC_STATUS };

  if (scope) {
    // Category membership wins whenever the scope resolves to real category rows.
    //
    // ORing kind in as well collapses sibling tiers into one listing:
    // `entry-gaming-pcs` declares kind "prebuilt", so `categoryId IN (entry) OR
    // kind = "prebuilt"` returns all six machines instead of the single entry
    // build. Kind is only a fallback for products filed under no category.
    if (scope.categoryIds.length) {
      where.categoryId = { in: scope.categoryIds };
    } else if (scope.kinds.length) {
      where.kind = { in: scope.kinds };
    }
  }

  const term = query.q?.trim();
  if (term) {
    // SQLite's LIKE is ASCII case-insensitive, which is what `contains` compiles
    // to. Prisma's `mode: "insensitive"` is Postgres-only, so it is left off to
    // keep this file portable across both providers.
    where.AND = [
      {
        OR: [
          { name: { contains: term } },
          { sku: { contains: term } },
          { headline: { contains: term } },
          { description: { contains: term } },
          { brand: { name: { contains: term } } },
        ],
      },
    ];
  }

  const rows = await prisma.product.findMany({
    where,
    select: FACET_SELECT,
    take: FACET_SCAN_LIMIT,
  });

  const preds = buildPredicates(query);
  const matched = rows.filter((row) => passes(row, preds));

  /* --- Facets ----------------------------------------------------------- */

  const brandNames = new Map<string, string>();
  for (const row of rows) {
    if (row.brand) brandNames.set(row.brand.slug, row.brand.name);
  }

  const buckets = {} as Record<FacetKey, FacetBucket[]>;
  for (const key of FACET_KEYS) {
    const pool = preds.has(key) ? rows.filter((row) => passes(row, preds, key)) : matched;
    const counts = new Map<string, number>();
    for (const row of pool) {
      const value = facetValueOf(row, key);
      if (value === null || value === "") continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const def = FACET_DEFS[key];
    const list: FacetBucket[] = Array.from(counts, ([value, count]) => ({
      value,
      label: bucketLabel(key, value, brandNames),
      count,
    }));

    list.sort((a, b) =>
      def.numeric
        ? Number(a.value) - Number(b.value)
        : a.label.localeCompare(b.label, "en"),
    );

    // A selected value stays visible even if it is the only one left, so the
    // shopper can always untick what they ticked.
    const selected = new Set(query.facets?.[key] ?? []);
    for (const value of selected) {
      if (!counts.has(value)) {
        list.push({ value, label: bucketLabel(key, value, brandNames), count: 0 });
      }
    }

    buckets[key] = list;
  }

  const pricePool = preds.has("price") ? rows.filter((r) => passes(r, preds, "price")) : matched;
  const prices = pricePool.map(effectivePrice);

  const availabilityPool = preds.has("availability")
    ? rows.filter((r) => passes(r, preds, "availability"))
    : matched;

  const rgbPool = preds.has("rgb") ? rows.filter((r) => passes(r, preds, "rgb")) : matched;

  const ratingPool = preds.has("rating")
    ? rows.filter((r) => passes(r, preds, "rating"))
    : matched;

  const facets: Facets = {
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    availability: {
      inStock: availabilityPool.filter((r) => r.stock > 0).length,
      outOfStock: availabilityPool.filter((r) => r.stock <= 0).length,
    },
    rgb: {
      yes: rgbPool.filter((r) => r.rgb).length,
      no: rgbPool.filter((r) => !r.rgb).length,
    },
    rating: RATING_STEPS.map((min) => ({
      value: String(min),
      label: `${min}★ & up`,
      count: ratingPool.filter((r) => r.rating >= min).length,
      // Never offer a rating filter that would empty the grid.
    })).filter((bucket) => bucket.count > 0),
    buckets,
  };

  /* --- Page ------------------------------------------------------------- */

  const sort = query.sort ?? "featured";
  const sorted = [...matched].sort((a, b) => compareRows(a, b, sort));

  const perPage = query.perPage ?? 24;
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const pageIds = sorted.slice((page - 1) * perPage, page * perPage).map((r) => r.id);

  const items = pageIds.length ? await getCardsByIds(pageIds) : [];

  return { items, total, page, perPage, pageCount, facets, scope };
}

/** Fetches cards for a set of ids and restores the requested order. */
async function getCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: CARD_SELECT,
  });
  const byId = new Map(rows.map((row) => [row.id, toCard(row)]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}

/* -------------------------------------------------------------------------- */
/* Single product                                                             */
/* -------------------------------------------------------------------------- */

export async function getProductBySlug(slug: string): Promise<FullProduct | null> {
  const product = await prisma.product.findFirst({
    where: { slug, status: PUBLIC_STATUS },
    include: PRODUCT_INCLUDE,
  });
  if (!product) return null;

  return {
    ...product,
    builderPart: toBuilderPart(product),
    card: toCard({
      ...product,
      brand: product.brand ? { name: product.brand.name } : null,
      images: product.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })),
    } as CardRow),
    specRows: parseSpecSheet(product.specSheet),
  };
}

/**
 * Related products: the same kind first (that is what a shopper is actually
 * cross-shopping), then anything else in the same category, ordered by how
 * close the price is to the product being viewed.
 */
export async function getRelatedProducts(
  product: Pick<FullProduct, "id" | "kind" | "categoryId" | "price" | "salePrice">,
  limit = 8,
): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: PUBLIC_STATUS,
      id: { not: product.id },
      OR: [
        { kind: product.kind },
        ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
      ],
    },
    select: CARD_SELECT,
    take: 60,
  });

  const anchor = effectivePrice(product);
  return rows
    .sort((a, b) => {
      const sameKind = Number(b.kind === product.kind) - Number(a.kind === product.kind);
      if (sameKind !== 0) return sameKind;
      const inStock = Number(b.stock > 0) - Number(a.stock > 0);
      if (inStock !== 0) return inStock;
      return (
        Math.abs(effectivePrice(a) - anchor) - Math.abs(effectivePrice(b) - anchor)
      );
    })
    .slice(0, limit)
    .map(toCard);
}

/* -------------------------------------------------------------------------- */
/* Builder + rails                                                            */
/* -------------------------------------------------------------------------- */

/** Every in-catalogue part of one kind, flattened for the compatibility engine. */
export async function getPartsForKind(kind: ComponentKind): Promise<BuilderPart[]> {
  const rows = await prisma.product.findMany({
    where: { kind, status: PUBLIC_STATUS },
    select: BUILDER_PART_SELECT,
    orderBy: [{ price: "asc" }],
    take: 500,
  });
  return rows.map(toBuilderPart);
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: { status: PUBLIC_STATUS, featured: true },
    select: CARD_SELECT,
    take: Math.max(1, Math.min(limit * 3, 60)),
  });

  // Featured but sold out is still a poor first impression on a rail.
  const ranked = rows.sort(
    (a, b) =>
      Number(b.stock > 0) - Number(a.stock > 0) ||
      b.rating - a.rating ||
      effectivePrice(b) - effectivePrice(a),
  );

  if (ranked.length >= limit) return ranked.slice(0, limit).map(toCard);

  // Not enough flagged products: top up with the best-rated in-stock items so
  // a rail never renders half empty.
  const fill = await prisma.product.findMany({
    where: {
      status: PUBLIC_STATUS,
      featured: false,
      stock: { gt: 0 },
      id: { notIn: ranked.map((r) => r.id) },
    },
    select: CARD_SELECT,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
    take: limit - ranked.length,
  });

  return [...ranked, ...fill].slice(0, limit).map(toCard);
}

export async function searchProducts(
  query: string,
  limit = 8,
): Promise<ProductCardData[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const rows = await prisma.product.findMany({
    where: {
      status: PUBLIC_STATUS,
      OR: [
        { name: { contains: term } },
        { sku: { contains: term } },
        { headline: { contains: term } },
        { brand: { name: { contains: term } } },
      ],
    },
    select: CARD_SELECT,
    take: Math.max(1, Math.min(limit * 4, 40)),
  });

  const needle = term.toLowerCase();
  return rows
    .sort((a, b) => {
      // A name that starts with the term is almost always the intended hit.
      const starts =
        Number(b.name.toLowerCase().startsWith(needle)) -
        Number(a.name.toLowerCase().startsWith(needle));
      if (starts !== 0) return starts;
      return Number(b.stock > 0) - Number(a.stock > 0) || b.rating - a.rating;
    })
    .slice(0, limit)
    .map(toCard);
}

/** Products Yalman has flagged as a deal, or that carry a real discount. */
export async function getDealProducts(limit = 48): Promise<ProductCardData[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: PUBLIC_STATUS,
      OR: [{ onDeal: true }, { salePrice: { not: null } }],
    },
    select: CARD_SELECT,
    take: 200,
  });

  return rows
    .filter((row) => row.onDeal || isDiscounted(row))
    .sort((a, b) => {
      const discount = (p: CardRow) =>
        isDiscounted(p) ? (p.price - (p.salePrice ?? p.price)) / p.price : 0;
      return (
        Number(b.stock > 0) - Number(a.stock > 0) || discount(b) - discount(a)
      );
    })
    .slice(0, limit)
    .map(toCard);
}

/* -------------------------------------------------------------------------- */
/* Comparison                                                                 */
/* -------------------------------------------------------------------------- */

/** Columns the comparison table draws on, beyond what a card already carries. */
const COMPARE_ATTR_KEYS = [
  "socket",
  "chipset",
  "cores",
  "threads",
  "baseClock",
  "boostClock",
  "tdp",
  "integratedGraphics",
  "memoryType",
  "memorySpeed",
  "memorySlots",
  "maxMemoryGb",
  "capacityGb",
  "moduleCount",
  "vramGb",
  "gpuLengthMm",
  "recommendedPsuW",
  "slotWidth",
  "storageInterface",
  "formFactorDrive",
  "formFactor",
  "m2Slots",
  "sataPorts",
  "pcieVersion",
  "wattage",
  "efficiency",
  "modular",
  "psuFormFactor",
  "psuLengthMm",
  "coolerType",
  "coolerHeightMm",
  "radiatorSizeMm",
  "coolingCapacityW",
  "maxGpuLengthMm",
  "maxCoolerHeightMm",
  "maxPsuLengthMm",
  "caseStyle",
  "dimensionsMm",
  "includedFans",
  "resolution",
  "refreshRate",
  "panelSizeIn",
  "panelType",
  "connectivity",
  "switchType",
  "rgb",
] as const;

/**
 * Full rows for the compare view. Capped at `MAX_COMPARE` because the table is
 * designed for four columns and anything more is unreadable on a phone.
 */
export async function getCompareProducts(ids: string[]): Promise<CompareProduct[]> {
  const wanted = Array.from(new Set(ids.filter(Boolean))).slice(0, MAX_COMPARE);
  if (!wanted.length) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: wanted }, status: PUBLIC_STATUS },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const byId = new Map(
    rows.map((row) => {
      const attrs: Record<string, CompareValue> = {};
      for (const key of COMPARE_ATTR_KEYS) {
        const value = (row as unknown as Record<string, unknown>)[key];
        attrs[key] =
          typeof value === "string" || typeof value === "number" || typeof value === "boolean"
            ? value
            : null;
      }

      const compare: CompareProduct = {
        ...toCard(row as unknown as CardRow),
        sku: row.sku,
        warranty: row.warranty,
        description: row.description,
        categoryName: row.category?.name ?? null,
        attrs,
        specs: parseSpecSheet(row.specSheet),
      };
      return [row.id, compare] as const;
    }),
  );

  // Preserve the order the shopper added them in.
  return wanted.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/* -------------------------------------------------------------------------- */
/* Small lookups                                                              */
/* -------------------------------------------------------------------------- */

export async function getProductSlugs(limit = 1000): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { status: PUBLIC_STATUS },
    select: { slug: true },
    take: limit,
  });
  return rows.map((r) => r.slug);
}

/** Minimal product record used when a client asks about a single item. */
export async function getCardBySlug(slug: string): Promise<ProductCardData | null> {
  const row = await prisma.product.findFirst({
    where: { slug, status: PUBLIC_STATUS },
    select: CARD_SELECT,
  });
  return row ? toCard(row) : null;
}
