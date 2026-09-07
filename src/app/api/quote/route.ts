import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BUILDER_PART_SELECT, stringifyList, toBuilderPart } from "@/lib/specs";
import { checkCompatibility, componentsTotal } from "@/lib/compatibility";
import { selectionFromRows, servicesSubtotal } from "@/lib/build-serialize";
import {
  ASSEMBLY_SERVICES,
  BUILD_GOALS,
  KIND_META,
  isComponentKind,
  type ComponentKind,
} from "@/lib/types";
import { effectivePrice, shareCode as randomShareCode } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Request shape                                                              */
/* -------------------------------------------------------------------------- */

const buildSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Untitled Build"),
  goal: z.string().max(32).nullable().optional(),
  budgetMin: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  budgetMax: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  resolution: z.enum(["1080p", "1440p", "4K"]).nullable().optional(),
  targetFps: z
    .union([z.literal(60), z.literal(120), z.literal(144), z.literal(240)])
    .nullable()
    .optional(),
  games: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  services: z.array(z.string().min(1).max(32)).max(20).default([]),
  assembleForMe: z.boolean().default(false),
  components: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        kind: z.string().min(1).max(32),
        quantity: z.number().int().min(1).max(12).default(1),
      }),
    )
    .max(30)
    .default([]),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  // Deliberately permissive: Pakistani numbers are written 0328…, +92 328…,
  // 92-328… and every variation in between. The shop calls the number back, so
  // the only thing worth rejecting is something that clearly is not one.
  phone: z
    .string()
    .trim()
    .min(7)
    .max(24)
    .regex(/^[0-9+\-\s()]+$/, "That does not look like a phone number."),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional(),
  message: z.string().trim().max(1000).optional(),
  /** Omitted when the request comes from the standalone quote page. */
  build: buildSchema.optional(),
});

