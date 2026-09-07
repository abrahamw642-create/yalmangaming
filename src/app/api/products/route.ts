/**
 * `GET /api/products`
 *
 * Two modes:
 *   ?ids=a,b,c   → full comparison rows for those products (the compare page
 *                  and quick view, both of which hold ids in the browser).
 *   anything else → the same filtered listing the shop pages render, so a
 *                  client can page or search without a full navigation.
 *
 * Read-only, so there is nothing to authorise — but the query is still
 * validated before it reaches the database, and stock/pricing is never cached.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCompareProducts, getProducts } from "@/lib/catalog";
import { MAX_COMPARE, parseProductQuery, type SearchParamsRecord } from "@/lib/filters";

// Prices and stock move; a stale product feed is worse than a slow one.
export const dynamic = "force-dynamic";

/** Guards against absurd values before anything is parsed or queried. */
const rawParamsSchema = z.record(
  z.string().max(40),
  z.union([z.string().max(200), z.array(z.string().max(200)).max(20)]),
);

const idsSchema = z
  .string()
  .min(1)
  .max(400)
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))
      .slice(0, MAX_COMPARE),
  );

function toRecord(params: URLSearchParams): SearchParamsRecord {
  const out: SearchParamsRecord = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  /* --- Comparison / quick view ------------------------------------------ */
  const rawIds = params.get("ids");
  if (rawIds !== null) {
    const parsed = idsSchema.safeParse(rawIds);
    if (!parsed.success || !parsed.data.length) {
      return NextResponse.json(
        { error: "Provide a comma-separated list of product ids." },
        { status: 400 },
      );
    }

    const items = await getCompareProducts(parsed.data);
    return NextResponse.json(
      { items, total: items.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  /* --- Listing ----------------------------------------------------------- */
  const raw = rawParamsSchema.safeParse(toRecord(params));
  if (!raw.success) {
    return NextResponse.json({ error: "Malformed query." }, { status: 400 });
  }

  const query = parseProductQuery(raw.data);
  const result = await getProducts(query);

  return NextResponse.json(
    {
      items: result.items,
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      pageCount: result.pageCount,
      facets: result.facets,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
