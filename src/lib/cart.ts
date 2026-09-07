/**
 * Yalman Gaming — cart model.
 *
 * Pure, serialisable and framework-free so the exact same code runs in the
 * browser (where the cart actually lives, in `localStorage`) and on the server
 * (where every figure is recomputed from the database before an order is
 * written). Nothing here touches React or Prisma.
 *
 * A cart line is one of two things:
 *   product — a single catalog item with a quantity.
 *   build   — an entire custom PC: its component list, chosen assembly
 *             services, wattage and a snapshot of the compatibility report.
 */

import type {
  BuildSelection,
  BuildState,
  CompatibilityReport,
  ComponentKind,
  IssueSeverity,
} from "./types";
import { ASSEMBLY_SERVICES } from "./types";
import { allParts, partPrice } from "./compatibility";
import { effectivePrice, shareCode } from "./utils";
import type { OrderLineInput, PaymentMethodId } from "./validation";
import { MAX_LINE_QTY } from "./validation";

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

/** Bump the suffix if the persisted shape ever changes incompatibly. */
export const CART_STORAGE_KEY = "yalman:cart:v1";

/** Checkout details are kept separately so clearing the cart does not wipe them. */
export const CHECKOUT_STORAGE_KEY = "yalman:checkout:v1";

/* -------------------------------------------------------------------------- */
/* Line shapes                                                                */
/* -------------------------------------------------------------------------- */

export type CartLineKind = "product" | "build";

