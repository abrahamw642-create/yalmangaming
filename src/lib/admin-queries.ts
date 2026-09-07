/**
 * Yalman Gaming admin — data access. Server only.
 *
 * Every read the dashboard performs lives here, so a page component stays a
 * layout and the queries can be reasoned about (and indexed) in one place.
 * Nothing in this file writes: mutations go through the zod-validated route
 * handlers under `src/app/api/admin/**`, which all call `requireAdminApi()`
 * first.
 *
 * These queries deliberately show the store the *unflattering* numbers —
 * products still on seeded sample pricing, out-of-stock lines, unanswered
 * quotes — because those are the ones that need work.
 */

import { prisma } from "@/lib/db";
import { parseJson, parseSpecSheet, type SpecRow } from "@/lib/specs";
import { isComponentKind, KIND_META, type ComponentKind } from "@/lib/types";
import {
  ADMIN_PRODUCT_SORT_IDS,
  BUILD_STATUS_IDS,
  ORDER_STATUS_IDS,
  PRODUCT_FLAG_IDS,
  PRODUCT_STATUS_IDS,
  QUOTE_STATUS_IDS,
  type AdminProductSort,
  type BuildStatus,
  type OrderStatus,
  type ProductFlag,
  type ProductStatus,
  type QuoteStatus,
} from "@/components/admin/schema";

export const ADMIN_PAGE_SIZE = 25;

/* -------------------------------------------------------------------------- */
/* Paging helper                                                              */
/* -------------------------------------------------------------------------- */

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

function pageWindow(page: number | undefined, perPage = ADMIN_PAGE_SIZE) {
  const current = Math.max(1, Math.floor(page ?? 1));
  return { current, skip: (current - 1) * perPage, take: perPage };
}

function paged<T>(items: T[], total: number, page: number, perPage: number): Paged<T> {
  return {
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export type DashboardStats = {
  orders: { total: number; open: number; last30: number };
  /** Money actually committed: everything except cancelled orders. */
  revenue: { allTime: number; last30: number };
  quotes: { total: number; unanswered: number };
  builds: { total: number; last30: number };
  products: { total: number; active: number; draft: number };
  stock: { low: number; out: number };
  /** Seeded prices Yalman has not yet replaced. The first job on this system. */
  samplePriced: number;
  reviews: { pending: number; approved: number };
  benchmarks: number;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const since = daysAgo(30);
  const notCancelled = { status: { not: "cancelled" } } as const;

  const [
    ordersTotal,
    ordersOpen,
    ordersLast30,
    revenueAll,
    revenue30,
    quotesTotal,
    quotesUnanswered,
    buildsTotal,
    builds30,
    productsTotal,
    productsActive,
    productsDraft,
    lowStock,
    outOfStock,
    samplePriced,
    reviewsPending,
    reviewsApproved,
    benchmarks,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: ["pending", "confirmed", "building"] } },
    }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: notCancelled }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { ...notCancelled, createdAt: { gte: since } },
    }),
    prisma.quoteRequest.count(),
    prisma.quoteRequest.count({ where: { status: "new" } }),
    prisma.customBuild.count(),
    prisma.customBuild.count({ where: { createdAt: { gte: since } } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: "active" } }),
    prisma.product.count({ where: { status: "draft" } }),
    // Field reference: "stock has fallen to this product's own threshold",
    // which respects a per-product `lowStockAt` instead of a global guess.
    prisma.product.count({
      where: { stock: { gt: 0, lte: prisma.product.fields.lowStockAt } },
    }),
    prisma.product.count({ where: { stock: { lte: 0 } } }),
    prisma.product.count({ where: { samplePrice: true, status: { not: "archived" } } }),
    prisma.review.count({ where: { approved: false } }),
    prisma.review.count({ where: { approved: true } }),
    prisma.benchmark.count(),
  ]);

  return {
    orders: { total: ordersTotal, open: ordersOpen, last30: ordersLast30 },
    revenue: {
      allTime: revenueAll._sum.total ?? 0,
      last30: revenue30._sum.total ?? 0,
    },
    quotes: { total: quotesTotal, unanswered: quotesUnanswered },
    builds: { total: buildsTotal, last30: builds30 },
    products: { total: productsTotal, active: productsActive, draft: productsDraft },
    stock: { low: lowStock, out: outOfStock },
    samplePriced,
    reviews: { pending: reviewsPending, approved: reviewsApproved },
    benchmarks,
  };
}

