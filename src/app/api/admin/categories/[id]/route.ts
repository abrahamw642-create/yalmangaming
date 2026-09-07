/**
 * `PATCH /api/admin/categories/[id]`  — edit a category.
 * `DELETE /api/admin/categories/[id]` — remove it.
 *
 * `Category.parentId` is `onDelete: SetNull` and `Product.categoryId` is too,
 * so deleting a section promotes its children to the top level and leaves its
 * products in the catalogue, uncategorised. That is recoverable; cascading
 * would not be.
 */

import { categoryWriteSchema } from "@/components/admin/payloads";
import {
  badRequest,
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
  const body = await parseBody(request, categoryWriteSchema);
  if (!body.ok) return body.response;

  const write = body.data;

  if (write.parentId === id) {
    return badRequest("A category cannot be its own parent.", {
      parentId: "Choose a different parent",
    });
  }

  try {
    if (write.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: write.parentId },
        select: { id: true, parentId: true },
      });
      if (!parent) {
        return badRequest("That parent category no longer exists.", {
          parentId: "Choose a category that still exists",
        });
      }
      if (parent.parentId) {
        return badRequest("Categories only nest two levels deep.", {
          parentId: "Pick a top-level category as the parent",
        });
      }

      // Giving a category a parent while it still has children would create
      // the third level the navigation cannot render.
      const children = await prisma.category.count({ where: { parentId: id } });
      if (children > 0) {
        return badRequest(
          "This category has subcategories, so it has to stay at the top level.",
          { parentId: "Move its subcategories first" },
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: write,
      select: { id: true, slug: true },
    });

    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That category no longer exists.");
    }
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        { slug: "URL slug" },
        "Another category already uses that slug.",
      );
    }
    return serverError("categories", error);
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
    await prisma.category.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That category no longer exists.");
    }
    return serverError("categories", error);
  }
}
