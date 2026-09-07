import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BUILDER_PART_SELECT } from "@/lib/specs";
import { checkCompatibility } from "@/lib/compatibility";
import { buildStateFromRecord, selectionFromRows } from "@/lib/build-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Share codes come from `shareCode()` in `@/lib/utils`: an unambiguous
 * upper-case alphabet with no look-alike characters. Validating the shape here
 * turns a mistyped URL into a clean 400 instead of a database round trip.
 */
const codeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .regex(/^[A-Z0-9]+$/, "Share codes are letters and digits only.");

/**
 * `GET /api/builds/:shareCode` — the saved configuration, in the exact shape
 * `useBuild().loadBuild()` expects, plus a freshly computed compatibility
 * report. Used by `/builder?load=CODE` and by the share page's "open in
 * builder" action.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareCode: string }> },
) {
  const { shareCode } = await params;
  const parsed = codeSchema.safeParse(shareCode.toUpperCase());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid share code." }, { status: 400 });
  }

  try {
    const record = await prisma.customBuild.findUnique({
      where: { shareCode: parsed.data },
      select: {
        id: true,
        shareCode: true,
        name: true,
        goal: true,
        budgetMin: true,
        budgetMax: true,
        resolution: true,
        targetFps: true,
        games: true,
        services: true,
        createdAt: true,
        components: {
          select: {
            kind: true,
            quantity: true,
            product: { select: BUILDER_PART_SELECT },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Build not found." }, { status: 404 });
    }

    const build = buildStateFromRecord(record, record.components);
    // Recomputed rather than read from the stored snapshot: a part's specs may
    // have been corrected in the catalogue since the build was saved, and the
    // customer should see today's verdict.
    const report = checkCompatibility(selectionFromRows(record.components));

    return NextResponse.json({
      build,
      report,
      savedAt: record.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/builds/:shareCode] load failed", error);
    return NextResponse.json(
      { error: "Could not load this build." },
      { status: 500 },
    );
  }
}
