/**
 * Yalman Gaming admin — mutation payloads.
 *
 * Isomorphic on purpose: the editors in the browser and the route handlers
 * under `src/app/api/admin/**` import the *same* zod schemas, so a value the
 * form accepts is a value the server accepts. Nothing here touches Prisma or
 * React, which is what keeps it importable from both sides.
 *
 * The spec-column helpers at the bottom are the other half of the contract in
 * `@/components/admin/schema`: that file says which columns belong to which
 * kind, and these translate between the string values a form input holds and
 * the typed columns (and JSON *text* columns) the database stores.
 */

import { z } from "zod";

import {
  BENCHMARK_PRESETS,
  BENCHMARK_RESOLUTIONS,
  BUILD_STATUS_IDS,
  ORDER_STATUS_IDS,
  PAYMENT_STATUS_IDS,
  PRODUCT_STATUS_IDS,
  QUOTE_STATUS_IDS,
  SHOWCASE_TIERS,
  irrelevantSpecColumns,
  specFieldsForKind,
  type SpecColumn,
  type SpecField,
} from "@/components/admin/schema";
import {
  parseNumberMap,
  parseSpecSheet,
  parseStringList,
  stringifyList,
  stringifyMap,
} from "@/lib/specs";
import { COMPONENT_KINDS, type ComponentKind } from "@/lib/types";

/* ========================================================================== */
/* Shared field helpers                                                       */
/* ========================================================================== */

/** `z.enum` needs a non-empty tuple; our vocabularies are plain readonly arrays. */
function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

/** Optional free text where "" and undefined both mean "not set". */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null));

const nullableId = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

/** Whole Pakistani Rupees. No decimals exist anywhere in this system. */
const money = z
  .number()
  .int("Prices are whole rupees — no decimals")
  .min(0, "A price cannot be negative")
  .max(1_000_000_000, "That price looks wrong");

const nullableMoney = money.nullable().optional();

const nullableCount = (max: number) =>
  z.number().int().min(0).max(max).nullable().optional();

/**
 * `<input type="date">` sends `2026-09-04`, which `z.string().datetime()`
 * rejects. Accept anything `Date` can read and fail loudly on the rest.
 */
const nullableDate = z
  .string()
  .trim()
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
      return z.NEVER;
    }
    return date;
  });

const slugField = z
  .string()
  .trim()
  .min(2, "A slug needs at least 2 characters")
  .max(120, "Keep the slug under 120 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Lower-case letters, digits and single hyphens only",
  );

/**
 * `next.config.ts` declares `images.remotePatterns: []`, so `next/image`
 * throws on any absolute URL. Every image therefore has to be a file served
 * from `public/`, addressed root-relative.
 */
const imagePath = z
  .string()
  .trim()
  .min(1, "Enter an image path")
  .max(400, "That path is too long")
  .refine(
    (value) => value.startsWith("/"),
    "Image paths must start with / — this site serves no remote images",
  );

/* ========================================================================== */
/* Products                                                                   */
/* ========================================================================== */

export const productImageSchema = z.object({
  url: imagePath,
  alt: nullableText(200),
  /** Marks generated line art rather than a real photograph of the item. */
  placeholder: z.boolean().default(false),
});

export type ProductImageInput = z.input<typeof productImageSchema>;

export const specSheetRowSchema = z.object({
  group: z.string().trim().max(60).default("Specifications"),
  label: z.string().trim().min(1, "Every spec row needs a label").max(80),
  value: z.string().trim().min(1, "Every spec row needs a value").max(240),
});

export type SpecSheetRowInput = z.input<typeof specSheetRowSchema>;

/**
 * The only warranty text this site is allowed to state. Yalman Gaming has not
 * published durations or terms, so the editor offers exactly two choices and
 * the API rejects anything else rather than letting free text invent a policy.
 */
export const WARRANTY_OPTIONS = ["Manufacturer warranty"] as const;

const specValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const productWriteSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2, "Enter an SKU")
      .max(48)
      .regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dot, dash and underscore only"),
    slug: slugField,
    name: z.string().trim().min(2, "Enter a product name").max(160),
    headline: nullableText(200),
    description: nullableText(6000),
    kind: enumOf(COMPONENT_KINDS),

    brandId: nullableId,
    categoryId: nullableId,

    price: money,
    salePrice: nullableMoney,
    costPrice: nullableMoney,
    /** Cleared once Yalman confirms the real shelf price. */
    samplePrice: z.boolean(),

    stock: z.number().int().min(0, "Stock cannot be negative").max(100_000),
    lowStockAt: z.number().int().min(0).max(1_000),
    supplier: nullableText(120),
    warranty: enumOf(WARRANTY_OPTIONS).nullish().transform((v) => v ?? null),

    status: enumOf(PRODUCT_STATUS_IDS),
    featured: z.boolean(),
    isNew: z.boolean(),
    onDeal: z.boolean(),

    /** Raw form values, keyed by `SpecColumn`. Coerced by `specColumnUpdates`. */
    specs: z.record(specValue).default({}),
    images: z.array(productImageSchema).max(8, "Eight images is plenty").default([]),
    specSheet: z.array(specSheetRowSchema).max(80).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.salePrice !== null && value.salePrice !== undefined) {
      if (value.salePrice >= value.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["salePrice"],
          message: "A sale price has to be below the normal price",
        });
      }
    }
  });

export type ProductWriteInput = z.input<typeof productWriteSchema>;
export type ProductWrite = z.output<typeof productWriteSchema>;

/**
 * The inline edits the product table performs — one or two commerce fields at
 * a time, never the compatibility specs. Deliberately separate from the full
 * write so a stray key in a quick edit can never blank a spec column.
 */
export const productQuickPatchSchema = z.object({
  price: money.optional(),
  salePrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  lowStockAt: z.number().int().min(0).max(1_000).optional(),
  samplePrice: z.boolean().optional(),
  featured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  onDeal: z.boolean().optional(),
  status: enumOf(PRODUCT_STATUS_IDS).optional(),
});

export type ProductQuickPatch = z.infer<typeof productQuickPatchSchema>;

export const productPatchBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("quick"), patch: productQuickPatchSchema }),
  z.object({ mode: z.literal("full"), product: productWriteSchema }),
]);

/* -------------------------------------------------------------------------- */
/* Product editor state                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The product editor holds every field as a string, because that is what an
 * `<input>` holds. Coercion happens once, in `productFormToPayload`, so the
 * form never has to decide what an empty box means — the schema does.
 */
export type ProductFormImage = { url: string; alt: string; placeholder: boolean };
export type ProductFormSpecRow = { group: string; label: string; value: string };

export type ProductFormState = {
  sku: string;
  slug: string;
  name: string;
  headline: string;
  description: string;
  kind: ComponentKind;
  brandId: string;
  categoryId: string;
  price: string;
  salePrice: string;
  costPrice: string;
  samplePrice: boolean;
  stock: string;
  lowStockAt: string;
  supplier: string;
  warranty: string;
  status: string;
  featured: boolean;
  isNew: boolean;
  onDeal: boolean;
  specs: SpecFormValues;
  images: ProductFormImage[];
  specSheet: ProductFormSpecRow[];
};

/** Graphics cards are what the shop adds most often, so a new form starts there. */
export const DEFAULT_PRODUCT_KIND: ComponentKind = "gpu";

export function emptyProductForm(
  kind: ComponentKind = DEFAULT_PRODUCT_KIND,
): ProductFormState {
  return {
    sku: "",
    slug: "",
    name: "",
    headline: "",
    description: "",
    kind,
    brandId: "",
    categoryId: "",
    price: "",
    salePrice: "",
    costPrice: "",
    // A brand-new product is a real price the shopkeeper just typed, so it is
    // *not* sample data. Only the seed marks prices as samples.
    samplePrice: false,
    stock: "0",
    lowStockAt: "3",
    supplier: "",
    warranty: "",
    status: "draft",
    featured: false,
    isNew: false,
    onDeal: false,
    specs: emptySpecFormValues(kind),
    images: [],
    specSheet: [],
  };
}

