/**
 * POST /api/orders — place an order.
 *
 * Everything that decides money or availability happens in `@/lib/orders`:
 * prices and stock are re-read from the database, builds are re-run through
 * the compatibility engine, the coupon is re-validated, stock is decremented
 * under a conditional update inside a transaction, and the total is recomputed
 * from scratch. Nothing the client sent about price, stock or fitment is used.
 */

import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { createOrderSchema, fieldErrors } from "@/lib/validation";

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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: fieldErrors(parsed.error),
        message: "Please check the highlighted fields.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createOrder(parsed.data);

    if (!result.ok) {
      // 409: the request was well-formed, the world changed under it.
      return NextResponse.json({ ok: false, issues: result.issues }, { status: 409 });
    }

    return NextResponse.json(
      {
        ok: true,
        orderNumber: result.orderNumber,
        total: result.total,
        payment: result.payment,
      },
      { status: 201 },
    );
  } catch (error) {
    // Never leak a database message to the customer; the store's logs have it.
    console.error("[POST /api/orders] failed to place order", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Something went wrong placing your order. Nothing was charged — please try again, or message us on WhatsApp.",
      },
      { status: 500 },
    );
  }
}