/**
 * The four counts the sidebar shows as chips. Deliberately its own query set
 * rather than a slice of `getDashboardStats` — the shell renders on *every*
 * admin page, and eighteen aggregates per navigation would be wasteful.
 */
export type NavBadgeCounts = {
  samplePriced: number;
  openOrders: number;
  newQuotes: number;
  pendingReviews: number;
};

export async function getNavBadges(): Promise<NavBadgeCounts> {
  const [samplePriced, openOrders, newQuotes, pendingReviews] = await Promise.all([
    prisma.product.count({ where: { samplePrice: true, status: { not: "archived" } } }),
    prisma.order.count({ where: { status: { in: ["pending", "confirmed", "building"] } } }),
    prisma.quoteRequest.count({ where: { status: "new" } }),
    prisma.review.count({ where: { approved: false } }),
  ]);

  return { samplePriced, openOrders, newQuotes, pendingReviews };
}

export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      city: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      total: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
}

export type RecentOrder = Awaited<ReturnType<typeof getRecentOrders>>[number];

export async function getRecentQuotes(limit = 6) {
  return prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      phone: true,
      city: true,
      status: true,
      message: true,
      createdAt: true,
      build: { select: { shareCode: true, total: true } },
    },
  });
}

export type RecentQuote = Awaited<ReturnType<typeof getRecentQuotes>>[number];

/** Products at or below their own low-stock threshold, emptiest first. */
export async function getLowStockProducts(limit = 8) {
  return prisma.product.findMany({
    where: {
      status: { not: "archived" },
      stock: { lte: prisma.product.fields.lowStockAt },
    },
    orderBy: [{ stock: "asc" }, { price: "desc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      sku: true,
      kind: true,
      stock: true,
      lowStockAt: true,
      price: true,
      salePrice: true,
      samplePrice: true,
    },
  });
}

export type LowStockProduct = Awaited<ReturnType<typeof getLowStockProducts>>[number];

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export type AdminProductQuery = {
  q?: string;
  kind?: string;
  status?: string;
  categoryId?: string;
  brandId?: string;
  flag?: string;
  sort?: string;
  page?: number;
};

/** Narrows loose `searchParams` strings to the values the queries understand. */
export function normalizeProductQuery(raw: AdminProductQuery) {
  const asOne = <T extends string>(value: string | undefined, allowed: T[]): T | null =>
    value && (allowed as string[]).includes(value) ? (value as T) : null;

  return {
    q: raw.q?.trim() ? raw.q.trim().slice(0, 80) : null,
    kind: raw.kind && isComponentKind(raw.kind) ? (raw.kind as ComponentKind) : null,
    status: asOne<ProductStatus>(raw.status, PRODUCT_STATUS_IDS),
    categoryId: raw.categoryId?.trim() || null,
    brandId: raw.brandId?.trim() || null,
    flag: asOne<ProductFlag>(raw.flag, PRODUCT_FLAG_IDS),
    sort: asOne<AdminProductSort>(raw.sort, ADMIN_PRODUCT_SORT_IDS) ?? "updated",
    page: Math.max(1, Math.floor(Number(raw.page) || 1)),
  };
}

export type NormalizedProductQuery = ReturnType<typeof normalizeProductQuery>;

type ProductWhere = NonNullable<
  Parameters<typeof prisma.product.findMany>[0]
>["where"];

function productWhere(query: NormalizedProductQuery): ProductWhere {
  const where: Record<string, unknown> = {};

  if (query.q) {
    // SQLite's LIKE (what `contains` compiles to) is ASCII case-insensitive;
    // Prisma's `mode: "insensitive"` is Postgres-only so it is left off.
    where.OR = [
      { name: { contains: query.q } },
      { sku: { contains: query.q } },
      { slug: { contains: query.q } },
      { headline: { contains: query.q } },
      { brand: { name: { contains: query.q } } },
    ];
  }
  if (query.kind) where.kind = query.kind;
  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.brandId) where.brandId = query.brandId;

  switch (query.flag) {
    case "sample":
      where.samplePrice = true;
      break;
    case "low-stock":
      where.stock = { gt: 0, lte: prisma.product.fields.lowStockAt };
      break;
    case "out-of-stock":
      where.stock = { lte: 0 };
      break;
    case "on-sale":
      where.salePrice = { not: null };
      break;
    case "featured":
      where.featured = true;
      break;
    case "new":
      where.isNew = true;
      break;
    case "deal":
      where.onDeal = true;
      break;
    case "no-image":
      // Only placeholder art, or no image row at all.
      where.images = { every: { placeholder: true } };
      break;
    default:
      break;
  }

  return where as ProductWhere;
}