/** Structural so this file never has to import Prisma's generated types. */
export type ProductRowLike = SpecColumnValues & {
  sku: string;
  slug: string;
  name: string;
  headline: string | null;
  description: string | null;
  kind: string;
  brandId: string | null;
  categoryId: string | null;
  price: number;
  salePrice: number | null;
  costPrice: number | null;
  samplePrice: boolean;
  stock: number;
  lowStockAt: number;
  supplier: string | null;
  warranty: string | null;
  status: string;
  featured: boolean;
  isNew: boolean;
  onDeal: boolean;
  specSheet: string | null;
  images: { url: string; alt: string | null; placeholder: boolean }[];
};

function asKind(value: string): ComponentKind {
  return (COMPONENT_KINDS as readonly string[]).includes(value)
    ? (value as ComponentKind)
    : DEFAULT_PRODUCT_KIND;
}

export function productFormFromRow(row: ProductRowLike): ProductFormState {
  const kind = asKind(row.kind);

  return {
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    headline: row.headline ?? "",
    description: row.description ?? "",
    kind,
    brandId: row.brandId ?? "",
    categoryId: row.categoryId ?? "",
    price: String(row.price),
    salePrice: row.salePrice === null ? "" : String(row.salePrice),
    costPrice: row.costPrice === null ? "" : String(row.costPrice),
    samplePrice: row.samplePrice,
    stock: String(row.stock),
    lowStockAt: String(row.lowStockAt),
    supplier: row.supplier ?? "",
    // Anything other than the one permitted phrase is dropped rather than
    // round-tripped, so legacy free text cannot survive an edit.
    warranty:
      row.warranty && (WARRANTY_OPTIONS as readonly string[]).includes(row.warranty)
        ? row.warranty
        : "",
    status: row.status,
    featured: row.featured,
    isNew: row.isNew,
    onDeal: row.onDeal,
    specs: specFormValues(kind, row),
    images: row.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
      placeholder: image.placeholder,
    })),
    specSheet: parseSpecSheet(row.specSheet).map((spec) => ({
      group: spec.group,
      label: spec.label,
      value: spec.value,
    })),
  };
}

function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Form state → the JSON body `productWriteSchema` validates. */
export function productFormToPayload(state: ProductFormState): ProductWriteInput {
  return {
    sku: state.sku,
    slug: state.slug,
    name: state.name,
    headline: state.headline || null,
    description: state.description || null,
    kind: state.kind,
    brandId: state.brandId || null,
    categoryId: state.categoryId || null,
    price: toInt(state.price) ?? 0,
    salePrice: toInt(state.salePrice),
    costPrice: toInt(state.costPrice),
    samplePrice: state.samplePrice,
    stock: toInt(state.stock) ?? 0,
    lowStockAt: toInt(state.lowStockAt) ?? 0,
    supplier: state.supplier || null,
    warranty: state.warranty
      ? (state.warranty as (typeof WARRANTY_OPTIONS)[number])
      : null,
    status: state.status as ProductWrite["status"],
    featured: state.featured,
    isNew: state.isNew,
    onDeal: state.onDeal,
    specs: state.specs,
    images: state.images
      .filter((image) => image.url.trim().length > 0)
      .map((image) => ({
        url: image.url.trim(),
        alt: image.alt.trim() || null,
        placeholder: image.placeholder,
      })),
    specSheet: state.specSheet
      .filter((row) => row.label.trim() && row.value.trim())
      .map((row) => ({
        group: row.group.trim() || "Specifications",
        label: row.label.trim(),
        value: row.value.trim(),
      })),
  };
}

/* ========================================================================== */
/* Orders                                                                     */
/* ========================================================================== */

