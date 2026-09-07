/**
 * POST /api/cart — revalidate a browser cart against the catalog.
 *
 * The cart lives in `localStorage`, so its prices and stock counts age. This
 * hands the server nothing but identifiers and gets back the authoritative
 * name, price, availability and (for a build) compatibility verdict for each
 * line. It is a read: it writes nothing and creates no session.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkCompatibility } from "@/lib/compatibility";
import { BUILDER_PART_SELECT, toBuilderPart } from "@/lib/specs";
import { ASSEMBLY_SERVICES, isComponentKind } from "@/lib/types";
import type { BuilderPart, BuildSelection, ComponentKind } from "@/lib/types";
import { effectivePrice } from "@/lib/utils";
import { revalidateCartSchema } from "@/lib/validation";

export const runtime = "nodejs";

type LineStatus = "ok" | "insufficient-stock" | "out-of-stock" | "unavailable";

type RevalidatedLine = {
  id: string;
  status: LineStatus;
  name?: string;
  unitPrice?: number;
  listPrice?: number | null;
  stock?: number;
  samplePrice?: boolean;
  imageUrl?: string | null;
  compatibilityStatus?: "ok" | "warning" | "error";
  message?: string;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = revalidateCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid cart payload." }, { status: 400 });
  }

  const { lines } = parsed.data;
  if (lines.length === 0) return NextResponse.json({ lines: [] });

  /* --- One query for everything referenced -------------------------------- */
  const ids = new Set<string>();
  for (const line of lines) {
    if (line.kind === "product") ids.add(line.productId);
    else for (const component of line.components) ids.add(component.productId);
  }

  const rows = await prisma.product.findMany({
    where: { id: { in: [...ids] } },
    select: { ...BUILDER_PART_SELECT, status: true },
  });

  const products = new Map<string, BuilderPart & { status: string }>(
    rows.map((row) => [row.id, { ...toBuilderPart(row), status: row.status }]),
  );

  /* --- Re-derive each line ------------------------------------------------ */
  const result: RevalidatedLine[] = lines.map((line) => {
    if (line.kind === "product") {
      const product = products.get(line.productId);
      if (!product || product.status !== "active") {
        return {
          id: line.id,
          status: "unavailable",
          message: "No longer available.",
        };
      }

      const paying = effectivePrice(product);
      return {
        id: line.id,
        status:
          product.stock <= 0
            ? "out-of-stock"
            : product.stock < line.quantity
              ? "insufficient-stock"
              : "ok",
        name: product.name,
        unitPrice: paying,
        listPrice: paying < product.price ? product.price : null,
        stock: product.stock,
        samplePrice: product.samplePrice,
        imageUrl: product.imageUrl,
      };
    }

    /* --- Build line ------------------------------------------------------- */
    const parts = line.components.map((component) => ({
      component,
      product: products.get(component.productId),
    }));

    if (parts.some((p) => !p.product || p.product.status !== "active")) {
      return {
        id: line.id,
        status: "unavailable",
        message: "One or more components in this build are no longer available.",
      };
    }

    // Rebuild the selection from database rows and re-run the engine, so a
    // build that was compatible last week is re-checked against today's data.
    const selection: BuildSelection = {};
    for (const { component, product } of parts) {
      const kind: ComponentKind = isComponentKind(product!.kind)
        ? product!.kind
        : "prebuilt";
      const bucket = (selection[kind] ??= []);
      for (let i = 0; i < component.quantity; i++) bucket.push(product!);
    }
    const report = checkCompatibility(selection);

    const componentsSubtotal = parts.reduce(
      (sum, { component, product }) =>
        sum + effectivePrice(product!) * component.quantity,
      0,
    );
    const servicesSubtotal = line.services.reduce((sum, id) => {
      const service = ASSEMBLY_SERVICES.find((s) => s.id === id);
      return sum + (service?.price ?? 0);
    }, 0);

    // A build ships only as fast as its scarcest part.
    const available = parts.reduce((least, { component, product }) => {
      return Math.min(least, Math.floor(product!.stock / component.quantity));
    }, Number.POSITIVE_INFINITY);
    const stock = Number.isFinite(available) ? Math.max(0, available) : 0;

    return {
      id: line.id,
      status:
        stock <= 0 ? "out-of-stock" : stock < line.quantity ? "insufficient-stock" : "ok",
      name: line.name,
      unitPrice: componentsSubtotal + servicesSubtotal,
      listPrice: null,
      stock,
      samplePrice: parts.some((p) => p.product!.samplePrice),
      compatibilityStatus: report.status,
    };
  });

  return NextResponse.json({ lines: result });
}
