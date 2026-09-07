/**
 * Yalman Gaming — order pricing and placement. Server only.
 *
 * The browser holds the cart, so nothing it sends is trusted here. Every line
 * is re-read from the database, every build is re-run through the
 * compatibility engine, every coupon is re-validated and the total is
 * recomputed from scratch. The client's numbers are never even looked at.
 *
 * Payment is expressed as a small abstraction (`PaymentHandler`) rather than a
 * switch buried in the checkout: adding a real gateway means adding one
 * handler here and nothing in the UI changes. No card data is collected
 * anywhere on this site — there is no gateway configured, and the card option
 * deliberately places the order as payment-pending instead.
 */

import { prisma } from "@/lib/db";
import { checkCompatibility } from "@/lib/compatibility";
import { BUILDER_PART_SELECT, parseJson, toBuilderPart } from "@/lib/specs";
import { ASSEMBLY_SERVICES, isComponentKind } from "@/lib/types";
import type { BuilderPart, BuildSelection, ComponentKind } from "@/lib/types";
import { effectivePrice, formatPKR, orderNumber } from "@/lib/utils";
import {
  DELIVERY_ESTIMATE_PKR,
  couponDiscount,
  type AppliedCoupon,
  type CartBuildComponent,
  type CartBuildMeta,
  type CartBuildService,
} from "@/lib/cart";
import type { CreateOrderInput, PaymentMethodId } from "@/lib/validation";
import { formatPkPhone } from "@/lib/validation";

/* -------------------------------------------------------------------------- */
/* Payment methods                                                            */
/* -------------------------------------------------------------------------- */

export type PaymentContext = {
  orderNumber: string;
  total: number;
  customerName: string;
  customerPhone: string;
  city: string;
};

export type PaymentPreparation = {
  /** Maps to `Order.paymentStatus`. */
  paymentStatus: "pending" | "paid";
  /** Maps to `Order.status`. */
  orderStatus: "pending" | "confirmed";
  /** Ordered steps shown to the customer on the confirmation page. */
  instructions: string[];
  /**
   * Where the customer is sent to pay. Null for every method today — a real
   * gateway returns its checkout URL here and the confirmation page will link
   * to it without any other change.
   */
  redirectUrl: string | null;
};

export type PaymentHandler = {
  id: PaymentMethodId;
  /**
   * Called once the order has been priced, immediately before it is written.
   * Kept synchronous for now; widen to a Promise when a gateway needs a
   * round-trip to create its payment intent.
   */
  prepare: (context: PaymentContext) => PaymentPreparation;
};

/**
 * Every order starts as `pending` regardless of method: Yalman Gaming confirms
 * stock and the delivery charge by phone before anything is dispatched, and no
 * money has moved at the point the order is created.
 */
export const PAYMENT_HANDLERS: Record<PaymentMethodId, PaymentHandler> = {
  cod: {
    id: "cod",
    prepare: (ctx) => ({
      paymentStatus: "pending",
      orderStatus: "pending",
      redirectUrl: null,
      instructions: [
        `Yalman Gaming will call ${formatPkPhone(ctx.customerPhone)} to confirm your order and the delivery charge for ${ctx.city}.`,
        `Pay ${formatPKR(ctx.total)} in cash when the order is handed over.`,
        "The amount above includes the delivery estimate, which the store confirms on that call.",
      ],
    }),
  },
  "bank-transfer": {
    id: "bank-transfer",
    prepare: (ctx) => ({
      paymentStatus: "pending",
      orderStatus: "pending",
      redirectUrl: null,
      instructions: [
        `Yalman Gaming will call ${formatPkPhone(ctx.customerPhone)} to confirm your order and share their bank account details.`,
        "Please do not transfer anything before that call — the account details are never sent by this website.",
        `Quote order ${ctx.orderNumber} as the transfer reference, then send the receipt on WhatsApp.`,
      ],
    }),
  },
  card: {
    id: "card",
    prepare: (ctx) => ({
      paymentStatus: "pending",
      orderStatus: "pending",
      // A configured gateway would return its hosted checkout URL here.
      redirectUrl: null,
      instructions: [
        "Your order is placed as payment pending. No card details were collected on this site.",
        `Yalman Gaming will send a secure payment link for ${formatPKR(ctx.total)} to the phone number and email you gave.`,
        "Open the link only from that message, and never share card details over chat or a call.",
      ],
    }),
  },
};

