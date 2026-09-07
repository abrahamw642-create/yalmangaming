/**
 * Data access for "Built by Yalman" — the `/showcase` index and its detail
 * pages.
 *
 * Server-only: it imports the Prisma client, so it must never be pulled into a
 * `"use client"` module. It lives beside the pages that use it rather than in
 * `src/lib` because the showcase is content-area furniture and nothing outside
 * this area reads `ShowcaseBuild`.
 *
 * `ShowcaseBuild.components` is a JSON *text* column, so every read goes
 * through `parseShowcaseParts`, which discards anything that is not a
 * `{ kind, name }` pair. A hand edit from the admin should cost one card its
 * parts list, never take the page down.
 */

import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/specs";
import { KIND_META, isComponentKind } from "@/lib/types";
import type { BadgeTone } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/** A flat row. Deliberately not a Prisma type, so pages never import Prisma. */
export type ShowcaseBuildRecord = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: string | null;
  target: string | null;
  price: number | null;
  samplePrice: boolean;
  /** JSON text: `[{ "kind": "cpu", "name": "..." }]`. */
  components: string | null;
  imageUrl: string | null;
  accent: string | null;
  featured: boolean;
  sortOrder: number;
};

export type ShowcasePart = { kind: string; name: string };

const SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  description: true,
  tier: true,
  target: true,
  price: true,
  samplePrice: true,
  components: true,
  imageUrl: true,
  accent: true,
  featured: true,
  sortOrder: true,
} as const;

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every showcased machine, in the order the shop wants them read: cheapest
 * first, because `sortOrder` was seeded to run from the entry build upwards.
 */
export async function getShowcaseBuilds(): Promise<ShowcaseBuildRecord[]> {
  return prisma.showcaseBuild.findMany({
    select: SELECT,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 60,
  });
}

export async function getShowcaseBuild(
  slug: string,
): Promise<ShowcaseBuildRecord | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  return prisma.showcaseBuild.findUnique({ where: { slug: clean }, select: SELECT });
}

/** Slugs for the sitemap and for `generateStaticParams`. */
export async function getShowcaseSlugs(): Promise<string[]> {
  const rows = await prisma.showcaseBuild.findMany({
    select: { slug: true },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
  return rows.map((row) => row.slug);
}

/**
 * The two builds either side of this one, so a detail page can offer "the next
 * one up" rather than dead-ending at the bottom of the spec table.
 */
export function neighbours(
  builds: ShowcaseBuildRecord[],
  slug: string,
): { previous: ShowcaseBuildRecord | null; next: ShowcaseBuildRecord | null } {
  const index = builds.findIndex((b) => b.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: builds[index - 1] ?? null,
    next: builds[index + 1] ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Parsing + presentation                                                     */
/* -------------------------------------------------------------------------- */

export function parseShowcaseParts(json: string | null): ShowcasePart[] {
  const raw = parseJson<unknown>(json, []);
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const { kind, name } = record;
    if (typeof kind !== "string" || typeof name !== "string") return [];
    if (!kind.trim() || !name.trim()) return [];
    return [{ kind: kind.trim(), name: name.trim() }];
  });
}

/** Display label for a part's kind, falling back to the raw string. */
export function partLabel(kind: string): string {
  return isComponentKind(kind) ? KIND_META[kind].label : kind;
}

/**
 * Parts in builder order (`KIND_META.order`) rather than the order they happen
 * to sit in the JSON, so two builds read as a comparison.
 */
export function orderedParts(parts: ShowcasePart[]): ShowcasePart[] {
  return [...parts].sort((a, b) => {
    const orderOf = (kind: string) =>
      isComponentKind(kind) ? KIND_META[kind].order : 99;
    return orderOf(a.kind) - orderOf(b.kind);
  });
}

/** Which parts a card names before the reader opens the full spec. */
export const HEADLINE_KINDS = ["cpu", "gpu", "ram", "storage"] as const;

export function headlineParts(parts: ShowcasePart[]): ShowcasePart[] {
  return HEADLINE_KINDS.flatMap((kind) => {
    const part = parts.find((p) => p.kind === kind);
    return part ? [part] : [];
  });
}

/** Seeded tiers map to badge tones; anything else falls back to neutral. */
export const TIER_TONE: Record<string, BadgeTone> = {
  Entry: "emerald",
  "Mid-Range": "cyan",
  "High-End": "violet",
  Extreme: "ember",
};

export function tierTone(tier: string | null): BadgeTone {
  return (tier && TIER_TONE[tier]) || "neutral";
}

/** Accent-driven hover edge, matching the home page's showcase rail. */
export const ACCENT_EDGE: Record<string, string> = {
  cyan: "hover:border-cyan/40",
  violet: "hover:border-violet/40",
  ember: "hover:border-ember/40",
  emerald: "hover:border-emerald/40",
  rose: "hover:border-rose/40",
  lime: "hover:border-lime/40",
  sky: "hover:border-sky/40",
};

export function accentEdge(accent: string | null): string {
  return (accent && ACCENT_EDGE[accent]) || ACCENT_EDGE.cyan;
}
