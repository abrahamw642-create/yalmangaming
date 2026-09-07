/**
 * `PATCH /api/admin/reviews/[id]`  — publish or unpublish.
 * `DELETE /api/admin/reviews/[id]` — remove entirely.
 *
 * Both recompute the product's cached `rating` / `reviewCount` from the
 * remaining *approved* reviews. Unpublishing the last one takes a product back
 * to 0 / 0, which is what makes the storefront render its empty state instead
 * of a score with nothing behind it.
 *
 * The review's text is never edited here. Rewording what a customer said would
 * make it something the store wrote.
 */

import { reviewPatchSchema } from "@/components/admin/payloads";
import { syncProductRating } from "@/app/api/admin/_lib/reviews";
import {
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
  const body = await parseBody(request, reviewPatchSchema);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.review.update({
      where: { id },
      data: { approved: body.data.approved },
      select: { id: true, productId: true, approved: true },
    });

    await syncProductRating(updated.productId);
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That review no longer exists.");
    }
    return serverError("reviews", error);
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
    const deleted = await prisma.review.delete({
      where: { id },
      select: { id: true, productId: true },
    });

    await syncProductRating(deleted.productId);
    return ok({ id: deleted.id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That review no longer exists.");
    }
    return serverError("reviews", error);
  }
}