export type CartBuildComponent = {
  productId: string;
  kind: ComponentKind;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type CartBuildService = {
  id: string;
  label: string;
  price: number;
};

/** JSON snapshot stored on a build line — mirrors `CartItem.meta` / `OrderItem.meta`. */
export type CartBuildMeta = {
  buildName: string;
  shareCode: string | null;
  goal: string | null;
  resolution: string | null;
  targetFps: number | null;
  components: CartBuildComponent[];
  services: CartBuildService[];
  componentsSubtotal: number;
  servicesSubtotal: number;
  estimatedWatts: number;
  recommendedPsuW: number;
  /** True while any component still carries seeded sample pricing. */
  samplePrice: boolean;
  /**
   * The compatibility verdict at the moment the build entered the cart. It is
   * a record of what the customer was shown — the server re-runs the engine
   * from scratch before accepting the order and never trusts this.
   */
  compatibility: {
    status: CompatibilityReport["status"];
    issues: { id: string; severity: IssueSeverity; title: string }[];
  };
};

export type CartLine = {
  /** Stable identity of the line itself, independent of the product. */
  id: string;
  kind: CartLineKind;
  /** Null on build lines — a build is many products. */
  productId: string | null;
  slug: string | null;
  name: string;
  /** What the customer pays per unit, after any sale price. */
  unitPrice: number;
  /** Pre-discount price when the item is on sale, else null. */
  listPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  /** How many units the store had when the line was added / last revalidated. */
  stock: number;
  samplePrice: boolean;
  meta: CartBuildMeta | null;
  addedAt: number;
  /** Set by a server revalidation when the price moved since it was added. */
  priceChanged?: boolean;
};

/**
 * The minimum a caller needs to hand `addProduct`. `ProductCardData` from
 * `@/components/shop/ProductCard` satisfies this structurally, so a product
 * card can pass its own data straight through.
 */
export type CartProductInput = {
  id: string;
  slug: string;
  name: string;
  price: number;
  salePrice?: number | null;
  samplePrice?: boolean;
  stock?: number;
  imageUrl?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Line construction                                                          */
/* -------------------------------------------------------------------------- */

function newLineId(): string {
  return `L-${Date.now().toString(36)}-${shareCode(4)}`;
}

export function clampQuantity(qty: number, stock?: number): number {
  const ceiling =
    typeof stock === "number" && stock > 0 ? Math.min(MAX_LINE_QTY, stock) : MAX_LINE_QTY;
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(Math.round(qty), ceiling));
}

export function lineFromProduct(
  product: CartProductInput,
  quantity = 1,
): CartLine {
  const paying = effectivePrice(product);
  return {
    id: newLineId(),
    kind: "product",
    productId: product.id,
    slug: product.slug,
    name: product.name,
    unitPrice: paying,
    listPrice: paying < product.price ? product.price : null,
    quantity: clampQuantity(quantity, product.stock),
    imageUrl: product.imageUrl ?? null,
    stock: product.stock ?? 0,
    samplePrice: product.samplePrice ?? true,
    meta: null,
    addedAt: Date.now(),
  };
}

/** Assembly services the customer actually opted into, priced from the catalog. */
export function selectedServices(build: BuildState): CartBuildService[] {
  const ids = new Set(build.services);
  // "Assemble it for me" is the headline toggle; it implies the assembly line
  // item even if the service list was never touched.
  if (build.assembleForMe) ids.add("assembly");

  return ASSEMBLY_SERVICES.filter((service) => ids.has(service.id)).map(
    (service) => ({ id: service.id, label: service.label, price: service.price }),
  );
}

/** Flattens a build's selection into the component rows stored on the line. */
export function buildComponents(selection: BuildSelection): CartBuildComponent[] {
  const rows = new Map<string, CartBuildComponent>();
  for (const part of allParts(selection)) {
    const existing = rows.get(part.id);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    rows.set(part.id, {
      productId: part.id,
      kind: part.kind,
      name: part.name,
      quantity: 1,
      unitPrice: partPrice(part),
    });
  }
  return [...rows.values()];
}

/**
 * A build's availability is its weakest link: if one component is out of stock
 * the whole machine is. Reported as "how many of this build could ship today".
 */
export function buildStock(components: CartBuildComponent[], stockById: Map<string, number>): number {
  if (components.length === 0) return 0;
  let available = Number.POSITIVE_INFINITY;
  for (const row of components) {
    const stock = stockById.get(row.productId) ?? 0;
    available = Math.min(available, Math.floor(stock / row.quantity));
  }
  return Number.isFinite(available) ? Math.max(0, available) : 0;
}

export function lineFromBuild(
  build: BuildState,
  report: CompatibilityReport,
): CartLine {
  const components = buildComponents(build.selection);
  const services = selectedServices(build);
  const componentsSubtotal = components.reduce(
    (sum, row) => sum + row.unitPrice * row.quantity,
    0,
  );
  const servicesSubtotal = services.reduce((sum, row) => sum + row.price, 0);

  const parts = allParts(build.selection);
  const stockById = new Map(parts.map((p) => [p.id, p.stock]));

  const meta: CartBuildMeta = {
    buildName: build.name?.trim() || "Custom Build",
    shareCode: build.shareCode,
    goal: build.goal,
    resolution: build.resolution,
    targetFps: build.targetFps,
    components,
    services,
    componentsSubtotal,
    servicesSubtotal,
    estimatedWatts: report.power.estimatedWatts,
    recommendedPsuW: report.power.recommendedPsuW,
    samplePrice: parts.some((p) => p.samplePrice),
    compatibility: {
      status: report.status,
      issues: report.issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        title: issue.title,
      })),
    },
  };

  return {
    id: newLineId(),
    kind: "build",
    productId: null,
    slug: build.shareCode ? `/build/${build.shareCode}` : null,
    name: meta.buildName,
    unitPrice: componentsSubtotal + servicesSubtotal,
    listPrice: null,
    quantity: 1,
    imageUrl: parts.find((p) => p.kind === "case")?.imageUrl ?? parts[0]?.imageUrl ?? null,
    stock: buildStock(components, stockById),
    samplePrice: parts.some((p) => p.samplePrice),
    meta,
    addedAt: Date.now(),
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations (pure — they return a new array)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Adds a line, merging into an existing line for the same product rather than
 * stacking duplicates. Builds never merge: two custom PCs with the same parts
 * are still two distinct configurations to the customer.
 */
export function addLine(items: CartLine[], incoming: CartLine): CartLine[] {
  if (incoming.kind === "product" && incoming.productId) {
    const index = items.findIndex(
      (line) => line.kind === "product" && line.productId === incoming.productId,
    );
    if (index >= 0) {
      const next = [...items];
      const merged = next[index];
      next[index] = {
        ...merged,
        // Refresh price and stock from the newer snapshot; the customer should
        // never be quoted a figure we know is stale.
        unitPrice: incoming.unitPrice,
        listPrice: incoming.listPrice,
        stock: incoming.stock,
        samplePrice: incoming.samplePrice,
        quantity: clampQuantity(merged.quantity + incoming.quantity, incoming.stock),
      };
      return next;
    }
  }
  return [...items, incoming];
}

export function updateLineQty(
  items: CartLine[],
  lineId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return removeLine(items, lineId);
  return items.map((line) =>
    line.id === lineId
      ? { ...line, quantity: clampQuantity(quantity, line.stock) }
      : line,
  );
}

export function removeLine(items: CartLine[], lineId: string): CartLine[] {
  return items.filter((line) => line.id !== lineId);
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export function cartCount(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

/**
 * Flat delivery estimate.
 *
 * Yalman Gaming has not published a delivery price list, so this mirrors the
 * seeded `delivery` assembly service and is labelled everywhere as an estimate
 * the store confirms when it calls. No timeframe is stated or implied.
 */
const DELIVERY_SERVICE = ASSEMBLY_SERVICES.find((s) => s.id === "delivery");
export const DELIVERY_ESTIMATE_PKR = DELIVERY_SERVICE?.price ?? 2_500;
export const DELIVERY_LABEL = "Delivery (estimate)";
export const DELIVERY_NOTE =
  "A flat estimate. Yalman Gaming confirms the actual delivery charge for your city when they call about your order.";

/** Coupon fields the browser is allowed to know about. */
export type AppliedCoupon = {
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minSpend: number | null;
};

/**
 * Whole-rupee discount for a subtotal. Returns 0 when the cart has fallen back
 * under the coupon's minimum spend, which happens naturally as quantities
 * change — the coupon simply stops applying rather than silently going wrong.
 */
export function couponDiscount(
  subtotal: number,
  coupon: AppliedCoupon | null | undefined,
): number {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.minSpend != null && subtotal < coupon.minSpend) return 0;

  const raw =
    coupon.discountType === "percent"
      ? Math.round((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;

  // A discount can never exceed the goods value, and never touches delivery.
  return Math.max(0, Math.min(Math.round(raw), subtotal));
}

export type CartTotals = {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  count: number;
};

export function cartTotals(
  items: CartLine[],
  coupon?: AppliedCoupon | null,
): CartTotals {
  const subtotal = cartSubtotal(items);
  const discount = couponDiscount(subtotal, coupon);
  const delivery = items.length > 0 ? DELIVERY_ESTIMATE_PKR : 0;
  return {
    subtotal,
    discount,
    delivery,
    total: Math.max(0, subtotal - discount) + delivery,
    count: cartCount(items),
  };
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                              */
/* -------------------------------------------------------------------------- */

export type PersistedCart = {
  v: 1;
  items: CartLine[];
  coupon: AppliedCoupon | null;
};

/**
 * Reads a persisted cart defensively. Anything unrecognised — a hand-edited
 * localStorage entry, a payload from an older build — degrades to an empty
 * cart instead of throwing during hydration.
 */
export function parsePersistedCart(raw: string | null): PersistedCart {
  const empty: PersistedCart = { v: 1, items: [], coupon: null };
  if (!raw) return empty;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;

    const source = parsed as Partial<PersistedCart>;
    const items = Array.isArray(source.items)
      ? source.items.filter(isCartLine).map((line) => ({
          ...line,
          quantity: clampQuantity(line.quantity, line.stock),
        }))
      : [];

    return { v: 1, items, coupon: isCoupon(source.coupon) ? source.coupon : null };
  } catch {
    return empty;
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.id === "string" &&
    (line.kind === "product" || line.kind === "build") &&
    typeof line.name === "string" &&
    typeof line.unitPrice === "number" &&
    Number.isFinite(line.unitPrice) &&
    typeof line.quantity === "number"
  );
}

function isCoupon(value: unknown): value is AppliedCoupon {
  if (!value || typeof value !== "object") return false;
  const coupon = value as Partial<AppliedCoupon>;
  return (
    typeof coupon.code === "string" &&
    (coupon.discountType === "percent" || coupon.discountType === "fixed") &&
    typeof coupon.discountValue === "number"
  );
}

/* -------------------------------------------------------------------------- */
/* Wire format                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reduces a cart line to the identifiers the server needs. Deliberately drops
 * every price, name and spec: `POST /api/orders` re-reads all of it from the
 * database, so there is nothing here worth tampering with.
 */
export function toOrderLine(line: CartLine): OrderLineInput | null {
  if (line.kind === "product") {
    if (!line.productId) return null;
    return {
      id: line.id,
      kind: "product",
      productId: line.productId,
      quantity: clampQuantity(line.quantity),
    };
  }

  const meta = line.meta;
  if (!meta || meta.components.length === 0) return null;
  return {
    id: line.id,
    kind: "build",
    name: meta.buildName.slice(0, 80),
    shareCode: meta.shareCode,
    quantity: clampQuantity(line.quantity),
    components: meta.components.map((component) => ({
      productId: component.productId,
      quantity: component.quantity,
    })),
    services: meta.services.map((service) => service.id),
  };
}

export function toOrderLines(items: CartLine[]): OrderLineInput[] {
  return items.map(toOrderLine).filter((line): line is OrderLineInput => line !== null);
}

/* -------------------------------------------------------------------------- */
/* Payment method presentation                                                */
/* -------------------------------------------------------------------------- */

/**
 * How each payment method is *described*. Kept here rather than in
 * `@/lib/orders` because the checkout UI is a client component and must not
 * pull the Prisma client into the browser bundle. The behaviour that goes with
 * each id lives in `@/lib/orders`.
 */
export type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  summary: string;
  detail: string;
  /** lucide-react icon name. */
  icon: string;
  /** Hidden from checkout entirely when false. */
  enabled: boolean;
  /**
   * True when completing the payment needs a provider that is not wired up
   * yet. The order is still placed; it is simply marked payment-pending and
   * the store follows up. No card data is ever collected on this site.
   */
  requiresGateway: boolean;
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    id: "cod",
    label: "Cash on Delivery",
    summary: "Pay in cash when your order is handed over.",
    detail:
      "Yalman Gaming calls to confirm your order, the stock and the delivery charge before anything is dispatched.",
    icon: "banknote",
    enabled: true,
    requiresGateway: false,
  },
  {
    id: "bank-transfer",
    label: "Bank Transfer",
    summary: "Transfer the amount to Yalman Gaming's account.",
    detail:
      "The team shares the account details when they confirm your order. Please do not transfer anything before that call.",
    icon: "landmark",
    enabled: true,
    requiresGateway: false,
  },
  {
    id: "card",
    label: "Card payment — we will send you a secure payment link",
    summary: "Credit or debit card, paid through a link.",
    detail:
      "No card details are entered on this website. Your order is placed as payment pending and Yalman Gaming sends a secure link to complete it.",
    icon: "credit-card",
    enabled: true,
    requiresGateway: true,
  },
];

export function paymentMethodOption(
  id: PaymentMethodId,
): PaymentMethodOption | undefined {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.id === id);
}