export function preparePayment(
  method: PaymentMethodId,
  context: PaymentContext,
): PaymentPreparation {
  return PAYMENT_HANDLERS[method].prepare(context);
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

export type OrderIssueCode =
  | "not-found"
  | "unavailable"
  | "out-of-stock"
  | "insufficient-stock"
  | "incompatible"
  | "empty"
  | "coupon"
  | "conflict";

export type OrderIssue = {
  /** The cart line the customer needs to fix, when the problem is line-level. */
  lineId: string | null;
  productId: string | null;
  code: OrderIssueCode;
  message: string;
};

export type PricedOrderLine = {
  lineId: string;
  kind: "product" | "build";
  productId: string | null;
  buildId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  meta: CartBuildMeta | null;
  samplePrice: boolean;
};

export type PricedOrder = {
  lines: PricedOrderLine[];
  /** productId -> total units this order consumes, across product and build lines. */
  required: Map<string, number>;
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: { id: string; code: string; maxUses: number | null } | null;
  /** True when any line is still carrying seeded sample pricing. */
  hasSamplePricing: boolean;
};

export type PriceOrderResult =
  | { ok: true; order: PricedOrder }
  | { ok: false; issues: OrderIssue[] };

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      payment: PaymentPreparation;
    }
  | { ok: false; issues: OrderIssue[] };

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

/** Product fields the pricing pass needs, on top of the builder attributes. */
const ORDER_PRODUCT_SELECT = {
  ...BUILDER_PART_SELECT,
  status: true,
} as const;

type OrderProduct = BuilderPart & { status: string };

async function loadProducts(ids: string[]): Promise<Map<string, OrderProduct>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: ORDER_PRODUCT_SELECT,
  });
  return new Map(
    rows.map((row) => [row.id, { ...toBuilderPart(row), status: row.status }]),
  );
}

function serviceById(id: string): CartBuildService | null {
  const service = ASSEMBLY_SERVICES.find((s) => s.id === id);
  return service
    ? { id: service.id, label: service.label, price: service.price }
    : null;
}

/**
 * Groups a build's components back into a `BuildSelection` using the *database*
 * kind of each product, never the client's claim about it. A component with a
 * quantity above one is repeated, because rules like "too many NVMe drives for
 * this board" count array entries.
 */
function selectionFromComponents(
  components: { productId: string; quantity: number }[],
  products: Map<string, OrderProduct>,
): BuildSelection {
  const selection: BuildSelection = {};
  for (const component of components) {
    const product = products.get(component.productId);
    if (!product) continue;
    const kind: ComponentKind = isComponentKind(product.kind)
      ? product.kind
      : "prebuilt";
    const bucket = (selection[kind] ??= []);
    for (let i = 0; i < component.quantity; i++) bucket.push(product);
  }
  return selection;
}

/**
 * Re-reads, re-checks and re-totals an order. Returns every problem it finds
 * rather than the first one, so the customer fixes their cart in a single pass
 * instead of playing whack-a-mole.
 */
