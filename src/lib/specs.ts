/**
 * Bridge between Prisma rows and the plain objects the builder/UI use.
 *
 * The schema stores structured values as JSON *text* so one schema file works
 * on both SQLite and PostgreSQL. Every read of those columns goes through the
 * parsers here, which never throw on malformed data — a bad row degrades to
 * `null` rather than taking down a page.
 */

import type { BuilderPart, ComponentKind } from "./types";
import { isComponentKind } from "./types";

/* -------------------------------------------------------------------------- */
/* JSON text helpers                                                          */
/* -------------------------------------------------------------------------- */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function parseStringList(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const parsed = parseJson<unknown>(value, null);
  if (!Array.isArray(parsed)) return null;
  const list = parsed.filter((v): v is string => typeof v === "string");
  return list.length ? list : null;
}

export function parseNumberMap(
  value: string | null | undefined,
): Record<string, number> | null {
  if (!value) return null;
  const parsed = parseJson<unknown>(value, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function stringifyList(list: string[] | null | undefined): string | null {
  return list && list.length ? JSON.stringify(list) : null;
}

export function stringifyMap(
  map: Record<string, number> | null | undefined,
): string | null {
  return map && Object.keys(map).length ? JSON.stringify(map) : null;
}

/* -------------------------------------------------------------------------- */
/* Spec sheet                                                                 */
/* -------------------------------------------------------------------------- */

export type SpecRow = { group: string; label: string; value: string };

export function parseSpecSheet(value: string | null | undefined): SpecRow[] {
  const rows = parseJson<unknown>(value, []);
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r): r is SpecRow =>
      !!r &&
      typeof r === "object" &&
      typeof (r as SpecRow).label === "string" &&
      typeof (r as SpecRow).value === "string",
  ).map((r) => ({ group: r.group || "Specifications", label: r.label, value: r.value }));
}

export function groupSpecs(rows: SpecRow[]): { group: string; rows: SpecRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, SpecRow[]>();
  for (const row of rows) {
    if (!map.has(row.group)) {
      map.set(row.group, []);
      order.push(row.group);
    }
    map.get(row.group)!.push(row);
  }
  return order.map((group) => ({ group, rows: map.get(group)! }));
}

/* -------------------------------------------------------------------------- */
/* Product -> BuilderPart                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The subset of a Prisma `Product` this mapper reads. Declared structurally so
 * callers can pass a full row, a `select`ed subset, or a seed literal.
 */
export type ProductLike = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  kind: string;
  price: number;
  salePrice?: number | null;
  samplePrice?: boolean;
  stock?: number;
  headline?: string | null;
  brand?: { name: string } | null;
  brandName?: string | null;
  images?: { url: string; alt?: string | null }[];
  imageUrl?: string | null;

  socket?: string | null;
  chipset?: string | null;
  tdp?: number | null;
  peakPowerW?: number | null;
  integratedGraphics?: boolean;
  memoryType?: string | null;
  memorySpeed?: number | null;
  memorySlots?: number | null;
  maxMemoryGb?: number | null;
  capacityGb?: number | null;
  moduleCount?: number | null;
  vramGb?: number | null;
  gpuLengthMm?: number | null;
  requiredConnectors?: string | null;
  recommendedPsuW?: number | null;
  storageInterface?: string | null;
  formFactor?: string | null;
  m2Slots?: number | null;
  sataPorts?: number | null;
  wattage?: number | null;
  efficiency?: string | null;
  providedConnectors?: string | null;
  psuFormFactor?: string | null;
  psuLengthMm?: number | null;
  coolerType?: string | null;
  coolerHeightMm?: number | null;
  radiatorSizeMm?: number | null;
  supportedSockets?: string | null;
  coolingCapacityW?: number | null;
  supportedFormFactors?: string | null;
  maxGpuLengthMm?: number | null;
  maxCoolerHeightMm?: number | null;
  maxPsuLengthMm?: number | null;
  radiatorSupport?: string | null;
  caseStyle?: string | null;
  dimensionsMm?: string | null;
  includedFans?: number | null;
  rgb?: boolean;
};