const PRODUCT_ORDER: Record<AdminProductSort, Record<string, "asc" | "desc">[]> = {
  updated: [{ updatedAt: "desc" }],
  created: [{ createdAt: "desc" }],
  name: [{ name: "asc" }],
  "price-desc": [{ price: "desc" }],
  "price-asc": [{ price: "asc" }],
  "stock-asc": [{ stock: "asc" }, { name: "asc" }],
};

export async function listAdminProducts(
  raw: AdminProductQuery,
): Promise<Paged<AdminProductRow> & { query: NormalizedProductQuery }> {
  const query = normalizeProductQuery(raw);
  const where = productWhere(query);
  const { current, skip, take } = pageWindow(query.page);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: PRODUCT_ORDER[query.sort],
      skip,
      take,
      select: {
        id: true,
        sku: true,
        slug: true,
        name: true,
        kind: true,
        status: true,
        price: true,
        salePrice: true,
        samplePrice: true,
        stock: true,
        lowStockAt: true,
        featured: true,
        isNew: true,
        onDeal: true,
        rating: true,
        reviewCount: true,
        updatedAt: true,
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        images: {
          select: { url: true, placeholder: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { ...paged(items, total, current, take), query };
}

export type AdminProductRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  price: number;
  salePrice: number | null;
  samplePrice: boolean;
  stock: number;
  lowStockAt: number;
  featured: boolean;
  isNew: boolean;
  onDeal: boolean;
  rating: number;
  reviewCount: number;
  updatedAt: Date;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string; slug: string } | null;
  images: { url: string; placeholder: boolean }[];
};

export async function getAdminProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      images: { orderBy: { sortOrder: "asc" } },
      benchmarks: { orderBy: [{ game: "asc" }, { resolution: "asc" }] },
      _count: { select: { reviews: true, orderItems: true, buildComponents: true } },
    },
  });
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

/** Brand and category pickers for the product form. */
export async function getProductFormOptions() {
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, kind: true, parentId: true },
    }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  // "Components › Graphics Cards" reads better in a flat <select> than a bare
  // leaf name, several of which repeat across branches.
  const labelled = categories.map((category) => {
    const parent = category.parentId ? byId.get(category.parentId) : null;
    return {
      ...category,
      label: parent ? `${parent.name} › ${category.name}` : category.name,
    };
  });
  labelled.sort((a, b) => a.label.localeCompare(b.label));

  return { brands, categories: labelled };
}

export type ProductFormOptions = Awaited<ReturnType<typeof getProductFormOptions>>;

/** The product page's spec table rows, for the editor. */
export function specRowsOf(specSheet: string | null): SpecRow[] {
  return parseSpecSheet(specSheet);
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export type AdminOrderQuery = { q?: string; status?: string; page?: number };

export async function listAdminOrders(raw: AdminOrderQuery) {
  const status = raw.status && (ORDER_STATUS_IDS as string[]).includes(raw.status)
    ? (raw.status as OrderStatus)
    : null;
  const q = raw.q?.trim().slice(0, 80) || null;
  const { current, skip, take } = pageWindow(raw.page);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { orderNumber: { contains: q.toUpperCase() } },
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { customerEmail: { contains: q } },
      { city: { contains: q } },
    ];
  }

  const [items, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        city: true,
        province: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        discount: true,
        delivery: true,
        total: true,
        couponCode: true,
        notes: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of counts) statusCounts[row.status] = row._count._all;

  return { ...paged(items, total, current, take), status, q, statusCounts };
}

export type AdminOrderRow = Awaited<ReturnType<typeof listAdminOrders>>["items"][number];

