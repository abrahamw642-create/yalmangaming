/**
 * `PATCH /api/admin/products/[id]` — inline edits and full saves.
 * `DELETE /api/admin/products/[id]` — remove a product.
 *
 * PATCH carries a `mode` so one endpoint serves both callers without either
 * being able to do the other's job: a `quick` body can only touch the commerce
 * fields the table edits inline, and a `full` body always rewrites the whole
 * product including its per-kind spec columns.
 */

import {
  productPatchBodySchema,
  type ProductWrite,
} from "@/components/admin/payloads";
import {
  productColumnData,
  productImageRows,
} from "@/app/api/admin/_lib/product-data";
import {
  badRequest,
  conflict,
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

const UNIQUE_LABELS = { sku: "SKU", slug: "URL slug" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard();
  if (!session.ok) return session.response;

  const { id } = await params;
  // Both branches wrap their payload; the editor and the table both key their
  // controls by the bare field name.
  const body = await parseBody(request, productPatchBodySchema, ["product", "patch"]);
  if (!body.ok) return body.response;

  try {
    if (body.data.mode === "quick") {
      const patch = body.data.patch;
      const changes = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(changes).length === 0) {
        return badRequest("Nothing to change.");
      }

      // A sale price above the list price would show a negative discount on
      // the card, so the two are checked together even in a one-field edit.
      if (typeof changes.salePrice === "number") {
        const current = await prisma.product.findUnique({
          where: { id },
          select: { price: true },
        });
        if (!current) return notFoundResponse("That product no longer exists.");

        const price = typeof changes.price === "number" ? changes.price : current.price;
        if (changes.salePrice >= price) {
          return badRequest("A sale price has to be below the normal price.", {
            salePrice: "Must be below the normal price",
          });
        }
      }

      const updated = await prisma.product.update({
        where: { id },
        data: changes,
        select: { id: true, name: true },
      });

      return ok({ id: updated.id, name: updated.name });
    }

    return await saveFullProduct(id, body.data.product);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That product no longer exists.");
    }
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        UNIQUE_LABELS,
        "Another product already uses that SKU or slug.",
      );
    }
    return serverError("products", error);
  }
}

/**
 * A full save replaces the image list wholesale rather than diffing it: the
 * editor owns the order, and `sortOrder` is positional, so reconciling row by
 * row would be more code for exactly the same result.
 */
async function saveFullProduct(id: string, write: ProductWrite) {
  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: productColumnData(write),
      select: { id: true, slug: true, name: true },
    });

    await tx.productImage.deleteMany({ where: { productId: id } });
    const rows = productImageRows(write);
    if (rows.length > 0) {
      await tx.productImage.createMany({
        data: rows.map((row) => ({ ...row, productId: id })),
      });
    }

    return product;
  });

  return ok({ id: updated.id, slug: updated.slug, name: updated.name });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard();
  if (!session.ok) return session.response;

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { name: true, _count: { select: { orderItems: true } } },
    });

    if (!product) return notFoundResponse("That product no longer exists.");

    // Order lines keep their own copy of the name and price, so deleting would
    // not corrupt history — but it would break the link from an order back to
    // what was sold. Archiving keeps both.
    if (product._count.orderItems > 0) {
      return conflict(
        `${product.name} appears on ${product._count.orderItems} order ${
          product._count.orderItems === 1 ? "line" : "lines"
        }. Set it to Archived instead so the order history keeps its link.`,
      );
    }

    await prisma.product.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That product no longer exists.");
    }
    return serverError("products", error);
  }
}
