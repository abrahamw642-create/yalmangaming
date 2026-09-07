/**
 * Yalman Gaming — admin authentication. Server only.
 *
 * One admin account (seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) signs in
 * with email + password. There is no customer login: the storefront cart is
 * client-owned and checkout is guest-only, so the only thing worth
 * authenticating is the back office.
 *
 * Session design
 * --------------
 * A stateless, HMAC-signed cookie rather than a session table:
 *
 *   <base64url(payload JSON)>.<base64url(HMAC-SHA256 of the payload)>
 *
 * The payload carries the user id and an absolute expiry. Nothing secret is
 * inside it — the signature is what makes it unforgeable, and the expiry is
 * inside the signed region so it cannot be extended by editing the cookie.
 * Signing uses Web Crypto (`crypto.subtle`) rather than `node:crypto` so the
 * identical token format can be verified in the Edge runtime, where
 * `src/middleware.ts` carries a copy of the verifier. **If the token format,
 * cookie name or payload shape changes here, change it there too** — the two
 * are deliberately independent because the Prisma client cannot be bundled
 * into the Edge middleware, so middleware cannot import this module.
 *
 * Stateless sessions have one trade-off worth naming: revocation. Changing the
 * admin password does not invalidate an already-issued cookie before its
 * expiry. The 12-hour TTL is short for that reason. If Yalman ever needs
 * instant revocation, add a `sessionEpoch` column to `User`, put it in the
 * payload, and compare on every `requireAdmin()`.
 */

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = "yg_admin_session";

/** Twelve hours. Short because these sessions cannot be revoked server-side. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Set by `src/middleware.ts` so a server component knows where it is. */
export const ADMIN_PATH_HEADER = "x-yg-admin-path";

export const LOGIN_PATH = "/admin/login";

export type AdminSession = {
  userId: string;
  /** Epoch seconds. */
  expiresAt: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

/* -------------------------------------------------------------------------- */
/* Secret                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reads `AUTH_SECRET`. Returns null rather than throwing so a misconfigured
 * deployment fails *closed* — every session simply fails to verify and the
 * admin is bounced to the login page — instead of 500-ing the storefront
 * through the middleware.
 */
function authSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

/* -------------------------------------------------------------------------- */
/* Token primitives (Web Crypto — mirrored in src/middleware.ts)               */
/* -------------------------------------------------------------------------- */

const textEncoder = new TextEncoder();

/** Importing a key costs real time; one per secret is plenty. */
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

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/**
 * Compares two byte strings in time independent of where they first differ.
 * `node:crypto`'s `timingSafeEqual` is not available in the Edge runtime, and
 * a plain `===` on the base64 signature leaks the length of the matching
 * prefix to anyone able to measure it.
 */
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

async function sign(secret: string, data: string): Promise<Uint8Array> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    textEncoder.encode(data),
  );
  return new Uint8Array(signature);
}

/** Issues a signed session token for `userId`, valid for `SESSION_TTL_SECONDS`. */
export async function signSessionToken(userId: string): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;

  const payload: AdminSession = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await sign(secret, body))}`;
}

/**
 * Verifies signature *then* expiry, and returns the payload only if both hold.
 * Any malformed input returns null — a corrupt cookie is a signed-out visitor,
 * never an error page.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<AdminSession | null> {
  const secret = authSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const provided = fromBase64Url(token.slice(dot + 1));
  if (!provided) return null;

  const expected = await sign(secret, body);
  if (!timingSafeEqual(provided, expected)) return null;

  const decoded = fromBase64Url(body);
  if (!decoded) return null;

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decoded));
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Partial<AdminSession>;
    if (typeof session.userId !== "string" || !session.userId) return null;
    if (typeof session.expiresAt !== "number") return null;
    if (session.expiresAt * 1000 <= Date.now()) return null;
    return { userId: session.userId, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Cookie plumbing                                                            */
/* -------------------------------------------------------------------------- */

export type SessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
    /** Only set when clearing — see `cookieOptions`. */
    expires?: Date;
  };
};

/**
 * `sameSite: "lax"` rather than `strict`: the admin follows links into the
 * dashboard from their own browser history and bookmarks, and lax still blocks
 * the cross-site POST that CSRF depends on. `secure` is off in development
 * because localhost is served over plain HTTP.
 *
 * Clearing sends `Expires` in the past alongside `Max-Age=0`. Every current
 * browser honours `Max-Age`, but some HTTP clients only understand `Expires`,
 * and a sign-out that silently leaves the cookie in place is the worst
 * possible failure for this particular cookie.
 */
function cookieOptions(maxAge: number): SessionCookie["options"] {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    ...(maxAge === 0 ? { expires: new Date(0) } : {}),
  };
}

export async function sessionCookieFor(userId: string): Promise<SessionCookie | null> {
  const value = await signSessionToken(userId);
  if (!value) return null;
  return { name: SESSION_COOKIE, value, options: cookieOptions(SESSION_TTL_SECONDS) };
}

/** A cookie that clears the session — same attributes, empty value, age zero. */
export function clearedSessionCookie(): SessionCookie {
  return { name: SESSION_COOKIE, value: "", options: cookieOptions(0) };
}

/* -------------------------------------------------------------------------- */
/* Reading the session                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The verified session for the current request, or null. Does not touch the
 * database — use `getAdminUser()` when you need the account itself.
 */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in administrator, or null.
 *
 * The role is re-read from the database on every call rather than trusted from
 * the cookie, so demoting or deleting an account takes effect on their next
 * request instead of when their token happens to expire.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * The path the middleware saw, so a redirect from deep inside the dashboard
 * can send the admin back where they were after signing in.
 */
async function currentAdminPath(): Promise<string | null> {
  try {
    const store = await headers();
    const path = store.get(ADMIN_PATH_HEADER);
    return path && path.startsWith("/admin") ? path : null;
  } catch {
    return null;
  }
}

export function loginHref(next?: string | null): string {
  if (!next || !next.startsWith("/admin") || next.startsWith(LOGIN_PATH)) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * Gate for pages and layouts. Redirects to the login screen when there is no
 * valid admin session, so a page body can assume it is authenticated.
 *
 * `src/middleware.ts` performs the same check at the edge, but that is a
 * routing convenience — this is the security boundary for rendered pages, and
 * `requireAdminApi()` is the boundary for route handlers.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (user) return user;
  redirect(loginHref(await currentAdminPath()));
}

/* -------------------------------------------------------------------------- */
/* Gate for route handlers                                                    */
/* -------------------------------------------------------------------------- */

export type AdminApiGuard =
  | { ok: true; user: AdminUser }
  | { ok: false; response: NextResponse };

/**
 * Gate for `/api/admin/**`. Returns a 401 JSON response rather than a redirect
 * — these endpoints are called with `fetch` from the dashboard, and an HTML
 * login page arriving where JSON was expected is a confusing failure.
 *
 * Every admin route handler must call this *first*, before reading its body.
 */
