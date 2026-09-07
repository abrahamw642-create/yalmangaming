/**
 * `POST /api/newsletter` — stock and price-drop sign-ups.
 *
 * The footer's sign-up box posts here. (The home page's version of the same
 * form uses a Server Action instead, so it keeps working before hydration;
 * both write the same `NewsletterSignup` row through the same
 * `newsletterSchema`.)
 *
 * `upsert` rather than `create`: `NewsletterSignup.email` is unique, and
 * somebody signing up twice should be thanked rather than shown a database
 * error. The response deliberately promises no schedule, frequency or
 * unsubscribe flow — none of those has been set up, and a sign-up box that
 * lies about the first email is a bad first impression.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  newsletterSchema,
  type NewsletterResponse,
} from "@/components/content/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THANKS = "You are on the list. We will only email about stock and deals.";

/* -------------------------------------------------------------------------- */
/* Best-effort abuse guard                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-process and reset on deploy. A copy of the guard in `/api/quote` and
 * `/api/contact` — Next only allows handlers to be exported from a `route.ts`,
 * so these endpoints cannot share a helper. The allowance is higher here
 * because one field is cheap and a shared office IP may hold several people.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
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
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error } satisfies NewsletterResponse, {
    status,
  });
}

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return fail("Too many attempts. Please wait a minute and try again.", 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("We could not read that submission. Please try again.", 400);
  }

  // Honeypot, read from the raw body before validation so a bot never learns
  // which field gave it away.
  const trap = (payload as { website?: unknown } | null)?.website;
  if (typeof trap === "string" && trap.trim().length > 0) {
    return NextResponse.json(
      { ok: true, message: THANKS } satisfies NewsletterResponse,
      { status: 202 },
    );
  }

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      400,
    );
  }

  try {
    await prisma.newsletterSignup.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });

    return NextResponse.json(
      { ok: true, message: THANKS } satisfies NewsletterResponse,
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/newsletter] signup failed", error);
    return fail(
      "Something went wrong saving that. Please try again, or message us on WhatsApp.",
      500,
    );
  }
}
