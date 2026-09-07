/**
 * `POST /api/admin/coupons` — create a discount code.
 */

import { couponWriteSchema } from "@/components/admin/payloads";
import {
  guard,
  isUniqueViolation,
  ok,
  parseBody,
  serverError,
  uniqueConflict,
} from "@/app/api/admin/_lib/respond";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await guard();
  if (!session.ok) return session.response;

  const body = await parseBody(request, couponWriteSchema);
  if (!body.ok) return body.response;

  try {
    const created = await prisma.coupon.create({
      // `usedCount` is never set from here — it is incremented inside the order
      // transaction and is a record of redemptions, not a setting.
      data: body.data,
      select: { id: true, code: true },
    });
    return ok(created, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return uniqueConflict(error, { code: "code" }, "That coupon code already exists.");
    }
    return serverError("coupons", error);
  }
}
