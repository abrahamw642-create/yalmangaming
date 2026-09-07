import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BUILDER_PART_SELECT, stringifyList } from "@/lib/specs";
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

const componentSchema = z.object({
  productId: z.string().min(1).max(64),
  kind: z.string().min(1).max(32),
  quantity: z.number().int().min(1).max(12).default(1),
});

const bodySchema = z.object({
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
  components: z.array(componentSchema).min(1).max(30),
});

// Everything below stays module-local: Next only permits route handlers and
// route config to be exported from a `route.ts`.

/* -------------------------------------------------------------------------- */
/* Best-effort abuse guard                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Saving a build is an unauthenticated write, so a single client cannot be
 * allowed to fill the table unattended. This is per-process and resets on
 * deploy — a speed bump, not a security control; a real deployment should sit
 * behind the platform's own rate limiting too.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const recentWrites = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const hits = (recentWrites.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recentWrites.set(ip, hits);

  // Keep the map from growing without bound on a long-lived process.
  if (recentWrites.size > 5_000) recentWrites.clear();

  return hits.length > MAX_PER_WINDOW;
}

/* -------------------------------------------------------------------------- */
/* POST — persist a build                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: "Too many builds saved from this connection. Wait a minute." },
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
        error: "That build could not be read.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const resolved = await resolveComponents(body.components);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const selection = selectionFromRows(resolved.rows);
    // The client's verdict is never trusted: the engine runs again here, over
    // parts read from the database, before anything is written.
    const report = checkCompatibility(selection);

    if (report.status === "error") {
      return NextResponse.json(
        {
          error:
            "This build has parts that cannot work together. Fix the errors and try again.",
          issues: report.issues.filter((i) => i.severity === "error"),
        },
        { status: 422 },
      );
    }

    const services = body.services.filter((id) =>
      ASSEMBLY_SERVICES.some((s) => s.id === id),
    );
    const goal =
      body.goal && BUILD_GOALS.some((g) => g.id === body.goal)
        ? body.goal
        : null;

    // Prices come from the rows just read, not from the request body.
    const componentsSubtotal = componentsTotal(selection);
    const servicesTotal = servicesSubtotal(services);

    const code = await uniqueShareCode();

    const created = await prisma.customBuild.create({
      data: {
        shareCode: code,
        name: body.name,
        goal,
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        resolution: body.resolution ?? null,
        targetFps: body.targetFps ?? null,
        games: stringifyList(body.games),
        status: "saved",
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
            // Captured from the row just read, so a saved build keeps the
            // figure the customer was actually shown.
            unitPrice: effectivePrice(row.product),
          })),
        },
      },
      select: { id: true, shareCode: true, total: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        shareCode: created.shareCode,
        componentsTotal: componentsSubtotal,
        servicesTotal,
        total: created.total,
        estimatedWatts: report.power.estimatedWatts,
        recommendedPsuW: report.power.recommendedPsuW,
        status: report.status,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/builds] save failed", error);
    return NextResponse.json(
      { error: "Could not save this build. Please try again." },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type ResolvedRow = {
  kind: string;
  quantity: number;
  product: Awaited<ReturnType<typeof loadProducts>>[number];
};

function loadProducts(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "active" },
    select: BUILDER_PART_SELECT,
  });
}

/**
 * Turns request components into database rows.
 *
 * Rejects anything the client could have tampered with: unknown ids, archived
 * products, a `kind` that disagrees with the product's own, and more than one
 * part in a slot that only holds one.
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

    // The kind is taken from the product row, never from the request — a
    // client claiming a graphics card is a power supply would otherwise skew
    // the wattage estimate and every rule that depends on it.
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

/** Retries on the (vanishingly unlikely) collision rather than 500-ing. */
async function uniqueShareCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomShareCode(6);
    const existing = await prisma.customBuild.findUnique({
      where: { shareCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Six collisions in a row means the 6-character space is crowded; widen it.
  return randomShareCode(10);
}
