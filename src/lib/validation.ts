/**
 * Yalman Gaming — shared request/form schemas.
 *
 * Every route handler under `src/app/api/**` validates its body with a schema
 * from this file, and the checkout form runs the *same* schema in the browser
 * so the customer sees a field-level message before the request is ever sent.
 * One definition, two runtimes — the two can never drift apart.
 *
 * Other areas may import from here (quote requests, stock alerts, the admin).
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Pakistan                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Provinces and federal territories, in the order Pakistani forms conventionally
 * list them (largest population first, then the territories).
 */
export const PK_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
] as const;

export type PkProvince = (typeof PK_PROVINCES)[number];

export const provinceSchema = z.enum(PK_PROVINCES, {
  errorMap: () => ({ message: "Select your province or territory" }),
});

/**
 * Reduces any of the ways a Pakistani mobile number gets typed to E.164.
 *
 * Accepts `03284400231`, `0328 4400231`, `0328-4400231`, `+923284400231`,
 * `00923284400231`, `923284400231` and the bare `3284400231`. Returns `null`
 * when the digits cannot be a PK mobile number (all of which are `03` + 9
 * digits), so callers can decide whether that is an error or just unknown.
 *
 * Landlines are deliberately not accepted: the store confirms every order over
 * a call or WhatsApp, and a landline breaks the WhatsApp half of that.
 */
export function normalizePkPhone(raw: string): string | null {
  // Strip everything a human might use as a separator, including the Urdu
  // keyboard's non-breaking space.
  let digits = raw.replace(/[\s ()\-.]/g, "");

  if (digits.startsWith("+92")) digits = digits.slice(3);
  else if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^3\d{9}$/.test(digits)) return null;
  return `+92${digits}`;
}

/** `+923284400231` → `0328 4400231`, the form Pakistani customers recognise. */
export function formatPkPhone(e164OrRaw: string): string {
  const normalized = normalizePkPhone(e164OrRaw);
  if (!normalized) return e164OrRaw;
  const local = `0${normalized.slice(3)}`; // +92 3284400231 -> 03284400231
  return `${local.slice(0, 4)} ${local.slice(4)}`;
}

/** Validates a PK mobile number and normalises it to E.164 in one step. */
export const pkPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((value, ctx) => {
    const normalized = normalizePkPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a Pakistani mobile number, like 0328 4400231",
      });
      return z.NEVER;
    }
    return normalized;
  });

/* -------------------------------------------------------------------------- */
/* Checkout details                                                           */
/* -------------------------------------------------------------------------- */

/** Optional free text that still must not be used to smuggle in a novel. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const customerDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(80, "Keep this under 80 characters"),
  phone: pkPhoneSchema,
  email: z
    .string()
    .trim()
    .max(120)
    .email("Enter a valid email address")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null)),
  addressLine1: z
    .string()
    .trim()
    .min(5, "Enter your house/flat number and street")
    .max(160, "Keep this under 160 characters"),
  addressLine2: optionalText(160),
  city: z
    .string()
    .trim()
    .min(2, "Enter your city")
    .max(60, "Keep this under 60 characters"),
  province: provinceSchema,
  postal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Postal codes in Pakistan are 5 digits")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  instructions: optionalText(400),
});

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;

/** The unvalidated shape the checkout form holds in React state. */
export type CustomerDetailsInput = {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postal: string;
  instructions: string;
};

export const EMPTY_CUSTOMER_DETAILS: CustomerDetailsInput = {
  name: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  postal: "",
  instructions: "",
};

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

/** Matches `Order.paymentMethod` in the Prisma schema. */
export const PAYMENT_METHOD_IDS = ["cod", "bank-transfer", "card"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const paymentMethodSchema = z.enum(PAYMENT_METHOD_IDS, {
  errorMap: () => ({ message: "Choose how you would like to pay" }),
});

/* -------------------------------------------------------------------------- */
/* Cart / order lines                                                         */
/* -------------------------------------------------------------------------- */

/** Nobody orders 40 graphics cards through a web form. Larger goes to /quote. */
export const MAX_LINE_QTY = 10;

const quantitySchema = z
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(MAX_LINE_QTY, `Maximum ${MAX_LINE_QTY} per line — ask us for a bulk quote`);

const productLineSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.literal("product"),
  productId: z.string().min(1).max(64),
  quantity: quantitySchema,
});

/**
 * A whole custom build as one line. Only identifiers travel — the server
 * re-reads every component from the database and re-runs the compatibility
 * engine, so nothing the client claims about price, specs or fitment is used.
 */
const buildLineSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.literal("build"),
  name: z.string().trim().min(1).max(80),
  shareCode: z.string().trim().max(24).nullable().optional(),
  quantity: quantitySchema,
  components: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(MAX_LINE_QTY),
      }),
    )
    .min(1, "A build needs at least one component")
    .max(40),
  services: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export const orderLineSchema = z.discriminatedUnion("kind", [
  productLineSchema,
  buildLineSchema,
]);

export type OrderLineInput = z.infer<typeof orderLineSchema>;

export const createOrderSchema = z.object({
  customer: customerDetailsSchema,
  paymentMethod: paymentMethodSchema,
  couponCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  lines: z
    .array(orderLineSchema)
    .min(1, "Your cart is empty")
    .max(30, "Too many lines — please split the order or ask us for a quote"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/* -------------------------------------------------------------------------- */
/* Cart revalidation + coupons                                                */
/* -------------------------------------------------------------------------- */

/**
 * Body for `POST /api/cart`. The cart lives in the browser, so before checkout
 * we hand the server the line identifiers and it hands back the authoritative
 * price, stock and name for each one.
 */
export const revalidateCartSchema = z.object({
  lines: z.array(orderLineSchema).max(30),
});

export const couponCheckSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a coupon code")
    .max(40)
    .transform((v) => v.toUpperCase()),
  subtotal: z.number().int().min(0),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Flattens a `ZodError` into `{ fieldName: firstMessage }` for form rendering.
 * Nested paths are joined with a dot so `customer.phone` stays addressable.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
