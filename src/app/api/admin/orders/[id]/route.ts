/**
 * `PATCH /api/admin/orders/[id]` — order status, payment status and notes.
 *
 * Deliberately narrow: an order's lines, prices and totals are a record of
 * what the customer was charged and are never editable from here. If a price
 * was wrong, the fix is a refund or a new order, not a rewrite of history.
 */

import { orderPatchSchema } from "@/components/admin/payloads";
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
  const body = await parseBody(request, orderPatchSchema);
  if (!body.ok) return body.response;

  const changes = Object.fromEntries(
    Object.entries(body.data).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changes).length === 0) return badRequest("Nothing to change.");

  try {
    const updated = await prisma.order.update({
      where: { id },
      data: changes,
      select: { id: true, orderNumber: true, status: true, paymentStatus: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That order no longer exists.");
    }
    return serverError("orders", error);
  }
}
