/**
 * `POST /api/admin/benchmarks` — record a measured frame rate.
 *
 * `source` is required by `benchmarkWriteSchema` and cannot be blank. The
 * storefront prints it next to the figure, so a row without one would publish
 * a number nobody can trace — which is the same thing as making it up.
 */

import { benchmarkWriteSchema } from "@/components/admin/payloads";
import {
  badRequest,
  conflict,
  guard,
  isUniqueViolation,
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

  const body = await parseBody(request, benchmarkWriteSchema);
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

    const created = await prisma.benchmark.create({
      data: write,
      select: { id: true },
    });

    return ok({ id: created.id }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      // `@@unique([productId, game, resolution, preset])` — one measurement per
      // combination, so a second run replaces the first rather than stacking.
      return conflict(
        "There is already a figure for that product, game, resolution and preset. Edit the existing row instead.",
      );
    }
    return serverError("benchmarks", error);
  }
}
