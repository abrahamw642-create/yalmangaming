/**
 * `POST /api/admin/auth/login`
 *
 * The one endpoint under `/api/admin` that is deliberately reachable while
 * signed out — `src/middleware.ts` exempts `/api/admin/auth/**` for exactly
 * this route, or there would be no way in.
 *
 * Order of operations matters: rate limit first (so a guessing script pays the
 * cost before any database work), then shape validation, then the bcrypt
 * comparison. A successful sign-in refunds the bucket, so only failures
 * accumulate against an address.
 */

import { NextResponse } from "next/server";

import { loginSchema } from "@/components/admin/payloads";
import {
  clientIp,
  consumeLoginAttempt,
  loginHref,
  resetLoginAttempts,
  sessionCookieFor,
  verifyCredentials,
} from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same-origin admin paths only — never an absolute or protocol-relative URL. */
function safeRedirect(next: string | undefined): string {
  if (!next) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  if (next.startsWith(loginHref())) return "/admin";
  return next;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const verdict = consumeLoginAttempt(ip);

  if (!verdict.allowed) {
    return NextResponse.json(
      {
        error: `Too many sign-in attempts. Try again in ${verdict.retryAfter} seconds.`,
      },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfter) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the details below.", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const result = await verifyCredentials(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    if (result.reason === "not-configured") {
      return NextResponse.json(
        {
          error:
            "Sign-in is not configured on this server: AUTH_SECRET is missing or too short.",
        },
        { status: 503 },
      );
    }
    // One message for every failure mode — see `verifyCredentials`.
    return NextResponse.json(
      { error: "That email and password combination is not recognised." },
      { status: 401 },
    );
  }

  const cookie = await sessionCookieFor(result.user.id);
  if (!cookie) {
    return NextResponse.json(
      { error: "Could not start a session on this server. Check AUTH_SECRET." },
      { status: 503 },
    );
  }

  resetLoginAttempts(ip);

  const response = NextResponse.json({
    ok: true,
    redirectTo: safeRedirect(parsed.data.next),
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
