/**
 * `POST /api/admin/reviews` — record a review a real customer gave the store.
 *
 * Creating an approved review immediately changes what the storefront shows on
 * that product, so the cached rating is recomputed in the same request rather
 * than left to drift.
 */

import { reviewWriteSchema } from "@/components/admin/payloads";
import { syncProductRating } from "@/app/api/admin/_lib/reviews";
import {
  badRequest,
  guard,
  ok,
  parseBody,
  serverError,
} from "@/app/api/admin/_lib/respond";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await guard();
  if (!session.ok) return session.response;

  const body = await parseBody(request, reviewWriteSchema);
  if (!body.ok) return body.response;

  const write = body.data;

  try {
    const product = await prisma.product.findUnique({
      where: { id: write.productId },
      select: { id: true },
    });
    if (!product) {
      return badRequest("That product no longer exists.", {
        productId: "Choose a product that is still in the catalogue",
      });
    }

    const created = await prisma.review.create({
      data: {
        productId: write.productId,
        authorName: write.authorName,
        rating: write.rating,
        title: write.title,
        body: write.body,
        verified: write.verified,
        approved: write.approved,
      },
      select: { id: true },
    });

    if (write.approved) await syncProductRating(write.productId);

    return ok({ id: created.id }, 201);
  } catch (error) {
    return serverError("reviews", error);
  }
}
