/**
 * `POST /api/admin/showcase` — add a machine to the "Built by Yalman" wall.
 */

import { showcaseWriteSchema } from "@/components/admin/payloads";
import {
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

  const body = await parseBody(request, showcaseWriteSchema);
  if (!body.ok) return body.response;

  const { components, ...rest } = body.data;

  try {
    const created = await prisma.showcaseBuild.create({
      data: {
        ...rest,
        // JSON text, like every structured column in this schema.
        components: components.length > 0 ? JSON.stringify(components) : null,
      },
      select: { id: true, slug: true },
    });
    return ok(created, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        { slug: "URL slug" },
        "A showcase build already uses that slug.",
      );
    }
    return serverError("showcase", error);
  }
}
