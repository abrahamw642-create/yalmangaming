/**
 * `POST /api/admin/categories` — create a category.
 */

import { categoryWriteSchema } from "@/components/admin/payloads";
import {
  badRequest,
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

  const body = await parseBody(request, categoryWriteSchema);
  if (!body.ok) return body.response;

  const write = body.data;

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
      // The storefront navigation renders two levels; a grandchild would have
      // nowhere to appear.
      if (parent.parentId) {
        return badRequest("Categories only nest two levels deep.", {
          parentId: "Pick a top-level category as the parent",
        });
      }
    }

    const created = await prisma.category.create({
      data: write,
      select: { id: true, slug: true },
    });

    return ok(created, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        { slug: "URL slug" },
        "A category already uses that slug.",
      );
    }
    return serverError("categories", error);
  }
}
