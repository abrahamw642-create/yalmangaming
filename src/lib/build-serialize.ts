/**
 * Yalman Gaming — build serialisation.
 *
 * Pure, dependency-light functions that move a build between its three
 * representations:
 *
 *   1. `BuildState`  — what the browser holds (localStorage, React state)
 *   2. `BuildPayload` — what travels to the server (part *ids* only, never
 *                       prices: the API re-reads every figure from the database)
 *   3. plain text     — the WhatsApp message a customer sends to the shop
 *
 * Nothing here touches Prisma or React, so the same code runs in the builder,
 * in a route handler and in the read-only share page.
 */

import {
  ASSEMBLY_SERVICES,
  BUDGET_BANDS,
  BUILD_GOALS,
  BUILDER_STEP_KINDS,
  COMPONENT_KINDS,
  FPS_TARGETS,
  KIND_META,
  RESOLUTIONS,
  isComponentKind,
  type AssemblyService,
  type BuildGoal,
  type BuildSelection,
  type BuildState,
  type BuilderPart,
  type CompatibilityReport,
  type ComponentKind,
  type TargetFps,
  type TargetResolution,
} from "./types";
import { allParts, partPrice } from "./compatibility";
import { toBuilderPart, type ProductLike } from "./specs";
import { formatPKR } from "./utils";

/* -------------------------------------------------------------------------- */
/* Grouping                                                                   */
/* -------------------------------------------------------------------------- */

export type PartGroup = { part: BuilderPart; quantity: number };

/**
 * Collapses repeated picks of the same part into one row with a quantity.
 * Kinds flagged `multiple` (storage, fans) legitimately hold the same part
 * several times — three identical case fans is one line item, not three.
 */
export function groupParts(parts: BuilderPart[]): PartGroup[] {
  const order: string[] = [];
  const groups = new Map<string, PartGroup>();

  for (const part of parts) {
    const existing = groups.get(part.id);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    groups.set(part.id, { part, quantity: 1 });
    order.push(part.id);
  }

  return order.map((id) => groups.get(id)!);
}

/** Every selected part, in builder-step order, grouped by quantity. */
export function selectionRows(
  selection: BuildSelection,
): { kind: ComponentKind; groups: PartGroup[] }[] {
  const kinds = orderedKinds(selection);
  return kinds
    .map((kind) => ({ kind, groups: groupParts(selection[kind] ?? []) }))
    .filter((row) => row.groups.length > 0);
}

/** Builder kinds first (in step order), then anything else that crept in. */
function orderedKinds(selection: BuildSelection): ComponentKind[] {
  const extra = Object.keys(selection)
    .filter(
      (k): k is ComponentKind =>
        isComponentKind(k) && !BUILDER_STEP_KINDS.includes(k),
    )
    .sort((a, b) => KIND_META[a].order - KIND_META[b].order);
  return [...BUILDER_STEP_KINDS, ...extra];
}

/* -------------------------------------------------------------------------- */
/* Assembly services                                                          */
/* -------------------------------------------------------------------------- */

export function serviceById(id: string): AssemblyService | undefined {
  return ASSEMBLY_SERVICES.find((s) => s.id === id);
}

/** Selected services, always returned in the canonical catalogue order. */
export function selectedServices(ids: string[]): AssemblyService[] {
  const set = new Set(ids);
  return ASSEMBLY_SERVICES.filter((s) => set.has(s.id));
}

export function servicesSubtotal(ids: string[]): number {
  return selectedServices(ids).reduce((sum, s) => sum + s.price, 0);
}

/** The services ticked automatically when a customer opts into assembly. */
export function defaultServiceIds(): string[] {
  return ASSEMBLY_SERVICES.filter((s) => s.defaultOn).map((s) => s.id);
}

/* -------------------------------------------------------------------------- */
/* Client -> server payload                                                   */
/* -------------------------------------------------------------------------- */

export type BuildComponentPayload = {
  productId: string;
  kind: ComponentKind;
  quantity: number;
};

export type BuildPayload = {
  name: string;
  goal: BuildGoal | null;
  budgetMin: number | null;
  budgetMax: number | null;
  resolution: TargetResolution | null;
  targetFps: TargetFps | null;
  games: string[];
  services: string[];
  assembleForMe: boolean;
  components: BuildComponentPayload[];
};

export function componentPayload(
  selection: BuildSelection,
): BuildComponentPayload[] {
  const rows: BuildComponentPayload[] = [];
  for (const { kind, groups } of selectionRows(selection)) {
    for (const group of groups) {
      rows.push({
        productId: group.part.id,
        kind,
        quantity: KIND_META[kind].multiple ? group.quantity : 1,
      });
    }
  }
  return rows;
}

