/**
 * `POST /api/admin/products` — create a product.
 *
 * Note the storefront's own `/api/products` is a *read* endpoint for the shop
 * grid; this is the write side and is gated on an admin session.
 */

import { z } from "zod";

import { productWriteSchema } from "@/components/admin/payloads";
import {
  productColumnData,
  productImageRows,
} from "@/app/api/admin/_lib/product-data";
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

const bodySchema = z.object({ product: productWriteSchema });

const UNIQUE_LABELS = { sku: "SKU", slug: "URL slug" };

export async function POST(request: Request) {
  const session = await guard();
  if (!session.ok) return session.response;

  // The editor keys its inputs `name`, `slug`, `images.0.url` — not
  // `product.name` — so the wrapper is stripped from the error paths.
  const body = await parseBody(request, bodySchema, ["product"]);
  if (!body.ok) return body.response;

  const write = body.data.product;

  try {
    const created = await prisma.product.create({
      data: {
        ...productColumnData(write),
        images: { create: productImageRows(write) },
      },
      select: { id: true, slug: true, name: true },
    });

    return ok({ id: created.id, slug: created.slug, name: created.name }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return uniqueConflict(
        error,
        UNIQUE_LABELS,
        "A product with that SKU or slug already exists.",
      );
    }
    return serverError("products", error);
  }
}
