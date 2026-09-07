import { NextResponse } from "next/server";
import { z } from "zod";
import { getPerformanceForSelection } from "@/lib/benchmarks";
import { recommendBuild } from "@/lib/recommend";
import { BUILD_GOALS, type BuildGoal } from "@/lib/types";

/** The goal ids the wizard offers, as a zod-usable non-empty tuple. */
const GOAL_IDS = BUILD_GOALS.map((goal) => goal.id) as [BuildGoal, ...BuildGoal[]];

export const runtime = "nodejs";
// Stock and pricing move; a recommendation must never be served from a cache
// that predates the last time either changed.
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Request shape                                                              */
/* -------------------------------------------------------------------------- */

const bodySchema = z
  .object({
    goal: z.enum(GOAL_IDS),
    budgetMin: z.number().int().min(0).max(50_000_000),
    // `null` is a real answer here — it is how "PKR 600,000+" arrives.
    budgetMax: z.number().int().min(0).max(50_000_000).nullable(),
    resolution: z.enum(["1080p", "1440p", "4K"]),
    targetFps: z.union([
      z.literal(60),
      z.literal(120),
      z.literal(144),
      z.literal(240),
    ]),
    games: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  })
  .refine(
    (value) => value.budgetMax === null || value.budgetMax >= value.budgetMin,
    { message: "The upper budget must not be below the lower one.", path: ["budgetMax"] },
  );

/* -------------------------------------------------------------------------- */
/* Best-effort abuse guard                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every request runs the whole catalogue through the compatibility engine a few
 * hundred times, so this endpoint is worth more than a database read to abuse.
 * Per-process and reset on deploy — a speed bump, not a security control.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
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
/* POST — solve for a build                                                   */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return NextResponse.json(
      {
        error:
          "Too many recommendations from this connection. Wait a minute, or message us on WhatsApp and we will spec it by hand.",
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
        error: "Please check the budget, resolution and frame-rate target.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    // The engine runs entirely server-side over rows read here, so the browser
    // cannot smuggle in a price, a part or a compatibility verdict of its own.
    const recommendation = await recommendBuild({
      goal: parsed.data.goal,
      budgetMin: parsed.data.budgetMin,
      budgetMax: parsed.data.budgetMax,
      resolution: parsed.data.resolution,
      targetFps: parsed.data.targetFps,
      games: parsed.data.games,
    });

    // Frame rates come only from stored `Benchmark` rows. Games with nothing
    // measured come back with an empty `rows` array, which is the answer.
    const performance = await getPerformanceForSelection(
      recommendation.selection,
      recommendation.input.games,
      recommendation.input.resolution,
      recommendation.input.targetFps,
    );

    return NextResponse.json({ recommendation, performance }, { status: 200 });
  } catch (error) {
    console.error("[api/recommend] failed", error);
    return NextResponse.json(
      {
        error:
          "Could not put a build together just now. Please try again, or message us on WhatsApp.",
      },
      { status: 500 },
    );
  }
}