export async function requireAdminApi(): Promise<AdminApiGuard> {
  const user = await getAdminUser();
  if (user) return { ok: true, user };

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Not signed in. Reload the page and sign in again." },
      { status: 401 },
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Credentials                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A valid bcrypt hash of a value nobody knows, used to spend the same ~100ms
 * on an unknown email as on a known one. Without it, response time alone tells
 * an attacker which addresses have accounts.
 */
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export type CredentialResult =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: "invalid" | "not-configured" };

/**
 * Checks an email/password pair against the `User` table.
 *
 * Returns a single opaque `invalid` for "no such user", "not an admin",
 * "no password set" and "wrong password" alike: the login form must never
 * reveal which admin addresses exist.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<CredentialResult> {
  if (!authSecret()) return { ok: false, reason: "not-configured" };

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);

  if (!user || !user.passwordHash || user.role !== "admin" || !matches) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/* -------------------------------------------------------------------------- */
/* Login rate limit                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Token bucket per client IP.
 *
 * `LOGIN_BURST` attempts are allowed back-to-back; after that the bucket
 * refills at `LOGIN_REFILL_PER_MS`, so sustained guessing is throttled to one
 * attempt per `LOGIN_REFILL_SECONDS` while a person who fat-fingers their
 * password twice notices nothing.
 *
 * **In-memory and per-process.** It resets on deploy and does not span
 * instances, so behind more than one Node process (or any serverless platform)
 * this is a speed bump, not a control. Move the bucket to Redis — a single
 * `INCR` + `EXPIRE` per attempt against a shared key — before running this
 * admin on more than one instance.
 */
const LOGIN_BURST = 6;
const LOGIN_REFILL_SECONDS = 30;
const LOGIN_REFILL_PER_MS = 1 / (LOGIN_REFILL_SECONDS * 1000);

/** Stops a spray of forged `x-forwarded-for` values from growing the map. */
const MAX_TRACKED_CLIENTS = 4_000;

type Bucket = { tokens: number; updatedAt: number };
const loginBuckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitVerdict = {
  allowed: boolean;
  /** Seconds until the next attempt is allowed. Zero when `allowed`. */
  retryAfter: number;
};

export function consumeLoginAttempt(ip: string): RateLimitVerdict {
  const now = Date.now();

  if (loginBuckets.size > MAX_TRACKED_CLIENTS) loginBuckets.clear();

  const bucket = loginBuckets.get(ip) ?? { tokens: LOGIN_BURST, updatedAt: now };
  const refilled = Math.min(
    LOGIN_BURST,
    bucket.tokens + (now - bucket.updatedAt) * LOGIN_REFILL_PER_MS,
  );

  if (refilled < 1) {
    loginBuckets.set(ip, { tokens: refilled, updatedAt: now });
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((1 - refilled) / LOGIN_REFILL_PER_MS / 1000)),
    };
  }

  loginBuckets.set(ip, { tokens: refilled - 1, updatedAt: now });
  return { allowed: true, retryAfter: 0 };
}

/** A correct password refunds the bucket — only failures should cost anything. */
export function resetLoginAttempts(ip: string): void {
  loginBuckets.delete(ip);
}