export const orderPatchSchema = z
  .object({
    status: enumOf(ORDER_STATUS_IDS).optional(),
    paymentStatus: enumOf(PAYMENT_STATUS_IDS).optional(),
    notes: nullableText(1_000).optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    "Nothing to change",
  );

/* ========================================================================== */
/* Quotes                                                                     */
/* ========================================================================== */

export const quotePatchSchema = z
  .object({
    status: enumOf(QUOTE_STATUS_IDS).optional(),
    notes: nullableText(2_000).optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    "Nothing to change",
  );

/* ========================================================================== */
/* Saved builds                                                               */
/* ========================================================================== */

export const buildPatchSchema = z
  .object({
    status: enumOf(BUILD_STATUS_IDS).optional(),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    "Nothing to change",
  );

/* ========================================================================== */
/* Reviews                                                                    */
/* ========================================================================== */

/**
 * Reviews are typed in by the store from something a real customer actually
 * said. The seed creates none, and nothing on this site generates review text.
 */
export const reviewWriteSchema = z.object({
  productId: z.string().trim().min(1, "Choose the product this review is about").max(64),
  authorName: z.string().trim().min(2, "Enter the customer's name").max(80),
  rating: z
    .number()
    .int()
    .min(1, "A review is rated 1 to 5")
    .max(5, "A review is rated 1 to 5"),
  title: nullableText(120),
  body: z
    .string()
    .trim()
    .min(4, "Enter what the customer said")
    .max(2_000, "Keep this under 2000 characters"),
  /** True when the store can tie the review to an order it fulfilled. */
  verified: z.boolean().default(false),
  approved: z.boolean().default(false),
});

export const reviewPatchSchema = z.object({ approved: z.boolean() });

/* ========================================================================== */
/* Categories                                                                 */
/* ========================================================================== */

export const categoryWriteSchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(80),
  slug: slugField,
  description: nullableText(400),
  kind: enumOf(COMPONENT_KINDS)
    .nullish()
    .transform((value) => value ?? null),
  icon: nullableText(40),
  accent: nullableText(24),
  sortOrder: z.number().int().min(0).max(999).default(0),
  featured: z.boolean().default(false),
  parentId: nullableId,
});

export type CategoryWriteInput = z.input<typeof categoryWriteSchema>;

/* ========================================================================== */
/* Showcase builds                                                            */
/* ========================================================================== */

export const showcaseComponentSchema = z.object({
  kind: z.string().trim().max(32).default(""),
  name: z.string().trim().min(1, "Every component row needs a name").max(160),
});

export const showcaseWriteSchema = z.object({
  slug: slugField,
  name: z.string().trim().min(2, "Give this machine a name").max(120),
  tagline: nullableText(160),
  description: nullableText(2_000),
  tier: enumOf(SHOWCASE_TIERS)
    .nullish()
    .transform((value) => value ?? null),
  target: nullableText(60),
  price: nullableMoney,
  samplePrice: z.boolean().default(true),
  components: z.array(showcaseComponentSchema).max(30).default([]),
  imageUrl: imagePath.nullish().transform((value) => value ?? null),
  accent: nullableText(24),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export type ShowcaseWriteInput = z.input<typeof showcaseWriteSchema>;

/* ========================================================================== */
/* Coupons                                                                    */
/* ========================================================================== */

export const couponWriteSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "A code needs at least 3 characters")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, digits, dash and underscore only")
      .transform((value) => value.toUpperCase()),
    description: nullableText(200),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().int().min(1, "Enter a discount above zero").max(1_000_000),
    minSpend: nullableMoney,
    maxUses: nullableCount(100_000),
    active: z.boolean().default(true),
    startsAt: nullableDate,
    expiresAt: nullableDate,
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percent" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "A percentage discount cannot be over 100",
      });
    }
    if (value.startsAt && value.expiresAt && value.expiresAt <= value.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "The end date has to be after the start date",
      });
    }
  });

export type CouponWriteInput = z.input<typeof couponWriteSchema>;

/* ========================================================================== */
/* Benchmarks                                                                 */
/* ========================================================================== */

/**
 * `source` is required and cannot be blank. The storefront prints it next to
 * every figure — a benchmark without attribution is indistinguishable from an
 * invented one, and this site does not publish invented numbers.
 */
export const benchmarkWriteSchema = z.object({
  productId: z.string().trim().min(1, "Choose a product").max(64),
  game: z.string().trim().min(2, "Enter the game").max(80),
  resolution: enumOf(BENCHMARK_RESOLUTIONS),
  preset: enumOf(BENCHMARK_PRESETS),
  avgFps: z.number().int().min(1, "Enter the average FPS").max(2_000),
  onePercentLow: nullableCount(2_000),
  source: z
    .string()
    .trim()
    .min(4, "Say where this number came from — every figure is published with its source")
    .max(200),
  cpuContext: nullableText(120),
  notes: nullableText(400),
});