/**
 * The request body for `POST /api/builds` and `POST /api/quote`.
 *
 * Deliberately carries no prices, totals or compatibility verdict — the server
 * recomputes all three from the database so a hand-rolled request cannot
 * smuggle in a discounted or impossible build.
 */
export function toBuildPayload(build: BuildState): BuildPayload {
  return {
    name: build.name.trim() || "Untitled Build",
    goal: build.goal,
    budgetMin: build.budgetMin,
    budgetMax: build.budgetMax,
    resolution: build.resolution,
    targetFps: build.targetFps,
    games: build.games,
    services: build.services,
    assembleForMe: build.assembleForMe,
    components: componentPayload(build.selection),
  };
}

/**
 * A stable fingerprint of everything that would be persisted. The builder uses
 * it to tell whether a saved build has drifted since its share code was issued.
 */
export function buildSignature(build: BuildState): string {
  return JSON.stringify(toBuildPayload(build));
}

/* -------------------------------------------------------------------------- */
/* Server rows -> build state                                                 */
/* -------------------------------------------------------------------------- */

export type BuildComponentRow = {
  kind: string;
  quantity: number;
  product: ProductLike | null;
};

/**
 * Rebuilds a `BuildSelection` from persisted `BuildComponent` rows.
 *
 * `quantity` is expanded into repeated entries because the compatibility engine
 * counts array members (four NVMe drives must trip the M.2 slot rule whether
 * they were added as one row of four or four rows of one).
 */
export function selectionFromRows(rows: BuildComponentRow[]): BuildSelection {
  const selection: BuildSelection = {};

  for (const row of rows) {
    if (!row.product) continue;
    const kind = isComponentKind(row.kind) ? row.kind : null;
    if (!kind) continue;

    const part = toBuilderPart({ ...row.product, kind });
    const repeat = KIND_META[kind].multiple
      ? Math.max(1, Math.min(row.quantity || 1, 12))
      : 1;

    const bucket = (selection[kind] ??= []);
    for (let i = 0; i < repeat; i++) bucket.push(part);
  }

  return selection;
}

export type SavedBuildRecord = {
  id: string;
  shareCode: string;
  name: string;
  goal: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  resolution: string | null;
  targetFps: number | null;
  games: string | null;
  services: string | null;
};

/** Turns a persisted `CustomBuild` (+ its components) back into client state. */
export function buildStateFromRecord(
  record: SavedBuildRecord,
  rows: BuildComponentRow[],
): BuildState {
  const services = asStringList(safeJson(record.services)).filter((id) =>
    ASSEMBLY_SERVICES.some((s) => s.id === id),
  );

  return {
    id: record.id,
    shareCode: record.shareCode,
    name: record.name || "Untitled Build",
    goal: asGoal(record.goal),
    budgetId: bandIdFor(record.budgetMin, record.budgetMax),
    budgetMin: asNumber(record.budgetMin),
    budgetMax: asNumber(record.budgetMax),
    resolution: asResolution(record.resolution),
    targetFps: asFps(record.targetFps),
    games: asStringList(safeJson(record.games)),
    selection: selectionFromRows(rows),
    services,
    // There is no `assembleForMe` column: an empty service list is exactly the
    // "I will build it myself" case, so the flag round-trips through the list.
    assembleForMe: services.length > 0,
  };
}

/** Matches persisted min/max back to a named band so the chip re-highlights. */
export function bandIdFor(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min === null || min === undefined) return null;
  const band = BUDGET_BANDS.find(
    (b) => b.min === min && (b.max ?? null) === (max ?? null),
  );
  return band?.id ?? null;
}

function safeJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* localStorage hydration                                                     */
/* -------------------------------------------------------------------------- */

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function asNumberMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function asGoal(value: unknown): BuildGoal | null {
  return BUILD_GOALS.some((g) => g.id === value) ? (value as BuildGoal) : null;
}

function asResolution(value: unknown): TargetResolution | null {
  return RESOLUTIONS.includes(value as TargetResolution)
    ? (value as TargetResolution)
    : null;
}

function asFps(value: unknown): TargetFps | null {
  return FPS_TARGETS.some((f) => f.value === value)
    ? (value as TargetFps)
    : null;
}

/**
 * Rebuilds one `BuilderPart` from untrusted JSON.
 *
 * Written field-by-field rather than by spreading the input: a stale or tampered
 * localStorage entry must never inject extra keys into the object the
 * compatibility engine reasons about, and a part missing its identity is
 * dropped rather than half-restored.
 */
