/**
 * Keeps `Product.rating` / `Product.reviewCount` in step with the `Review`
 * table.
 *
 * Those two columns are a denormalised cache — the storefront sorts and facets
 * on them, so they cannot be computed per request. Every write that changes
 * which reviews are *approved* has to call this, or the shop starts showing a
 * star rating that nothing backs up.
 *
 * Only approved reviews count. A product with none goes back to 0 / 0, which
 * is what makes the storefront render its "no reviews yet" empty state rather
 * than a misleading one-star card.
 */

import { prisma } from "@/lib/db";

export async function syncProductRating(productId: string): Promise<void> {
  const stats = await prisma.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const count = stats._count._all;
  const average = stats._avg.rating ?? 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      // One decimal place: the storefront's star widget fills fractionally and
      // anything finer is noise at five stars.
      rating: count > 0 ? Math.round(average * 10) / 10 : 0,
      reviewCount: count,
    },
  });
}