export type BenchmarkWriteInput = z.input<typeof benchmarkWriteSchema>;

/* ========================================================================== */
/* Sign in                                                                    */
/* ========================================================================== */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .max(200)
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
  /** Where to land afterwards. Validated again server-side by `loginHref`. */
  next: z.string().trim().max(400).optional(),
});

/* ========================================================================== */
/* Spec column translation                                                    */
/* ========================================================================== */

/** What every spec input holds: a string, including `"true"` / `"false"`. */
export type SpecFormValues = Record<string, string>;

/** The raw columns as Prisma hands them back for one product. */
export type SpecColumnValues = Partial<Record<SpecColumn, unknown>>;

/** Column values ready to hand to `prisma.product.update`. */
export type SpecColumnUpdate = Record<string, string | number | boolean | null>;

/**
 * `rgb` and `integratedGraphics` are non-nullable booleans in the schema, so
 * clearing them means `false` rather than `null`.
 */
const BOOLEAN_SPEC_COLUMNS: readonly SpecColumn[] = ["rgb", "integratedGraphics"];

function formatSpecValue(field: SpecField, value: unknown): string {
  if (field.type === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";

  switch (field.type) {
    case "list": {
      const list = parseStringList(typeof value === "string" ? value : null);
      return list ? list.join(", ") : "";
    }
    case "map": {
      const map = parseNumberMap(typeof value === "string" ? value : null);
      return map
        ? Object.entries(map)
            .map(([key, count]) => `${key} = ${count}`)
            .join("\n")
        : "";
    }
    default:
      return String(value);
  }
}

/** Fills the editor's spec inputs from a product row. */
export function specFormValues(
  kind: ComponentKind,
  row: SpecColumnValues,
): SpecFormValues {
  const values: SpecFormValues = {};
  for (const field of specFieldsForKind(kind)) {
    values[field.name] = formatSpecValue(field, row[field.name]);
  }
  return values;
}

/** Blank inputs for a kind — used when the editor switches kind. */
export function emptySpecFormValues(kind: ComponentKind): SpecFormValues {
  const values: SpecFormValues = {};
  for (const field of specFieldsForKind(kind)) {
    values[field.name] = field.type === "boolean" ? "false" : "";
  }
  return values;
}

/** `pcie8 = 4, 12vhpwr = 1` or one pair per line. */
function parseMapText(text: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const entry of text.split(/[,\n;]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)\s*[=:]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = Number(match[2]);
    if (key && Number.isFinite(value)) map[key] = value;
  }
  return map;
}

function coerceSpecValue(
  field: SpecField,
  raw: unknown,
): string | number | boolean | null {
  if (field.type === "boolean") {
    return raw === true || raw === "true" || raw === "on" || raw === 1;
  }

  const text =
    typeof raw === "string"
      ? raw.trim()
      : typeof raw === "number" && Number.isFinite(raw)
        ? String(raw)
        : "";
  if (!text) return null;

  switch (field.type) {
    case "int": {
      const parsed = Number.parseInt(text, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "float": {
      const parsed = Number.parseFloat(text);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "list":
      return stringifyList(
        text
          .split(/[,\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
    case "map":
      return stringifyMap(parseMapText(text));
    default:
      return text;
  }
}

/**
 * Turns the editor's spec inputs into column updates for `kind`, and clears
 * every column that kind does not use. That second half is what stops a
 * product changed from `gpu` to `cpu` from keeping a card length.
 */
export function specColumnUpdates(
  kind: ComponentKind,
  specs: Record<string, unknown>,
): SpecColumnUpdate {
  const updates: SpecColumnUpdate = {};

  for (const field of specFieldsForKind(kind)) {
    updates[field.name] = coerceSpecValue(field, specs[field.name]);
  }

  for (const column of irrelevantSpecColumns(kind)) {
    updates[column] = BOOLEAN_SPEC_COLUMNS.includes(column) ? false : null;
  }

  return updates;
}