export function toBuilderPart(p: ProductLike): BuilderPart {
  const kind: ComponentKind = isComponentKind(p.kind)
    ? (p.kind as ComponentKind)
    : "prebuilt";

  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    kind,
    brandName: p.brand?.name ?? p.brandName ?? null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    samplePrice: p.samplePrice ?? true,
    stock: p.stock ?? 0,
    imageUrl: p.images?.[0]?.url ?? p.imageUrl ?? null,
    headline: p.headline ?? null,

    socket: p.socket ?? null,
    chipset: p.chipset ?? null,
    tdp: p.tdp ?? null,
    peakPowerW: p.peakPowerW ?? null,
    integratedGraphics: p.integratedGraphics ?? false,
    memoryType: p.memoryType ?? null,
    memorySpeed: p.memorySpeed ?? null,
    memorySlots: p.memorySlots ?? null,
    maxMemoryGb: p.maxMemoryGb ?? null,
    capacityGb: p.capacityGb ?? null,
    moduleCount: p.moduleCount ?? null,
    vramGb: p.vramGb ?? null,
    gpuLengthMm: p.gpuLengthMm ?? null,
    requiredConnectors: parseStringList(p.requiredConnectors),
    recommendedPsuW: p.recommendedPsuW ?? null,
    storageInterface: p.storageInterface ?? null,
    formFactor: p.formFactor ?? null,
    m2Slots: p.m2Slots ?? null,
    sataPorts: p.sataPorts ?? null,
    wattage: p.wattage ?? null,
    efficiency: p.efficiency ?? null,
    providedConnectors: parseNumberMap(p.providedConnectors),
    psuFormFactor: p.psuFormFactor ?? null,
    psuLengthMm: p.psuLengthMm ?? null,
    coolerType: p.coolerType ?? null,
    coolerHeightMm: p.coolerHeightMm ?? null,
    radiatorSizeMm: p.radiatorSizeMm ?? null,
    supportedSockets: parseStringList(p.supportedSockets),
    coolingCapacityW: p.coolingCapacityW ?? null,
    supportedFormFactors: parseStringList(p.supportedFormFactors),
    maxGpuLengthMm: p.maxGpuLengthMm ?? null,
    maxCoolerHeightMm: p.maxCoolerHeightMm ?? null,
    maxPsuLengthMm: p.maxPsuLengthMm ?? null,
    radiatorSupport: parseNumberMap(p.radiatorSupport),
    caseStyle: p.caseStyle ?? null,
    dimensionsMm: p.dimensionsMm ?? null,
    includedFans: p.includedFans ?? null,
    rgb: p.rgb ?? false,
  };
}

/** The Prisma `select` that satisfies `toBuilderPart`. */
export const BUILDER_PART_SELECT = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  kind: true,
  price: true,
  salePrice: true,
  samplePrice: true,
  stock: true,
  headline: true,
  brand: { select: { name: true } },
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  socket: true,
  chipset: true,
  tdp: true,
  peakPowerW: true,
  integratedGraphics: true,
  memoryType: true,
  memorySpeed: true,
  memorySlots: true,
  maxMemoryGb: true,
  capacityGb: true,
  moduleCount: true,
  vramGb: true,
  gpuLengthMm: true,
  requiredConnectors: true,
  recommendedPsuW: true,
  storageInterface: true,
  formFactor: true,
  m2Slots: true,
  sataPorts: true,
  wattage: true,
  efficiency: true,
  providedConnectors: true,
  psuFormFactor: true,
  psuLengthMm: true,
  coolerType: true,
  coolerHeightMm: true,
  radiatorSizeMm: true,
  supportedSockets: true,
  coolingCapacityW: true,
  supportedFormFactors: true,
  maxGpuLengthMm: true,
  maxCoolerHeightMm: true,
  maxPsuLengthMm: true,
  radiatorSupport: true,
  caseStyle: true,
  dimensionsMm: true,
  includedFans: true,
  rgb: true,
} as const;
