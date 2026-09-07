/**
 * `PATCH /api/admin/coupons/[id]`  — edit a discount code.
 * `DELETE /api/admin/coupons/[id]` — remove it.
 *
 * `usedCount` is deliberately not editable: it is the tally the order
 * transaction increments, and resetting it by hand would let a capped code be
 * redeemed past its limit.
 */

import { couponWriteSchema } from "@/components/admin/payloads";
import {
  guard,
  isMissingRecord,
  isUniqueViolation,
  notFoundResponse,
  ok,
  parseBody,
  serverError,
  uniqueConflict,
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
  const body = await parseBody(request, couponWriteSchema);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.coupon.update({
      where: { id },
      data: body.data,
      select: { id: true, code: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That coupon no longer exists.");
    }
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        { code: "code" },
        "Another coupon already uses that code.",
      );
    }
    return serverError("coupons", error);
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
    // Orders store the code they used as plain text, so history survives.
    await prisma.coupon.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That coupon no longer exists.");
    }
    return serverError("coupons", error);
  }
}