export async function getAdminOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          id: true,
          name: true,
          unitPrice: true,
          quantity: true,
          meta: true,
          productId: true,
          buildId: true,
          product: {
            select: { slug: true, sku: true, kind: true, samplePrice: true, stock: true },
          },
          build: { select: { shareCode: true, status: true } },
        },
      },
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/* -------------------------------------------------------------------------- */
/* Quotes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The flat snapshot `POST /api/quote` writes alongside every request. It is
 * kept because a quote must still be readable after the customer edits or
 * deletes the build it came from.
 */
export type QuoteSnapshotComponent = {
  kind: string;
  quantity: number;
  sku: string;
  name: string;
  unitPrice: number;
  samplePrice: boolean;
};

export type QuoteSnapshot = {
  name?: string;
  goal?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  resolution?: string | null;
  targetFps?: number | null;
  games?: string[];
  services?: string[];
  assembleForMe?: boolean;
  components?: QuoteSnapshotComponent[];
  componentsTotal?: number;
  servicesTotal?: number;
  total?: number;
  estimatedWatts?: number;
  recommendedPsuW?: number;
  compatibilityStatus?: string;
  shareCode?: string | null;
};

export function parseQuoteSnapshot(value: string | null): QuoteSnapshot | null {
  const parsed = parseJson<QuoteSnapshot | null>(value, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed;
}

/** A snapshot component list, with the kind resolved to its display label. */
export function snapshotRows(
  snapshot: QuoteSnapshot | null,
): { label: string; name: string; quantity: number; unitPrice: number; samplePrice: boolean }[] {
  if (!snapshot?.components?.length) return [];
  return snapshot.components.map((component) => ({
    label: isComponentKind(component.kind)
      ? KIND_META[component.kind].label
      : component.kind,
    name: component.name,
    quantity: component.quantity,
    unitPrice: component.unitPrice,
    samplePrice: component.samplePrice,
  }));
}

export type AdminQuoteQuery = { status?: string; page?: number };

export async function listAdminQuotes(raw: AdminQuoteQuery) {
  const status =
    raw.status && (QUOTE_STATUS_IDS as string[]).includes(raw.status)
      ? (raw.status as QuoteStatus)
      : null;
  const { current, skip, take } = pageWindow(raw.page);
  const where = status ? { status } : {};

  const [items, total, counts] = await Promise.all([
    prisma.quoteRequest.findMany({
      where,
      // New first, then oldest-first inside a status: the request that has been
      // waiting longest is the one to answer next.
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        build: {
          select: {
            id: true,
            shareCode: true,
            name: true,
            status: true,
            total: true,
            componentsTotal: true,
            servicesTotal: true,
            estimatedWatts: true,
            recommendedPsuW: true,
            _count: { select: { components: true } },
          },
        },
      },
    }),
    prisma.quoteRequest.count({ where }),
    prisma.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of counts) statusCounts[row.status] = row._count._all;

  return { ...paged(items, total, current, take), status, statusCounts };
}

export type AdminQuote = Awaited<ReturnType<typeof listAdminQuotes>>["items"][number];

/* -------------------------------------------------------------------------- */
/* Saved builds                                                               */
/* -------------------------------------------------------------------------- */

export type AdminBuildQuery = { status?: string; q?: string; page?: number };

export async function listAdminBuilds(raw: AdminBuildQuery) {
  const status =
    raw.status && (BUILD_STATUS_IDS as string[]).includes(raw.status)
      ? (raw.status as BuildStatus)
      : null;
  const q = raw.q?.trim().slice(0, 40) || null;
  const { current, skip, take } = pageWindow(raw.page);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { shareCode: { contains: q.toUpperCase() } },
      { name: { contains: q } },
    ];
  }

  const [items, total, counts] = await Promise.all([
    prisma.customBuild.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        shareCode: true,
        name: true,
        goal: true,
        status: true,
        total: true,
        componentsTotal: true,
        servicesTotal: true,
        estimatedWatts: true,
        recommendedPsuW: true,
        resolution: true,
        targetFps: true,
        createdAt: true,
        components: {
          select: {
            id: true,
            kind: true,
            quantity: true,
            unitPrice: true,
            product: { select: { id: true, name: true, slug: true, stock: true } },
          },
        },
        _count: { select: { quoteRequests: true, orderItems: true } },
      },
    }),
    prisma.customBuild.count({ where }),
    prisma.customBuild.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of counts) statusCounts[row.status] = row._count._all;

  return { ...paged(items, total, current, take), status, q, statusCounts };
}

