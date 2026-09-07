/**
 * Yalman Gaming — admin route gate.
 *
 * Runs at the edge before `/admin/**` and `/api/admin/**`. Two jobs:
 *
 *   1. Bounce visitors with no valid session to the login screen, carrying a
 *      `?next=` so they land back where they were headed.
 *   2. Stamp the requested path onto a header so a server component that has
 *      to redirect (a signed cookie whose account was since demoted) can build
 *      the same `?next=`.
 *
 * **This is not the security boundary.** Middleware can be bypassed by
 * misconfiguration, and it deliberately knows nothing about the database — a
 * cookie signed for a user who has since lost their admin role still passes
 * here. Every page calls `requireAdmin()` and every route handler calls
 * `requireAdminApi()` from `@/lib/auth`; those re-read the account and are
 * what actually protects anything.
 *
 * The verifier below is a deliberate copy of `verifySessionToken` in
 * `@/lib/auth`. That module imports the Prisma client, which cannot be bundled
 * into the Edge runtime, so this file cannot import it. Both sides use Web
 * Crypto and the same token format on purpose — **change one, change the
 * other**.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "yg_admin_session";
const ADMIN_PATH_HEADER = "x-yg-admin-path";
const LOGIN_PATH = "/admin/login";

/* -------------------------------------------------------------------------- */
/* Token verification (mirror of @/lib/auth)                                   */
/* -------------------------------------------------------------------------- */

const textEncoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padding = (4 - (value.length % 4)) % 4;
    const binary = atob(
      value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padding),
    );
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Constant-time byte comparison — see the note in `@/lib/auth`. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    const left = i < a.length ? a[i] : 0;
    const right = i < b.length ? b[i] : 0;
    diff |= left ^ right;
  }
  return diff === 0;
}

async function hasValidSession(token: string | undefined): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  // No secret configured means no session can be trusted. Fail closed.
  if (!secret || secret.length < 16 || !token) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;

  const body = token.slice(0, dot);
  const provided = fromBase64Url(token.slice(dot + 1));
  if (!provided) return false;

  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), textEncoder.encode(body)),
  );
  if (!timingSafeEqual(provided, signature)) return false;

  const decoded = fromBase64Url(body);
  if (!decoded) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(decoded)) as {
      userId?: unknown;
      expiresAt?: unknown;
    };
    return (
      typeof payload.userId === "string" &&
      payload.userId.length > 0 &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Middleware                                                                 */
/* -------------------------------------------------------------------------- */

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The login screen and the endpoints that drive it must stay reachable while
  // signed out, or there would be no way in.
  if (pathname === LOGIN_PATH || pathname.startsWith("/api/admin/auth/")) {
    return NextResponse.next();
  }

  const valid = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not signed in. Reload the page and sign in again." },
        { status: 401 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    // Only same-origin admin paths are ever echoed back, so the parameter
    // cannot be used to turn the login page into an open redirect.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Pass the path through so `requireAdmin()` can rebuild this redirect if the
  // database check it performs disagrees with the signature check above.
  const headers = new Headers(request.headers);
  headers.set(ADMIN_PATH_HEADER, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