function coercePart(value: unknown, kind: ComponentKind): BuilderPart | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;

  const id = asString(p.id);
  const name = asString(p.name);
  const price = asNumber(p.price);
  if (!id || !name || price === null) return null;

  return {
    id,
    slug: asString(p.slug) ?? id,
    sku: asString(p.sku) ?? "",
    name,
    kind,
    brandName: asString(p.brandName),
    price,
    salePrice: asNumber(p.salePrice),
    // Absent flag means "assume sample" — the honest default, since every
    // seeded figure is sample data until Yalman confirms it.
    samplePrice: p.samplePrice !== false,
    stock: asNumber(p.stock) ?? 0,
    imageUrl: asString(p.imageUrl),
    headline: asString(p.headline),

    socket: asString(p.socket),
    chipset: asString(p.chipset),
    tdp: asNumber(p.tdp),
    peakPowerW: asNumber(p.peakPowerW),
    integratedGraphics: p.integratedGraphics === true,
    memoryType: asString(p.memoryType),
    memorySpeed: asNumber(p.memorySpeed),
    memorySlots: asNumber(p.memorySlots),
    maxMemoryGb: asNumber(p.maxMemoryGb),
    capacityGb: asNumber(p.capacityGb),
    moduleCount: asNumber(p.moduleCount),
    vramGb: asNumber(p.vramGb),
    gpuLengthMm: asNumber(p.gpuLengthMm),
    requiredConnectors: Array.isArray(p.requiredConnectors)
      ? (asStringList(p.requiredConnectors) as string[])
      : null,
    recommendedPsuW: asNumber(p.recommendedPsuW),
    storageInterface: asString(p.storageInterface),
    formFactor: asString(p.formFactor),
    m2Slots: asNumber(p.m2Slots),
    sataPorts: asNumber(p.sataPorts),
    wattage: asNumber(p.wattage),
    efficiency: asString(p.efficiency),
    providedConnectors: asNumberMap(p.providedConnectors),
    psuFormFactor: asString(p.psuFormFactor),
    psuLengthMm: asNumber(p.psuLengthMm),
    coolerType: asString(p.coolerType),
    coolerHeightMm: asNumber(p.coolerHeightMm),
    radiatorSizeMm: asNumber(p.radiatorSizeMm),
    supportedSockets: Array.isArray(p.supportedSockets)
      ? asStringList(p.supportedSockets)
      : null,
    coolingCapacityW: asNumber(p.coolingCapacityW),
    supportedFormFactors: Array.isArray(p.supportedFormFactors)
      ? asStringList(p.supportedFormFactors)
      : null,
    maxGpuLengthMm: asNumber(p.maxGpuLengthMm),
    maxCoolerHeightMm: asNumber(p.maxCoolerHeightMm),
    maxPsuLengthMm: asNumber(p.maxPsuLengthMm),
    radiatorSupport: asNumberMap(p.radiatorSupport),
    caseStyle: asString(p.caseStyle),
    dimensionsMm: asString(p.dimensionsMm),
    includedFans: asNumber(p.includedFans),
    rgb: p.rgb === true,
  };
}

/**
 * Validates whatever came out of localStorage (or a share-link response) before
 * it becomes React state. Returns `null` for anything unrecognisable so the
 * builder falls back to an empty build instead of crashing on load.
 */
export function sanitizeBuildState(raw: unknown): BuildState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const selection: BuildSelection = {};
  const rawSelection = r.selection;
  if (
    rawSelection &&
    typeof rawSelection === "object" &&
    !Array.isArray(rawSelection)
  ) {
    for (const [key, value] of Object.entries(
      rawSelection as Record<string, unknown>,
    )) {
      if (!isComponentKind(key) || !Array.isArray(value)) continue;
      const parts = value
        .map((entry) => coercePart(entry, key))
        .filter((part): part is BuilderPart => part !== null);
      if (parts.length) selection[key] = parts;
    }
  }

  const services = asStringList(r.services).filter((id) =>
    ASSEMBLY_SERVICES.some((s) => s.id === id),
  );

  const budgetMin = asNumber(r.budgetMin);
  const budgetMax = asNumber(r.budgetMax);
  const budgetId = asString(r.budgetId);

  return {
    id: asString(r.id),
    shareCode: asString(r.shareCode),
    name: asString(r.name) ?? "Untitled Build",
    goal: asGoal(r.goal),
    budgetId: BUDGET_BANDS.some((b) => b.id === budgetId) ? budgetId : null,
    budgetMin,
    budgetMax,
    resolution: asResolution(r.resolution),
    targetFps: asFps(r.targetFps),
    games: asStringList(r.games).slice(0, 12),
    selection,
    services,
    assembleForMe: r.assembleForMe === true,
  };
}

/* -------------------------------------------------------------------------- */
/* Human-readable output                                                      */
/* -------------------------------------------------------------------------- */

export function goalLabel(goal: BuildGoal | null): string | null {
  return BUILD_GOALS.find((g) => g.id === goal)?.label ?? null;
}