export type AdminBuild = Awaited<ReturnType<typeof listAdminBuilds>>["items"][number];

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export type AdminReviewQuery = { state?: string; page?: number };

export async function listAdminReviews(raw: AdminReviewQuery) {
  const state = raw.state === "approved" || raw.state === "all" ? raw.state : "pending";
  const { current, skip, take } = pageWindow(raw.page);
  const where =
    state === "all" ? {} : state === "approved" ? { approved: true } : { approved: false };

  const [items, total, pending, approved] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        body: true,
        verified: true,
        approved: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true, rating: true, reviewCount: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { approved: false } }),
    prisma.review.count({ where: { approved: true } }),
  ]);

  return { ...paged(items, total, current, take), state, pending, approved };
}

export type AdminReview = Awaited<ReturnType<typeof listAdminReviews>>["items"][number];

/**
 * Products a review can be attached to. The whole catalogue is small enough
 * for one `<select>`, and the review count is shown so it is obvious which
 * products have never been reviewed.
 */
export async function listReviewTargets() {
  const rows = await prisma.product.findMany({
    where: { status: { not: "archived" } },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, kind: true, reviewCount: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    label: isComponentKind(row.kind) ? KIND_META[row.kind].label : row.kind,
    reviewCount: row.reviewCount,
  }));
}

export type ReviewTarget = Awaited<ReturnType<typeof listReviewTargets>>[number];

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listAdminCategories() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      kind: true,
      icon: true,
      accent: true,
      sortOrder: true,
      featured: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  // Roots first, each followed by its children — the same shape as the storefront
  // navigation, so an ordering mistake here is visible immediately.
  const roots = rows.filter((row) => !row.parentId || !byId.has(row.parentId));
  const ordered: (typeof rows)[number][] = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(...rows.filter((row) => row.parentId === root.id));
  }
  // Anything whose parent is missing still has to appear somewhere.
  for (const row of rows) if (!ordered.includes(row)) ordered.push(row);

  return ordered.map((row) => ({
    ...row,
    depth: row.parentId && byId.has(row.parentId) ? 1 : 0,
    parentName: row.parentId ? (byId.get(row.parentId)?.name ?? null) : null,
  }));
}

export type AdminCategory = Awaited<ReturnType<typeof listAdminCategories>>[number];

/* -------------------------------------------------------------------------- */
/* Showcase                                                                   */
/* -------------------------------------------------------------------------- */

export type ShowcaseComponentRow = { kind: string; name: string };

export function parseShowcaseComponents(value: string | null): ShowcaseComponentRow[] {
  const rows = parseJson<unknown>(value, []);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row): row is ShowcaseComponentRow =>
        !!row &&
        typeof row === "object" &&
        typeof (row as ShowcaseComponentRow).name === "string",
    )
    .map((row) => ({ kind: String(row.kind ?? ""), name: row.name }));
}

