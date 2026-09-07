/**
 * Yalman Gaming — verified benchmark access.
 *
 * Server-only. This module is the ONLY way an FPS figure reaches the
 * storefront, and it has exactly one rule:
 *
 *   **Nothing here computes, scales, interpolates or estimates a frame rate.**
 *
 * A number is shown when a `Benchmark` row exists for that precise
 * (product, game, resolution, preset) combination, and it is shown with the
 * `source` and `cpuContext` that were stored alongside it. Where no row exists
 * the caller gets an empty `rows` array and renders `NO_DATA_LABEL`. That is
 * the correct, expected outcome — not a failure, not something to paper over
 * by deriving a figure from a neighbouring resolution or a similar card.
 *
 * The seed deliberately omits rows wherever a realistic figure is not known:
 * benchmarks exist for some graphics cards and for no processors at all, so
 * every consumer must handle the empty case as a first-class state.
 */

import { prisma } from "@/lib/db";
import {
  RESOLUTIONS,
  type BuildSelection,
  type TargetFps,
  type TargetResolution,
} from "@/lib/types";

/** Rendered wherever a figure was asked for and no stored row answers it. */
export const NO_DATA_LABEL = "No verified data yet";

/** The sentence that goes with `NO_DATA_LABEL` when there is room for one. */
export const NO_DATA_DETAIL =
  "Yalman Gaming has not measured this combination yet, and we do not publish estimated frame rates. Ask us in the shop or on WhatsApp and we will test it.";

/**
 * Preset ordering used only for *display* — heaviest last, so a table reads
 * from the easiest setting to the hardest. It never affects which rows exist.
 */
const PRESET_ORDER = ["Low", "Medium", "High", "Ultra"];

function presetRank(preset: string): number {
  const index = PRESET_ORDER.indexOf(preset);
  return index === -1 ? PRESET_ORDER.length : index;
}

/* -------------------------------------------------------------------------- */
/* Row shape                                                                  */
/* -------------------------------------------------------------------------- */

/** One stored measurement, exactly as it sits in the `Benchmark` table. */
export type BenchmarkRow = {
  id: string;
  productId: string;
  game: string;
  resolution: string;
  preset: string;
  avgFps: number;
  onePercentLow: number | null;
  /** Where the figure came from. Must be rendered next to the number. */
  source: string;
  /** The processor the measurement ran on. Must be rendered too. */
  cpuContext: string | null;
  notes: string | null;
};

const BENCHMARK_SELECT = {
  id: true,
  productId: true,
  game: true,
  resolution: true,
  preset: true,
  avgFps: true,
  onePercentLow: true,
  source: true,
  cpuContext: true,
  notes: true,
} as const;

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/** Every stored measurement for one product. */
export async function getBenchmarksForProduct(
  productId: string,
): Promise<BenchmarkRow[]> {
  if (!productId) return [];
  const rows = await prisma.benchmark.findMany({
    where: { productId },
    select: BENCHMARK_SELECT,
    orderBy: [{ game: "asc" }, { resolution: "asc" }],
  });
  return sortRows(rows);
}

/**
 * Batched lookup for a set of products, used when several cards are being
 * considered at once. Products with no rows are simply absent from the map —
 * callers must treat "absent" as "no verified data", never as zero.
 */
export async function getBenchmarksForProducts(
  productIds: string[],
  opts: { games?: string[]; resolution?: TargetResolution } = {},
): Promise<Map<string, BenchmarkRow[]>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const byProduct = new Map<string, BenchmarkRow[]>();
  if (!ids.length) return byProduct;

  const games = (opts.games ?? []).filter((g) => g.trim().length > 0);

  const rows = await prisma.benchmark.findMany({
    where: {
      productId: { in: ids },
      ...(opts.resolution ? { resolution: opts.resolution } : {}),
      ...(games.length ? { game: { in: games } } : {}),
    },
    select: BENCHMARK_SELECT,
    orderBy: [{ game: "asc" }, { resolution: "asc" }],
  });

  for (const row of rows) {
    const list = byProduct.get(row.productId);
    if (list) list.push(row);
    else byProduct.set(row.productId, [row]);
  }

  for (const [id, list] of byProduct) byProduct.set(id, sortRows(list));
  return byProduct;
}

function sortRows(rows: BenchmarkRow[]): BenchmarkRow[] {
  return [...rows].sort(
    (a, b) =>
      a.game.localeCompare(b.game, "en") ||
      RESOLUTIONS.indexOf(a.resolution as TargetResolution) -
        RESOLUTIONS.indexOf(b.resolution as TargetResolution) ||
      presetRank(a.preset) - presetRank(b.preset),
  );
}

