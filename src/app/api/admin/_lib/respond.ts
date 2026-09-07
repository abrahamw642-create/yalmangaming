/**
 * Shared plumbing for the `/api/admin/**` route handlers.
 *
 * A private folder (`_lib`) so Next does not route it. Every handler follows
 * the same four steps in the same order:
 *
 *   1. `guard()`   — `requireAdminApi()`. Middleware only checks the cookie's
 *                    signature at the edge; this re-reads the account, and it
 *                    is what actually protects the endpoint.
 *   2. `parseBody` — zod. Nothing past this line is unvalidated.
 *   3. the write.
 *   4. `ok()` / one of the typed error helpers.
 *
 * Errors are always `{ error, fields? }` so `@/components/admin/api` can put a
 * message under the field it belongs to without every endpoint inventing a
 * shape.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";

import { requireAdminApi, type AdminUser } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, fields }, { status: 400 });
}

export function notFoundResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, fields }, { status: 409 });
}

/**
 * Logs the real cause and returns a message that says what failed without
 * leaking a stack trace or a database error string to the browser.
 */
export function serverError(scope: string, error: unknown) {
  console.error(`[api/admin/${scope}]`, error);
  return NextResponse.json(
    { error: "Something went wrong saving that. Please try again." },
    { status: 500 },
  );
}

/* -------------------------------------------------------------------------- */
/* Guard                                                                      */
/* -------------------------------------------------------------------------- */

export type AdminGuard =
  | { ok: true; user: AdminUser }
  | { ok: false; response: NextResponse };

/** Call this first in every handler, before reading the request body. */
export async function guard(): Promise<AdminGuard> {
  return requireAdminApi();
}

/* -------------------------------------------------------------------------- */
/* Body parsing                                                               */
/* -------------------------------------------------------------------------- */

export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * `stripPrefixes` removes a wrapper key from the error paths. A body shaped
 * `{ product: {...} }` produces `product.name`, but the editor's inputs are
 * keyed `name` — without this, every message would land nowhere.
 */
export async function parseBody<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema,
  stripPrefixes: string[] = [],
): Promise<Parsed<z.output<Schema>>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { ok: false, response: badRequest("Invalid request body.") };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const raw = fieldErrors(result.error);
    const fields: Record<string, string> = {};

    for (const [path, message] of Object.entries(raw)) {
      const prefix = stripPrefixes.find((candidate) => path.startsWith(`${candidate}.`));
      const key = prefix ? path.slice(prefix.length + 1) : path;
      // First message wins, matching `fieldErrors` — two paths can collapse
      // onto the same key once a prefix is removed.
      if (!(key in fields)) fields[key] = message;
    }

    return {
      ok: false,
      response: badRequest("Check the highlighted fields.", fields),
    };
  }

  return { ok: true, data: result.data };
}

/* -------------------------------------------------------------------------- */
/* Prisma error mapping                                                       */
/* -------------------------------------------------------------------------- */

type PrismaLikeError = { code?: unknown; meta?: { target?: unknown } };

/** True for a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PrismaLikeError).code === "P2002"
  );
}

/** The column names a unique violation names, when the driver reports them. */
export function uniqueFields(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const target = (error as PrismaLikeError).meta?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === "string");
  if (typeof target === "string") return target.split(",").map((t) => t.trim());
  return [];
}

/**
 * Turns a unique-constraint failure into a message under the offending field.
 * `labels` maps a column name to what the form calls it.
 */
export function uniqueConflict(
  error: unknown,
  labels: Record<string, string>,
  fallback: string,
) {
  const columns = uniqueFields(error).filter((column) => column in labels);
  if (columns.length === 0) return conflict(fallback);

  const fields: Record<string, string> = {};
  for (const column of columns) {
    fields[column] = `That ${labels[column]} is already used by another record.`;
  }
  return conflict(
    `That ${columns.map((column) => labels[column]).join(" and ")} is already taken.`,
    fields,
  );
}

/** True for "record not found" on an update or delete. */
export function isMissingRecord(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((error as PrismaLikeError).code === "P2025" ||
      (error as PrismaLikeError).code === "P2016")
  );
}