export async function listShowcaseBuilds() {
  return prisma.showcaseBuild.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export type AdminShowcaseBuild = Awaited<ReturnType<typeof listShowcaseBuilds>>[number];

/* -------------------------------------------------------------------------- */
/* Coupons                                                                    */
/* -------------------------------------------------------------------------- */

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export type AdminCoupon = Awaited<ReturnType<typeof listCoupons>>[number];

/* -------------------------------------------------------------------------- */
/* Benchmarks                                                                 */
/* -------------------------------------------------------------------------- */

export type AdminBenchmarkQuery = { q?: string; productId?: string; page?: number };

export async function listBenchmarks(raw: AdminBenchmarkQuery) {
  const q = raw.q?.trim().slice(0, 60) || null;
  const productId = raw.productId?.trim() || null;
  const { current, skip, take } = pageWindow(raw.page, 50);

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (q) {
    where.OR = [
      { game: { contains: q } },
      { source: { contains: q } },
      { product: { name: { contains: q } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.benchmark.findMany({
      where,
      orderBy: [{ product: { name: "asc" } }, { game: "asc" }, { resolution: "asc" }],
      skip,
      take,
      include: { product: { select: { id: true, name: true, kind: true, slug: true } } },
    }),
    prisma.benchmark.count({ where }),
  ]);

  return { ...paged(items, total, current, take), q, productId };
}

export type AdminBenchmark = Awaited<ReturnType<typeof listBenchmarks>>["items"][number];

/**
 * Products a benchmark can attach to. Restricted to the kinds whose numbers
 * mean anything in a gaming context — a mousepad has no frame rate.
 */
export async function listBenchmarkTargets() {
  const rows = await prisma.product.findMany({
    where: { kind: { in: ["gpu", "cpu", "prebuilt"] }, status: { not: "archived" } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      _count: { select: { benchmarks: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    label: isComponentKind(row.kind) ? KIND_META[row.kind].label : row.kind,
    benchmarkCount: row._count.benchmarks,
  }));
}

export type BenchmarkTarget = Awaited<ReturnType<typeof listBenchmarkTargets>>[number];

/** Kinds whose product pages show a benchmark table but have no rows yet. */
export async function getBenchmarkCoverage() {
  const [gpuTotal, gpuWith, cpuTotal, cpuWith] = await Promise.all([
    prisma.product.count({ where: { kind: "gpu", status: { not: "archived" } } }),
    prisma.product.count({
      where: { kind: "gpu", status: { not: "archived" }, benchmarks: { some: {} } },
    }),
    prisma.product.count({ where: { kind: "cpu", status: { not: "archived" } } }),
    prisma.product.count({
      where: { kind: "cpu", status: { not: "archived" }, benchmarks: { some: {} } },
    }),
  ]);

  return {
    gpu: { total: gpuTotal, covered: gpuWith },
    cpu: { total: cpuTotal, covered: cpuWith },
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export type SettingRow = {
  key: string;
  label: string;
  value: string | null;
  /** Never rendered — only whether it is present. */
  secret?: boolean;
  note?: string;
};

/**
 * A read-only view of the environment this deployment is running with.
 *
 * Secrets report presence and length only; nothing here ever prints a value
 * that could be copied out of a screenshot. There is no "save" — these are
 * environment variables, changed on the host and applied by a redeploy, and
 * pretending otherwise with an editable form would be a lie.
 */
export function getSettingsSnapshot(): { group: string; rows: SettingRow[] }[] {
  const present = (value: string | undefined): string | null =>
    value ? `Set (${value.length} characters)` : null;

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbKind = dbUrl.startsWith("postgres")
    ? "PostgreSQL"
    : dbUrl.startsWith("file:")
      ? "SQLite file"
      : dbUrl
        ? "Other"
        : null;

  return [
    {
      group: "Site",
      rows: [
        {
          key: "NEXT_PUBLIC_SITE_URL",
          label: "Public site URL",
          value: process.env.NEXT_PUBLIC_SITE_URL ?? null,
          note: "Used for canonical links, share URLs and structured data.",
        },
        {
          key: "NODE_ENV",
          label: "Environment",
          value: process.env.NODE_ENV ?? null,
          note: "Session cookies are only marked Secure in production.",
        },
      ],
    },
    {
      group: "Contact",
      rows: [
        {
          key: "NEXT_PUBLIC_STORE_PHONE",
          label: "Store phone (displayed)",
          value: process.env.NEXT_PUBLIC_STORE_PHONE ?? null,
          note: "Falls back to 0328 4400231 from src/lib/site.ts when unset.",
        },
        {
          key: "NEXT_PUBLIC_WHATSAPP_NUMBER",
          label: "WhatsApp number",
          value: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null,
          note: "E.164 without the plus, e.g. 923284400231.",
        },
      ],
    },
    {
      group: "Security",
      rows: [
        {
          key: "AUTH_SECRET",
          label: "Session signing secret",
          value: present(process.env.AUTH_SECRET),
          secret: true,
          note: "Rotating this signs everyone out immediately. Minimum 16 characters.",
        },
        {
          key: "ADMIN_EMAIL",
          label: "Seeded admin account",
          value: process.env.ADMIN_EMAIL ?? null,
          note: "Only used by the seed script. Changing it here does not rename an existing account.",
        },
        {
          key: "ADMIN_PASSWORD",
          label: "Seeded admin password",
          value: present(process.env.ADMIN_PASSWORD),
          secret: true,
          note: "Only read when the seed runs. Change it, then re-run the seed to reset the password.",
        },
      ],
    },
    {
      group: "Database",
      rows: [
        {
          key: "DATABASE_URL",
          label: "Connection",
          value: dbKind,
          secret: true,
          note: "The schema runs unchanged on SQLite and PostgreSQL.",
        },
      ],
    },
  ];
}