/* -------------------------------------------------------------------------- */
/* Performance report                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One game at the customer's chosen resolution. `rows` is empty whenever
 * nothing has been measured — the UI must say so rather than leaving a blank
 * cell, which reads as "zero FPS".
 */
export type PerformanceEntry = {
  game: string;
  resolution: TargetResolution;
  rows: BenchmarkRow[];
  /**
   * True when at least one stored row's `avgFps` reaches the customer's target.
   * `null` when there is no row to compare against — never `false` by default,
   * because "we have not measured it" is not "it misses the target".
   */
  meetsTarget: boolean | null;
};

export type PerformanceReport = {
  /** The card these figures belong to. */
  productId: string | null;
  productName: string | null;
  resolution: TargetResolution;
  targetFps: TargetFps | null;
  entries: PerformanceEntry[];
  /** How many of the requested games have at least one stored row. */
  covered: number;
  /** Distinct `source` strings across every row shown. */
  sources: string[];
  /** Distinct `cpuContext` strings across every row shown. */
  cpuContexts: string[];
};

export function emptyPerformanceReport(
  resolution: TargetResolution,
  targetFps: TargetFps | null = null,
): PerformanceReport {
  return {
    productId: null,
    productName: null,
    resolution,
    targetFps,
    entries: [],
    covered: 0,
    sources: [],
    cpuContexts: [],
  };
}

/**
 * Builds the "expected FPS" table for one graphics card.
 *
 * When the customer named games, every one of them gets a row — including the
 * ones we have never measured, which is the whole point: a missing game is
 * information the customer needs, not a gap to hide. When they named none, the
 * table falls back to whatever this card *has* been measured on at the chosen
 * resolution.
 */
export async function getPerformanceReport(
  product: { id: string; name: string } | null,
  games: string[],
  resolution: TargetResolution,
  targetFps: TargetFps | null = null,
): Promise<PerformanceReport> {
  if (!product) return emptyPerformanceReport(resolution, targetFps);

  const all = await getBenchmarksForProduct(product.id);
  const atResolution = all.filter((row) => row.resolution === resolution);

  const requested = dedupe(games.map((g) => g.trim()).filter(Boolean));
  // No games chosen: show what this card actually has data for, in the order
  // the rows come back, rather than an empty table.
  const subjects = requested.length
    ? requested
    : dedupe(atResolution.map((row) => row.game));

  const entries: PerformanceEntry[] = subjects.map((game) => {
    const rows = atResolution.filter(
      (row) => row.game.toLowerCase() === game.toLowerCase(),
    );
    return {
      game,
      resolution,
      rows,
      meetsTarget: rows.length
        ? targetFps === null
          ? null
          : rows.some((row) => row.avgFps >= targetFps)
        : null,
    };
  });

  const shown = entries.flatMap((entry) => entry.rows);

  return {
    productId: product.id,
    productName: product.name,
    resolution,
    targetFps,
    entries,
    covered: entries.filter((entry) => entry.rows.length > 0).length,
    sources: dedupe(shown.map((row) => row.source)),
    cpuContexts: dedupe(
      shown.flatMap((row) => (row.cpuContext ? [row.cpuContext] : [])),
    ),
  };
}

/**
 * The performance table for a whole build.
 *
 * Frame rate is only ever attributed to the graphics card here, because that is
 * the only kind of product with stored rows — the seed holds no per-processor
 * measurement, and deriving one from the card's figures would be exactly the
 * invention this module exists to prevent. A build with no card returns an
 * empty report, which the UI must render as "no verified data", never as zero.
 */
export async function getPerformanceForSelection(
  selection: BuildSelection,
  games: string[],
  resolution: TargetResolution,
  targetFps: TargetFps | null = null,
): Promise<PerformanceReport> {
  const gpu = selection.gpu?.[0] ?? null;
  return getPerformanceReport(
    gpu ? { id: gpu.id, name: gpu.name } : null,
    games,
    resolution,
    targetFps,
  );
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How many of `games` this product has a stored row for at `resolution`.
 * Used to tell a customer honestly how much of their list we can evidence.
 */
export function coverageOf(
  rows: BenchmarkRow[],
  games: string[],
  resolution: TargetResolution,
): number {
  const wanted = new Set(games.map((g) => g.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return 0;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.resolution !== resolution) continue;
    const key = row.game.toLowerCase();
    if (wanted.has(key)) seen.add(key);
  }
  return seen.size;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.length > 0))];
}
