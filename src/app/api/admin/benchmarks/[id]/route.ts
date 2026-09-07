/**
 * `PATCH /api/admin/benchmarks/[id]`  — correct a measured figure.
 * `DELETE /api/admin/benchmarks/[id]` — withdraw one.
 *
 * Deleting is the right move for a figure that can no longer be attributed:
 * the storefront falls back to "No verified data yet", which is always better
 * than a number the store cannot stand behind.
 */

import { benchmarkWriteSchema } from "@/components/admin/payloads";
import {
  conflict,
  guard,
  isMissingRecord,
  isUniqueViolation,
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
  const body = await parseBody(request, benchmarkWriteSchema);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.benchmark.update({
      where: { id },
      data: body.data,
      select: { id: true, productId: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That benchmark row no longer exists.");
    }
    if (isUniqueViolation(error)) {
      return conflict(
        "Another row already covers that product, game, resolution and preset.",
      );
    }
    return serverError("benchmarks", error);
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
    await prisma.benchmark.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That benchmark row no longer exists.");
    }
    return serverError("benchmarks", error);
  }
}
