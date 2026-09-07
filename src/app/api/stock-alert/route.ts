/**
 * `POST /api/stock-alert`
 *
 * Records a request to be told when an out-of-stock product returns. Writes a
 * `StockAlert` row and nothing else — no promise about timing is made anywhere
 * in the flow, because Yalman Gaming has not given restock or delivery times.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    productId: z.string().min(1).max(64),
    email: z.string().trim().email().max(200).optional(),
    // Pakistani numbers arrive as 0328…, +92328… or 92328…; keep it permissive
    // but bounded, and store exactly what the customer typed.
    phone: z
      .string()
      .trim()
      .min(7)
      .max(24)
      .regex(/^[+0-9][0-9\s-]{6,23}$/, "Enter a valid phone number.")
      .optional(),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: "Enter an email address or a phone number.",
    path: ["email"],
  });

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Check the details and try again.",
      },
      { status: 400 },
    );
  }

  const { productId, email, phone } = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: productId, status: "active" },
    select: { id: true, name: true, stock: true },
  });

  if (!product) {
    return NextResponse.json(
      { ok: false, error: "That product is no longer listed." },
      { status: 404 },
    );
  }

  if (product.stock > 0) {
    // Nothing to wait for — tell the truth rather than queueing a dead alert.
    return NextResponse.json(
      { ok: false, error: "Good news — this product is back in stock.", inStock: true },
      { status: 409 },
    );
  }

  // The schema has no unique key here, so de-duplicate explicitly: signing up
  // twice should be a no-op, not two messages later.
  const existing = await prisma.stockAlert.findFirst({
    where: {
      productId: product.id,
      notified: false,
      ...(email ? { email } : { phone }),
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.stockAlert.create({
      data: {
        productId: product.id,
        email: email ?? null,
        phone: phone ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