export async function priceOrder(input: CreateOrderInput): Promise<PriceOrderResult> {
  const issues: OrderIssue[] = [];

  if (input.lines.length === 0) {
    return {
      ok: false,
      issues: [{ lineId: null, productId: null, code: "empty", message: "Your cart is empty." }],
    };
  }

  /* --- Load every referenced product in one query ------------------------- */
  const productIds = new Set<string>();
  const shareCodes = new Set<string>();
  for (const line of input.lines) {
    if (line.kind === "product") {
      productIds.add(line.productId);
    } else {
      for (const component of line.components) productIds.add(component.productId);
      if (line.shareCode) shareCodes.add(line.shareCode);
    }
  }

  const products = await loadProducts([...productIds]);

  // Link an ordered build back to its saved configuration when one exists, so
  // the admin can open the exact machine the customer configured.
  const builds =
    shareCodes.size > 0
      ? await prisma.customBuild.findMany({
          where: { shareCode: { in: [...shareCodes] } },
          select: { id: true, shareCode: true },
        })
      : [];
  const buildIdByShareCode = new Map(builds.map((b) => [b.shareCode, b.id]));

  /* --- Price each line ----------------------------------------------------- */
  const lines: PricedOrderLine[] = [];
  const required = new Map<string, number>();
  const need = (productId: string, units: number) =>
    required.set(productId, (required.get(productId) ?? 0) + units);

  for (const line of input.lines) {
    if (line.kind === "product") {
      const product = products.get(line.productId);
      if (!product) {
        issues.push({
          lineId: line.id,
          productId: line.productId,
          code: "not-found",
          message: "This product is no longer in the catalog. Remove it to continue.",
        });
        continue;
      }
      if (product.status !== "active") {
        issues.push({
          lineId: line.id,
          productId: product.id,
          code: "unavailable",
          message: `${product.name} is not available to order right now.`,
        });
        continue;
      }

      need(product.id, line.quantity);
      lines.push({
        lineId: line.id,
        kind: "product",
        productId: product.id,
        buildId: null,
        name: product.name,
        unitPrice: effectivePrice(product),
        quantity: line.quantity,
        meta: null,
        samplePrice: product.samplePrice,
      });
      continue;
    }

    /* --- Build line -------------------------------------------------------- */
    const missing = line.components.filter((c) => !products.has(c.productId));
    if (missing.length > 0) {
      issues.push({
        lineId: line.id,
        productId: missing[0].productId,
        code: "not-found",
        message: `${line.name}: ${missing.length} component${missing.length === 1 ? " is" : "s are"} no longer in the catalog. Reopen the build to reselect.`,
      });
      continue;
    }

    const inactive = line.components
      .map((c) => products.get(c.productId)!)
      .filter((p) => p.status !== "active");
    if (inactive.length > 0) {
      issues.push({
        lineId: line.id,
        productId: inactive[0].id,
        code: "unavailable",
        message: `${line.name}: ${inactive.map((p) => p.name).join(", ")} cannot be ordered right now.`,
      });
      continue;
    }

    const selection = selectionFromComponents(line.components, products);
    const report = checkCompatibility(selection);
    if (report.status === "error") {
      const blockers = report.issues.filter((i) => i.severity === "error");
      issues.push({
        lineId: line.id,
        productId: null,
        code: "incompatible",
        message: `${line.name}: ${blockers.map((b) => b.title).join("; ")}. Open the build to fix it before ordering.`,
      });
      continue;
    }

    const components: CartBuildComponent[] = line.components.map((component) => {
      const product = products.get(component.productId)!;
      return {
        productId: product.id,
        kind: isComponentKind(product.kind) ? product.kind : "prebuilt",
        name: product.name,
        quantity: component.quantity,
        unitPrice: effectivePrice(product),
      };
    });

    const services = line.services
      .map(serviceById)
      .filter((service): service is CartBuildService => service !== null);

    const componentsSubtotal = components.reduce(
      (sum, c) => sum + c.unitPrice * c.quantity,
      0,
    );
    const servicesSubtotal = services.reduce((sum, s) => sum + s.price, 0);

    for (const component of components) {
      need(component.productId, component.quantity * line.quantity);
    }

    const meta: CartBuildMeta = {
      buildName: line.name,
      shareCode: line.shareCode ?? null,
      goal: null,
      resolution: null,
      targetFps: null,
      components,
      services,
      componentsSubtotal,
      servicesSubtotal,
      estimatedWatts: report.power.estimatedWatts,
      recommendedPsuW: report.power.recommendedPsuW,
      samplePrice: components.some(
        (c) => products.get(c.productId)?.samplePrice ?? true,
      ),
      compatibility: {
        status: report.status,
        issues: report.issues.map((issue) => ({
          id: issue.id,
          severity: issue.severity,
          title: issue.title,
        })),
      },
    };

    lines.push({
      lineId: line.id,
      kind: "build",
      productId: null,
      buildId: line.shareCode ? (buildIdByShareCode.get(line.shareCode) ?? null) : null,
      name: line.name,
      unitPrice: componentsSubtotal + servicesSubtotal,
      quantity: line.quantity,
      meta,
      samplePrice: meta.samplePrice,
    });
  }

  /* --- Stock, aggregated across product and build lines -------------------- */
  for (const [productId, units] of required) {
    const product = products.get(productId);
    if (!product) continue; // already reported as not-found
    if (product.stock >= units) continue;

    issues.push({
      lineId: null,
      productId,
      code: product.stock <= 0 ? "out-of-stock" : "insufficient-stock",
      message:
        product.stock <= 0
          ? `${product.name} is out of stock.`
          : `${product.name}: only ${product.stock} left, but this order needs ${units}.`,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  /* --- Coupon -------------------------------------------------------------- */
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let coupon: PricedOrder["coupon"] = null;
  let discount = 0;

  if (input.couponCode) {
    const result = await validateCoupon(input.couponCode, subtotal);
    if (!result.ok) {
      return {
        ok: false,
        issues: [{ lineId: null, productId: null, code: "coupon", message: result.message }],
      };
    }
    coupon = { id: result.id, code: result.coupon.code, maxUses: result.maxUses };
    discount = couponDiscount(subtotal, result.coupon);
  }

  const delivery = DELIVERY_ESTIMATE_PKR;

  return {
    ok: true,
    order: {
      lines,
      required,
      subtotal,
      discount,
      delivery,
      total: Math.max(0, subtotal - discount) + delivery,
      coupon,
      hasSamplePricing: lines.some((line) => line.samplePrice),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Coupons                                                                    */
/* -------------------------------------------------------------------------- */

export type CouponValidation =
  | {
      ok: true;
      id: string;
      maxUses: number | null;
      coupon: AppliedCoupon;
      discount: number;
    }
  | { ok: false; message: string };

/**
 * Checks a code against the `Coupon` table: it must exist, be active, be
 * inside its date window, have uses left and clear its minimum spend. The
 * message returned is customer-facing, so it says which condition failed
 * without leaking the coupon's configuration.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<CouponValidation> {
  const row = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!row || !row.active) {
    return { ok: false, message: "That coupon code is not valid." };
  }

  const now = new Date();
  if (row.startsAt && row.startsAt > now) {
    return { ok: false, message: "That coupon is not active yet." };
  }
  if (row.expiresAt && row.expiresAt < now) {
    return { ok: false, message: "That coupon has expired." };
  }
  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return { ok: false, message: "That coupon has been fully redeemed." };
  }
  if (row.minSpend !== null && subtotal < row.minSpend) {
    return {
      ok: false,
      message: `Spend ${formatPKR(row.minSpend)} to use this coupon.`,
    };
  }

  const coupon: AppliedCoupon = {
    code: row.code,
    description: row.description,
    discountType: row.discountType === "fixed" ? "fixed" : "percent",
    discountValue: row.discountValue,
    minSpend: row.minSpend,
  };

  return {
    ok: true,
    id: row.id,
    maxUses: row.maxUses,
    coupon,
    discount: couponDiscount(subtotal, coupon),
  };
}

/* -------------------------------------------------------------------------- */
/* Placement                                                                  */
/* -------------------------------------------------------------------------- */

/** Thrown inside the transaction so the whole thing rolls back cleanly. */
class OrderConflictError extends Error {
  issues: OrderIssue[];
  constructor(issues: OrderIssue[]) {
    super(issues[0]?.message ?? "Order conflict");
    this.name = "OrderConflictError";
    this.issues = issues;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Prices the order, then writes it.
 *
 * Stock is decremented with a conditional `updateMany` inside the transaction:
 * if two customers race for the last card, the second update matches zero rows
 * and the whole order rolls back rather than overselling. The same guard is
 * applied to a coupon's `maxUses`.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const priced = await priceOrder(input);
  if (!priced.ok) return priced;

  const order = priced.order;
  const { customer } = input;

  for (let attempt = 0; attempt < 5; attempt++) {
    const number = orderNumber();
    const payment = preparePayment(input.paymentMethod, {
      orderNumber: number,
      total: order.total,
      customerName: customer.name,
      customerPhone: customer.phone,
      city: customer.city,
    });

    try {
      const created = await prisma.$transaction(async (tx) => {
        for (const [productId, units] of order.required) {
          const result = await tx.product.updateMany({
            where: { id: productId, stock: { gte: units } },
            data: { stock: { decrement: units } },
          });
          if (result.count === 0) {
            const product = await tx.product.findUnique({
              where: { id: productId },
              select: { name: true, stock: true },
            });
            throw new OrderConflictError([
              {
                lineId: null,
                productId,
                code: "insufficient-stock",
                message: product
                  ? `${product.name} sold out while you were checking out — only ${Math.max(0, product.stock)} left.`
                  : "An item in your cart is no longer available.",
              },
            ]);
          }
        }

        if (order.coupon) {
          const result = await tx.coupon.updateMany({
            where:
              order.coupon.maxUses === null
                ? { id: order.coupon.id }
                : { id: order.coupon.id, usedCount: { lt: order.coupon.maxUses } },
            data: { usedCount: { increment: 1 } },
          });
          if (result.count === 0) {
            throw new OrderConflictError([
              {
                lineId: null,
                productId: null,
                code: "coupon",
                message: "That coupon was fully redeemed a moment ago. Remove it to continue.",
              },
            ]);
          }
        }

        return tx.order.create({
          data: {
            orderNumber: number,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            addressLine1: customer.addressLine1,
            addressLine2: customer.addressLine2,
            city: customer.city,
            province: customer.province,
            postal: customer.postal,
            instructions: customer.instructions,
            paymentMethod: input.paymentMethod,
            paymentStatus: payment.paymentStatus,
            status: payment.orderStatus,
            subtotal: order.subtotal,
            delivery: order.delivery,
            discount: order.discount,
            total: order.total,
            couponCode: order.coupon?.code ?? null,
            // An internal flag for the store, not shown to the customer.
            notes: order.hasSamplePricing
              ? "Contains sample-priced items — confirm pricing before dispatch."
              : null,
            items: {
              create: order.lines.map((line) => ({
                productId: line.productId,
                buildId: line.buildId,
                name: line.name,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                meta: line.meta ? JSON.stringify(line.meta) : null,
              })),
            },
          },
          select: { id: true, orderNumber: true, total: true },
        });
      });

      return {
        ok: true,
        orderId: created.id,
        orderNumber: created.orderNumber,
        total: created.total,
        payment,
      };
    } catch (error) {
      if (error instanceof OrderConflictError) {
        return { ok: false, issues: error.issues };
      }
      // Two orders generated the same number in the same millisecond — the
      // random suffix makes this vanishingly rare, but retry rather than fail.
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }

  return {
    ok: false,
    issues: [
      {
        lineId: null,
        productId: null,
        code: "conflict",
        message: "We could not place your order just now. Please try again.",
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Reading an order back                                                      */
/* -------------------------------------------------------------------------- */

/** Safely reads the JSON snapshot stored on a build order item. */
export function parseOrderItemMeta(value: string | null): CartBuildMeta | null {
  if (!value) return null;
  const parsed = parseJson<CartBuildMeta | null>(value, null);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.components)) {
    return null;
  }
  return parsed;
}

export async function getOrderByNumber(number: string) {
  return prisma.order.findUnique({
    where: { orderNumber: number.trim().toUpperCase() },
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
          product: { select: { slug: true, samplePrice: true } },
        },
      },
    },
  });
}

export type OrderWithItems = NonNullable<Awaited<ReturnType<typeof getOrderByNumber>>>;
