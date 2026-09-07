/**
 * POST /api/coupon — check a coupon code against the `Coupon` table.
 *
 * This only *reads*. Nothing is reserved and `usedCount` is untouched: the
 * code is validated again, and the counter incremented atomically, inside the
 * order transaction. A code that passes here can still be refused at checkout
 * if it sells out in between, and the customer is told so plainly.
 */

import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/orders";
import { couponCheckSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = couponCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a coupon code." },
      { status: 400 },
    );
  }

  const result = await validateCoupon(parsed.data.code, parsed.data.subtotal);

  // A code that simply does not apply is a valid request with a "no" answer,
  // not an HTTP error — the UI shows `message` inline either way.
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message });
  }

  return NextResponse.json({
    ok: true,
    coupon: result.coupon,
    discount: result.discount,
  });
}
