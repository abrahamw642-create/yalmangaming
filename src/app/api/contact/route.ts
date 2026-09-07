/**
 * `POST /api/contact` — the contact form on `/contact`.
 *
 * There is no `Inquiry` model and the Prisma schema is frozen, so a contact
 * message lands in `QuoteRequest` like a quote does. The two are told apart by
 * `snapshot.source`, which the admin's quote list can key on: a row whose
 * snapshot says `"contact"` is a question, not a machine to price.
 *
 * Validation is `enquirySchema` from `@/components/content/forms` — the exact
 * schema the browser form runs before it submits. One definition, two runtimes,
 * so a field the customer saw pass cannot fail differently here.
 *
 * Nothing in the response promises a reply time. The store has not committed to
 * one and the site must not invent it.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  budgetLabel,
  enquirySchema,
  topicLabel,
  type EnquiryResponse,
} from "@/components/content/forms";
import { fieldErrors, normalizePkPhone } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Best-effort abuse guard                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-process and reset on deploy — a speed bump against a runaway script, not
 * a substitute for platform rate limiting. Deliberately a copy of the guard in
 * `/api/quote`: Next only allows handlers to be exported from a `route.ts`, so
 * the two endpoints cannot share a helper without a module neither of them
 * owns, and the numbers are intentionally the same.
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
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

function fail(error: string, status: number, fields?: Record<string, string>) {
  const body: EnquiryResponse = fields ? { ok: false, error, fields } : { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return fail(
      "Too many messages from this connection. Please wait a minute, or send us a WhatsApp instead.",
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("We could not read that submission. Please try again.", 400);
  }

  // Honeypot, checked against the raw body *before* validation. Only a script
  // fills a field positioned off-screen and hidden from assistive technology,
  // so answer as though it worked and write nothing. Doing this after the
  // schema would return a field error named `website` — which tells the bot
  // exactly which field to leave alone next time.
  const trap = (payload as { website?: unknown } | null)?.website;
  if (typeof trap === "string" && trap.trim().length > 0) {
    return NextResponse.json(
      { ok: true, id: "ignored", receivedAt: new Date().toISOString() } satisfies EnquiryResponse,
      { status: 202 },
    );
  }

  const parsed = enquirySchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      "Please check the highlighted fields and send it again.",
      400,
      fieldErrors(parsed.error),
    );
  }
  const body = parsed.data;

  try {
    // Store what the customer actually typed in `phone`, and the normalised
    // E.164 form alongside it when one can be derived. The shop dials the
    // former; anything that wants to build a wa.me link uses the latter.
    const phoneE164 = normalizePkPhone(body.phone);

    const snapshot = {
      source: body.source,
      topic: body.topic ?? null,
      topicLabel: topicLabel(body.topic),
      budgetId: body.budgetId ?? null,
      budgetLabel: budgetLabel(body.budgetId),
      games: body.games,
      phoneE164,
      submittedAt: new Date().toISOString(),
    };

    const created = await prisma.quoteRequest.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email ? body.email : null,
        city: body.city || null,
        message: body.message,
        snapshot: JSON.stringify(snapshot),
        status: "new",
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        id: created.id,
        receivedAt: created.createdAt.toISOString(),
      } satisfies EnquiryResponse,
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/contact] request failed", error);
    return fail(
      "Something went wrong sending that. Please try again, or message us on WhatsApp.",
      500,
    );
  }
}
