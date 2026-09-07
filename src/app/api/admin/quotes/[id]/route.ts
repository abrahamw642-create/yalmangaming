/**
 * `PATCH /api/admin/quotes/[id]`  — status and internal notes.
 * `DELETE /api/admin/quotes/[id]` — remove a request.
 *
 * The customer's own words (`message`) and the build snapshot are never
 * editable: they are a record of what was asked for, and a quote that has been
 * quietly reworded is worthless as one.
 */

import { quotePatchSchema } from "@/components/admin/payloads";
import {
  badRequest,
  guard,
  isMissingRecord,
  notFoundResponse,
  ok,
  parseBody,
  serverError,
} from "@/app/api/admin/_lib/respond";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await parseBody(request, quotePatchSchema);
  if (!body.ok) return body.response;

  const changes = Object.fromEntries(
    Object.entries(body.data).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changes).length === 0) return badRequest("Nothing to change.");

  try {
    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: changes,
      select: { id: true, status: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That quote request no longer exists.");
    }
    return serverError("quotes", error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard();
  if (!session.ok) return session.response;

  const { id } = await params;

  try {
    // `QuoteRequest.buildId` is `onDelete: SetNull` on the build side, so the
    // saved build survives this and stays reachable from /admin/builds.
    await prisma.quoteRequest.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That quote request no longer exists.");
    }
    return serverError("quotes", error);
  }
}
