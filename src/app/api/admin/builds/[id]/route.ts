/**
 * `PATCH /api/admin/builds/[id]`  — rename a saved build or move its status.
 * `DELETE /api/admin/builds/[id]` — remove it.
 *
 * Component lists and totals are not editable here. They were computed
 * server-side by `/api/builds` from the compatibility engine, and hand-editing
 * one would produce a build whose stored total no longer matches its parts.
 * To change a machine, reopen it at `/builder?load=<shareCode>` and save again.
 */

import { buildPatchSchema } from "@/components/admin/payloads";
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
  const body = await parseBody(request, buildPatchSchema);
  if (!body.ok) return body.response;

  const changes = Object.fromEntries(
    Object.entries(body.data).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changes).length === 0) return badRequest("Nothing to change.");

  try {
    const updated = await prisma.customBuild.update({
      where: { id },
      data: changes,
      select: { id: true, shareCode: true, status: true, name: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That build no longer exists.");
    }
    return serverError("builds", error);
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
    // `BuildComponent` cascades; `QuoteRequest.buildId` and `OrderItem.buildId`
    // are `SetNull`, so quote and order history survives with its own snapshot.
    await prisma.customBuild.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That build no longer exists.");
    }
    return serverError("builds", error);
  }
}