export function budgetLabel(build: {
  budgetId: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
}): string | null {
  const band = BUDGET_BANDS.find((b) => b.id === build.budgetId);
  if (band) return band.label;
  if (build.budgetMin === null && build.budgetMax === null) return null;
  if (build.budgetMax === null) return `${formatPKR(build.budgetMin)}+`;
  return `${formatPKR(build.budgetMin ?? 0)} – ${formatPKR(build.budgetMax)}`;
}

/** "1440p @ 144 FPS", or whichever half the customer picked. */
export function targetLabel(build: {
  resolution: TargetResolution | null;
  targetFps: TargetFps | null;
}): string | null {
  if (build.resolution && build.targetFps)
    return `${build.resolution} @ ${build.targetFps} FPS`;
  if (build.resolution) return build.resolution;
  if (build.targetFps) return `${build.targetFps} FPS`;
  return null;
}

const STATUS_TEXT: Record<CompatibilityReport["status"], string> = {
  ok: "All selected parts are compatible",
  warning: "Compatible, with notes",
  error: "Has compatibility errors",
};

/**
 * Renders the whole configuration as a plain-text message for WhatsApp.
 *
 * Deliberately verbose about sample pricing: the customer is about to quote
 * these numbers back to the shop, so the message has to say out loud that they
 * are placeholders rather than confirmed Yalman Gaming prices.
 */
export function buildText(
  build: BuildState,
  report: CompatibilityReport,
  opts: { shareUrl?: string | null; maxLength?: number } = {},
): string {
  const lines: string[] = [];
  const name = build.name.trim() || "Untitled Build";

  lines.push(`Hi Yalman Gaming — I configured a PC on your site.`);
  lines.push("");
  lines.push(`BUILD: ${name}`);

  const goal = goalLabel(build.goal);
  if (goal) lines.push(`Use: ${goal}`);

  const budget = budgetLabel(build);
  if (budget) lines.push(`Budget: ${budget}`);

  const target = targetLabel(build);
  if (target) lines.push(`Target: ${target}`);

  if (build.games.length) lines.push(`Games: ${build.games.join(", ")}`);

  const rows = selectionRows(build.selection);
  const parts = allParts(build.selection);
  const componentsSubtotal = parts.reduce((sum, p) => sum + partPrice(p), 0);

  if (rows.length) {
    lines.push("");
    lines.push("COMPONENTS");
    for (const { kind, groups } of rows) {
      for (const { part, quantity } of groups) {
        const qty = quantity > 1 ? ` ×${quantity}` : "";
        const price = formatPKR(partPrice(part) * quantity);
        lines.push(`• ${KIND_META[kind].label}: ${part.name}${qty} — ${price}`);
      }
    }
    lines.push(`Components subtotal: ${formatPKR(componentsSubtotal)}`);
  } else {
    lines.push("");
    lines.push("COMPONENTS: none selected yet.");
  }

  const services = selectedServices(build.services);
  if (services.length) {
    lines.push("");
    lines.push("SERVICES");
    for (const service of services) {
      lines.push(
        `• ${service.label} — ${service.price === 0 ? "included" : formatPKR(service.price)}`,
      );
    }
    lines.push(`Services subtotal: ${formatPKR(servicesSubtotal(build.services))}`);
  }

  const total = componentsSubtotal + servicesSubtotal(build.services);
  lines.push("");
  lines.push(`TOTAL: ${formatPKR(total)}`);

  if (parts.some((p) => p.samplePrice)) {
    lines.push(
      "(Prices taken from the website's sample figures — please confirm.)",
    );
  }

  const { estimatedWatts, recommendedPsuW } = report.power;
  if (estimatedWatts > 0) {
    lines.push(
      `Estimated draw: ${estimatedWatts}W · Recommended PSU: ${recommendedPsuW}W`,
    );
  }

  lines.push(`Compatibility: ${STATUS_TEXT[report.status]}`);

  const blocking = report.issues.filter((i) => i.severity === "error");
  for (const issue of blocking.slice(0, 3)) {
    lines.push(`  ! ${issue.title}`);
  }

  if (report.missing.length) {
    lines.push(
      `Still to choose: ${report.missing.map((k) => KIND_META[k].label).join(", ")}`,
    );
  }

  if (opts.shareUrl) {
    lines.push("");
    lines.push(opts.shareUrl);
  }

  const text = lines.join("\n");
  const max = opts.maxLength ?? 1600;
  // wa.me carries the message in the query string; an over-long one gets
  // truncated by the client anyway, so cut it here where we can be tidy.
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Absolute URL for a saved build. Falls back to a relative path on the server. */
export function shareUrlFor(shareCode: string, origin?: string | null): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : null) ??
    "";
  return `${base}/build/${shareCode}`;
}

/** Every component kind the builder knows how to step through, for guards. */
export const KNOWN_KINDS: readonly string[] = COMPONENT_KINDS;
