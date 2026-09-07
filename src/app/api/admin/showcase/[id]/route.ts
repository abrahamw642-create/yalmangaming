/**
 * `PATCH /api/admin/showcase/[id]`  — edit a showcase machine.
 * `DELETE /api/admin/showcase/[id]` — remove it.
 */

import { showcaseWriteSchema } from "@/components/admin/payloads";
import {
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
  const body = await parseBody(request, showcaseWriteSchema);
  if (!body.ok) return body.response;

  const { components, ...rest } = body.data;

  try {
    const updated = await prisma.showcaseBuild.update({
      where: { id },
      data: {
        ...rest,
        components: components.length > 0 ? JSON.stringify(components) : null,
      },
      select: { id: true, slug: true },
    });
    return ok(updated);
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That showcase build no longer exists.");
    }
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        { slug: "URL slug" },
        "Another showcase build already uses that slug.",
      );
    }
    return serverError("showcase", error);
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
    await prisma.showcaseBuild.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (isMissingRecord(error)) {
      return notFoundResponse("That showcase build no longer exists.");
    }
    return serverError("showcase", error);
  }
}
