/**
 * `POST /api/admin/auth/logout`
 *
 * Clears the session cookie. Not gated on `requireAdminApi()` on purpose:
 * discarding your own cookie is harmless whether or not it was still valid,
 * and an expired session must always be able to sign out cleanly.
 *
 * POST rather than GET so a prefetch or an image tag on another site cannot
 * sign an admin out.
 */

import { NextResponse } from "next/server";

import { clearedSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookie = clearedSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