/* -------------------------------------------------------------------------- */
/* Best-effort abuse guard                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A public contact endpoint. Per-process and reset on deploy — a speed bump
 * against a runaway script, not a substitute for platform rate limiting.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const recentRequests = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const hits = (recentRequests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recentRequests.set(ip, hits);
  if (recentRequests.size > 5_000) recentRequests.clear();
  return hits.length > MAX_PER_WINDOW;
}

/* -------------------------------------------------------------------------- */
/* POST — a quote request                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      {
        error:
          "Too many requests from this connection. Please wait a minute, or message us on WhatsApp.",
      },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check your name and phone number and try again.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    let buildId: string | null = null;
    let shareCode: string | null = null;
    let snapshot: Record<string, unknown> = {};

    if (body.build && body.build.components.length > 0) {
      const resolved = await resolveComponents(body.build.components);
      if ("error" in resolved) {
        return NextResponse.json(
          { error: resolved.error },
          { status: resolved.status },
        );
      }

      const selection = selectionFromRows(resolved.rows);
      // Same engine, server side, over database rows — a quote for a machine
      // that cannot be built helps nobody.
      const report = checkCompatibility(selection);

      if (report.status === "error") {
        return NextResponse.json(
          {
            error:
              "This build has parts that cannot work together. Fix the errors before requesting a quote.",
            issues: report.issues.filter((i) => i.severity === "error"),
          },
          { status: 422 },
        );
      }

      const services = body.build.services.filter((id) =>
        ASSEMBLY_SERVICES.some((s) => s.id === id),
      );
      const goal =
        body.build.goal && BUILD_GOALS.some((g) => g.id === body.build?.goal)
          ? body.build.goal
          : null;

      const componentsSubtotal = componentsTotal(selection);
      const servicesTotal = servicesSubtotal(services);

      shareCode = await uniqueShareCode();

      const created = await prisma.customBuild.create({
        data: {
          shareCode,
          name: body.build.name,
          goal,
          budgetMin: body.build.budgetMin ?? null,
          budgetMax: body.build.budgetMax ?? null,
          resolution: body.build.resolution ?? null,
          targetFps: body.build.targetFps ?? null,
          games: stringifyList(body.build.games),
          status: "quoted",
          componentsTotal: componentsSubtotal,
          servicesTotal,
          total: componentsSubtotal + servicesTotal,
          estimatedWatts: report.power.estimatedWatts,
          recommendedPsuW: report.power.recommendedPsuW,
          services: stringifyList(services),
          compatibility: JSON.stringify(report),
          components: {
            create: resolved.rows.map((row) => ({
              productId: row.product.id,
              kind: row.kind,
              quantity: row.quantity,
              unitPrice: effectivePrice(row.product),
            })),
          },
        },
        select: { id: true },
      });

      buildId = created.id;

      // A flat snapshot so the request survives the build being edited or
      // deleted later — the admin always sees what was actually asked for.
      snapshot = {
        name: body.build.name,
        goal,
        budgetMin: body.build.budgetMin ?? null,
        budgetMax: body.build.budgetMax ?? null,
        resolution: body.build.resolution ?? null,
        targetFps: body.build.targetFps ?? null,
        games: body.build.games,
        services,
        assembleForMe: services.length > 0,
        components: resolved.rows.map((row) => {
          const part = toBuilderPart(row.product);
          return {
            kind: row.kind,
            quantity: row.quantity,
            sku: part.sku,
            name: part.name,
            unitPrice: effectivePrice(row.product),
            samplePrice: part.samplePrice,
          };
        }),
        componentsTotal: componentsSubtotal,
        servicesTotal,
        total: componentsSubtotal + servicesTotal,
        estimatedWatts: report.power.estimatedWatts,
        recommendedPsuW: report.power.recommendedPsuW,
        compatibilityStatus: report.status,
        shareCode,
      };
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        buildId,
        name: body.name,
        phone: body.phone,
        email: body.email ? body.email : null,
        city: body.city || null,
        message: body.message || null,
        snapshot: Object.keys(snapshot).length ? JSON.stringify(snapshot) : null,
        status: "new",
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        id: quote.id,
        buildId,
        shareCode,
        receivedAt: quote.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/quote] request failed", error);
    return NextResponse.json(
      {
        error:
          "Could not send this request. Please try again, or message us on WhatsApp.",
      },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function loadProducts(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "active" },
    select: BUILDER_PART_SELECT,
  });
}

type ResolvedRow = {
  kind: string;
  quantity: number;
  product: Awaited<ReturnType<typeof loadProducts>>[number];
};

/**
 * Mirror of the resolver in `/api/builds`. Duplicated deliberately: Next only
 * allows route handlers to be exported from a `route.ts`, so the two endpoints
 * cannot share a helper without a module neither of them owns. Both must keep
 * taking `kind` from the product row rather than the request body.
 */
async function resolveComponents(
  components: { productId: string; kind: string; quantity: number }[],
): Promise<{ rows: ResolvedRow[] } | { error: string; status: number }> {
  const ids = [...new Set(components.map((c) => c.productId))];
  const products = await loadProducts(ids);
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows: ResolvedRow[] = [];
  const perKind = new Map<string, number>();

  for (const component of components) {
    const product = byId.get(component.productId);
    if (!product) {
      return {
        error:
          "One of the parts in this build is no longer available. Refresh the builder and try again.",
        status: 409,
      };
    }

    if (!isComponentKind(product.kind)) {
      return { error: `Unsupported part type "${product.kind}".`, status: 400 };
    }

    const kind = product.kind as ComponentKind;
    if (component.kind !== kind) {
      return {
        error: `"${product.name}" is a ${KIND_META[kind].label.toLowerCase()}, not a ${component.kind}.`,
        status: 400,
      };
    }

    const quantity = KIND_META[kind].multiple ? component.quantity : 1;
    const count = (perKind.get(kind) ?? 0) + 1;
    perKind.set(kind, count);

    if (!KIND_META[kind].multiple && count > 1) {
      return {
        error: `A build can only have one ${KIND_META[kind].label.toLowerCase()}.`,
        status: 400,
      };
    }

    rows.push({ kind, quantity, product });
  }

  return { rows };
}

async function uniqueShareCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomShareCode(6);
    const existing = await prisma.customBuild.findUnique({
      where: { shareCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return randomShareCode(10);
}
