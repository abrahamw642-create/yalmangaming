/**
 * Yalman Gaming — build recommendation engine.
 *
 * Server-only. Turns "PKR 300,000, 1440p gaming" into a complete, *compatible*
 * machine built from parts that actually exist in the catalogue, with a live
 * total and a specific reason for every choice.
 *
 * The rules this module works under:
 *
 *  1. **The compatibility engine is the only authority on what fits.** Nothing
 *     here re-implements a socket, clearance or connector rule. Every candidate
 *     goes through `rankCandidates`, and the finished build goes through
 *     `checkCompatibility` again. If the engine says a part conflicts, it
 *     conflicts — the repair loop substitutes rather than arguing.
 *
 *  2. **Never present a broken build as fine.** The repair loop iterates until
 *     the report has no errors. If it cannot get there from the parts in stock,
 *     the result is returned with `achievable: false`, the remaining issues
 *     attached, and a note saying so in plain words.
 *
 *  3. **Never invent a number.** Rationales are assembled from real columns —
 *     VRAM, board power, cores, boost clock, socket, DIMM slots, clearances,
 *     wattage, connector counts. No frame rates are produced here at all; those
 *     come from stored `Benchmark` rows via `@/lib/benchmarks` and are absent
 *     wherever nothing has been measured.
 *
 *  4. **Stay under the ceiling where possible.** When the target is not
 *     reachable the closest complete build is returned with the shortfall
 *     stated, not silently rounded away.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BUILDER_PART_SELECT, toBuilderPart } from "@/lib/specs";
import {
  checkCompatibility,
  estimatePower,
  normalizeConnector,
  partPrice,
  rankCandidates,
  type CandidateVerdict,
} from "@/lib/compatibility";
import {
  BUILD_GOALS,
  FPS_TARGETS,
  KIND_META,
  RESOLUTIONS,
  type BuilderPart,
  type BuildGoal,
  type BuildSelection,
  type CompatibilityIssue,
  type CompatibilityReport,
  type ComponentKind,
  type GoalOption,
  type TargetFps,
  type TargetResolution,
  isComponentKind,
} from "@/lib/types";
import { formatPKR, pluralize } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

export type RecommendInput = {
  goal: BuildGoal;
  budgetMin: number;
  /** `null` for an open-ended band — normalisation caps it and says so. */
  budgetMax: number | null;
  resolution: TargetResolution;
  targetFps: TargetFps;
  games: string[];
};

export type NormalizedRecommendInput = {
  goal: BuildGoal;
  budgetMin: number;
  budgetMax: number;
  /**
   * The spend below which the build is under-using the budget. A customer who
   * says "up to three lakh" is not asking for a two-lakh machine, so landing
   * beneath this is worth saying out loud rather than quietly banking.
   */
  budgetFloor: number;
  resolution: TargetResolution;
  targetFps: TargetFps;
  games: string[];
  /** True when an open-ended budget was capped to give the engine a ceiling. */
  budgetCapped: boolean;
};

/** Below this nothing in the catalogue adds up to a working PC. */
const ABSOLUTE_FLOOR_PKR = 60_000;

/** How much of the ceiling we try to actually spend before we stop upgrading. */
const SPEND_TARGET_RATIO = 0.85;

/** Open-ended budgets ("PKR 600,000+") get this multiple of the floor as a cap. */
const OPEN_BUDGET_MULTIPLE = 1.5;

export function normalizeRecommendInput(raw: RecommendInput): NormalizedRecommendInput {
  const goal: BuildGoal = BUILD_GOALS.some((g) => g.id === raw.goal) ? raw.goal : "gaming";
  const resolution: TargetResolution = RESOLUTIONS.includes(raw.resolution)
    ? raw.resolution
    : "1440p";
  const targetFps: TargetFps = FPS_TARGETS.some((f) => f.value === raw.targetFps)
    ? raw.targetFps
    : 144;

  const min = Math.max(0, Math.round(raw.budgetMin || 0));
  const budgetCapped = raw.budgetMax === null || !Number.isFinite(raw.budgetMax);
  const rawMax = budgetCapped
    ? Math.round(Math.max(min, ABSOLUTE_FLOOR_PKR) * OPEN_BUDGET_MULTIPLE)
    : Math.round(raw.budgetMax as number);

  const budgetMax = Math.max(ABSOLUTE_FLOOR_PKR, rawMax);
  const budgetMin = Math.min(min, budgetMax);

  // Aim for the higher of "what they said they'd spend" and a sensible share of
  // the ceiling, but never above the ceiling itself.
  const budgetFloor = Math.min(
    budgetMax,
    Math.max(budgetMin, Math.round(budgetMax * SPEND_TARGET_RATIO)),
  );

  const games = [...new Set(raw.games.map((g) => g.trim()).filter(Boolean))].slice(0, 12);

  return { goal, budgetMin, budgetMax, budgetFloor, resolution, targetFps, games, budgetCapped };
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `BuilderPart` plus the three CPU columns the compatibility engine has no use
 * for but a *rationale* does. Structurally a `BuilderPart`, so it drops
 * straight into a `BuildSelection`.
 */
export type RecommendPart = BuilderPart & {
  cores: number | null;
  threads: number | null;
  boostClock: number | null;
};

const RECOMMEND_PART_SELECT = {
  ...BUILDER_PART_SELECT,
  cores: true,
  threads: true,
  boostClock: true,
} satisfies Prisma.ProductSelect;

/** Kinds the engine fills, in the order it fills them. */
const PICK_ORDER: ComponentKind[] = [
  "gpu",
  "cpu",
  "motherboard",
  "ram",
  "storage",
  "cooler",
  "case",
  "fan",
  "psu",
];

/** Every kind the engine touches, including the one it picks up front. */
const ALL_KINDS: ComponentKind[] = ["os", ...PICK_ORDER];

type Catalog = Record<string, RecommendPart[]>;

/** One query for every kind the engine needs, grouped by kind. */
export async function loadRecommendCatalog(): Promise<Catalog> {
  const rows = await prisma.product.findMany({
    where: { kind: { in: ALL_KINDS }, status: "active" },
    select: RECOMMEND_PART_SELECT,
    orderBy: [{ price: "asc" }],
    take: 1000,
  });

  const catalog: Catalog = {};
  for (const kind of ALL_KINDS) catalog[kind] = [];

  for (const row of rows) {
    const bucket = catalog[row.kind];
    if (!bucket) continue;
    bucket.push({
      ...toBuilderPart(row),
      cores: row.cores,
      threads: row.threads,
      boostClock: row.boostClock,
    });
  }

  return catalog;
}

/* -------------------------------------------------------------------------- */
/* Budget allocation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Baseline share of the hardware budget per kind, before the goal weights and
 * the resolution / frame-rate adjustments are applied. Sums to 1 across the
 * nine kinds in `PICK_ORDER` — the operating system is decided separately
 * because a licence is a fixed price, not a share of anything.
 */
const BASE_SHARE: Record<string, number> = {
  gpu: 0.34,
  cpu: 0.19,
  motherboard: 0.105,
  ram: 0.075,
  storage: 0.075,
  psu: 0.085,
  cooler: 0.05,
  case: 0.06,
  fan: 0.02,
};

/**
 * Resolution moves money between the two parts that decide frame rate. At 4K
 * the GPU is doing almost all the work; at 1080p the CPU is usually the wall.
 */
const RESOLUTION_TILT: Record<TargetResolution, { cpu: number; gpu: number }> = {
  "1080p": { cpu: 1.15, gpu: 0.85 },
  "1440p": { cpu: 0.98, gpu: 1.06 },
  "4K": { cpu: 0.82, gpu: 1.28 },
};

/** A high frame-rate target is a CPU problem long before it is a GPU one. */
const FPS_TILT: Record<number, { cpu: number; gpu: number }> = {
  60: { cpu: 0.9, gpu: 1.05 },
  120: { cpu: 1.0, gpu: 1.0 },
  144: { cpu: 1.06, gpu: 1.0 },
  240: { cpu: 1.22, gpu: 1.02 },
};

/**
 * A Windows licence is only worth carving out of a budget once the hardware
 * *left underneath it* is worth running. Measured after the licence is paid
 * for, not before: at PKR 220,000 a Windows licence is a seventh of the machine
 * and the difference between a mechanical boot drive and an NVMe one. Below the
 * threshold the engine picks the catalogue's zero-rupee "No Operating System"
 * line instead and says why.
 */
const OS_THRESHOLD: Record<string, number> = {
  // A machine bought to work on is not usable without an operating system, so
  // these give up more hardware to keep the licence.
  office: 90_000,
  editing: 130_000,
  rendering: 130_000,
  ai: 130_000,
};
const OS_THRESHOLD_DEFAULT = 200_000;

export type BudgetAllocation = {
  kind: ComponentKind;
  label: string;
  allocated: number;
};

/**
 * Splits `hardwareBudget` across the nine hardware kinds using the chosen
 * goal's `weights`, tilted by resolution and frame-rate target.
 *
 * Exported because the result is shown to the customer: the wizard explains
 * where their money went, and that explanation has to be the same arithmetic
 * the picker actually used.
 */
export function allocateBudget(
  hardwareBudget: number,
  goal: GoalOption,
  resolution: TargetResolution,
  targetFps: TargetFps,
): Record<string, number> {
  const weighted: Record<string, number> = {};

  for (const kind of PICK_ORDER) {
    let share = BASE_SHARE[kind] ?? 0;

    // The goal's own emphasis, which only covers the four kinds it names.
    if (kind === "cpu") share *= goal.weights.cpu;
    else if (kind === "gpu") share *= goal.weights.gpu;
    else if (kind === "ram") share *= goal.weights.ram;
    else if (kind === "storage") share *= goal.weights.storage;

    const resTilt = RESOLUTION_TILT[resolution];
    const fpsTilt = FPS_TILT[targetFps] ?? { cpu: 1, gpu: 1 };
    if (kind === "cpu") share *= resTilt.cpu * fpsTilt.cpu;
    if (kind === "gpu") share *= resTilt.gpu * fpsTilt.gpu;

    weighted[kind] = share;
  }

  const total = Object.values(weighted).reduce((sum, v) => sum + v, 0) || 1;
  const out: Record<string, number> = {};
  for (const kind of PICK_ORDER) {
    out[kind] = Math.max(0, Math.round((weighted[kind] / total) * hardwareBudget));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * VRAM we would want a card to carry at each resolution. Below it the card
 * still works — it is a preference, applied as a score penalty, never a filter,
 * and the shortfall is stated out loud in the result notes.
 */
const VRAM_TARGET: Record<TargetResolution, number> = {
  "1080p": 8,
  "1440p": 12,
  "4K": 16,
};

/** Goals where more cores genuinely convert into finished work. */
const THROUGHPUT_GOALS = new Set<BuildGoal>(["editing", "rendering", "ai", "streaming"]);
/** Goals where per-core speed and cache decide the result. */
const LATENCY_GOALS = new Set<BuildGoal>(["gaming", "competitive", "gaming-streaming"]);

function isX3D(part: RecommendPart): boolean {
  return /x3d/i.test(part.name);
}

/**
 * Within one kind, higher is better. The numbers are only ever compared to each
 * other, never displayed — price is used as the tier signal because in this
 * catalogue it tracks the actual product stack, and the real attributes on top
 * of it (VRAM, cores, cache, capacity, interface) do the correcting.
 */
function scoreGpu(part: RecommendPart, resolution: TargetResolution): number {
  const price = partPrice(part);
  const want = VRAM_TARGET[resolution];
  const vram = part.vramGb ?? 0;

  let factor = 1;
  if (vram > 0 && vram < want) factor *= 0.8;
  else if (vram >= want + 4) factor *= 1.05;

  return price * factor;
}

function scoreCpu(part: RecommendPart, goal: BuildGoal): number {
  const price = partPrice(part);
  const cores = part.cores ?? 0;
  let factor = 1;

  if (LATENCY_GOALS.has(goal)) {
    // 3D V-Cache is the single largest per-rupee gain in CPU-bound games, and
    // core counts past eight do essentially nothing for them.
    if (isX3D(part)) factor *= 1.28;
    if (cores > 12) factor *= 0.88;
  }
  if (THROUGHPUT_GOALS.has(goal) && cores > 8) {
    factor *= 1 + Math.min(cores - 8, 16) * 0.02;
  }

  // Boost clock breaks ties between otherwise equivalent parts.
  return price * factor + (part.boostClock ?? 0) * 100;
}

function scoreMotherboard(part: RecommendPart): number {
  // Slots and connectivity are what a board is actually bought for; price is
  // the tie-break, cheaper winning, because a board never makes a game faster.
  const slots = (part.memorySlots ?? 2) * 4_000_000;
  const m2 = (part.m2Slots ?? 1) * 1_000_000;
  const ddr5 = part.memoryType === "DDR5" ? 6_000_000 : 0;
  return slots + m2 + ddr5 - partPrice(part);
}

function scoreRam(part: RecommendPart, goal: BuildGoal): number {
  const want = THROUGHPUT_GOALS.has(goal) ? 64 : 32;
  const capacity = part.capacityGb ?? 0;

  // Lexicographic: hit the target capacity first, then take the faster kit,
  // then the cheaper one. Overshooting the target is worth less than hitting it.
  const capacityRank = capacity === want ? 4 : capacity > want ? 3 : capacity >= want / 2 ? 2 : 1;
  return capacityRank * 100_000_000 + (part.memorySpeed ?? 0) * 1_000 - partPrice(part);
}

const STORAGE_RANK: Record<string, number> = {
  "nvme-gen5": 3,
  "nvme-gen4": 3,
  "nvme-gen3": 2,
  nvme: 3,
  sata: 1,
  hdd: 0,
};

/**
 * Past this the extra capacity stops being a recommendation and starts being a
 * preference — a second drive is a five-minute job on any of these boards, so
 * spare budget belongs in the parts that decide frame rate.
 */
const STORAGE_CAPACITY_CEILING_GB = 2000;

function scoreStorage(part: RecommendPart): number {
  const rank = STORAGE_RANK[part.storageInterface ?? ""] ?? 1;
  // NVMe first, then capacity up to the ceiling, then the cheaper of equals.
  return (
    rank * 1_000_000_000 +
    Math.min(part.capacityGb ?? 0, STORAGE_CAPACITY_CEILING_GB) * 100_000 -
    partPrice(part)
  );
}

function scoreCooler(part: RecommendPart, cpuTdp: number): number {
  const capacity = part.coolingCapacityW ?? 0;
  // Enough headroom over the CPU's rating is the whole job; beyond that, the
  // cheaper unit wins. `cooler-capacity` (a warning) enforces the floor.
  const adequate = capacity >= cpuTdp ? 1 : 0;
  return adequate * 1_000_000_000 + Math.min(capacity, cpuTdp + 80) * 100_000 - partPrice(part);
}

/** Clearance beyond the card's length that counts as "room to upgrade later". */
const CASE_CLEARANCE_MARGIN_MM = 45;

function scoreCase(part: RecommendPart, gpuLengthMm: number): number {
  // Included fans come first: they are the difference between a chassis that
  // moves air out of the box and one that needs a second purchase, and three is
  // where intake-plus-exhaust stops improving. Clearance then counts only up to
  // comfortably past the chosen card — beyond that a bigger chassis buys
  // nothing, so the cheaper one wins and the spare budget stays available for
  // the parts that decide frame rate.
  const fans = Math.min(part.includedFans ?? 0, 3);
  const useful = Math.min(part.maxGpuLengthMm ?? 0, gpuLengthMm + CASE_CLEARANCE_MARGIN_MM);
  return fans * 200_000_000 + useful * 1_000_000 - partPrice(part);
}

function scorePsu(part: RecommendPart, recommendedW: number): number {
  const wattage = part.wattage ?? 0;
  if (wattage < recommendedW) {
    // Still selectable if nothing better fits, but always ranked below a unit
    // that meets the engine's own recommendation.
    return -1_000_000_000 + wattage * 1_000;
  }
  // The smallest unit at or above the recommendation, then the cheaper of two.
  return 1_000_000_000 - (wattage - recommendedW) * 10_000 - partPrice(part);
}

function scoreFan(part: RecommendPart): number {
  return -partPrice(part);
}

/* -------------------------------------------------------------------------- */
/* Picking                                                                    */
/* -------------------------------------------------------------------------- */

type Picks = Record<string, RecommendPart[]>;

type Chosen = {
  part: RecommendPart;
  /** True when nothing compatible fitted the sub-budget and we went over it. */
  overAllocation: boolean;
  /** True when every compatible option in this kind is out of stock. */
  outOfStockOnly: boolean;
};

/**
 * Picks one part of `kind` against the parts already chosen.
 *
 * Compatibility is delegated wholesale to `rankCandidates`, which swaps each
 * candidate into a copy of the selection and re-runs the real engine. That is
 * why there are no socket or clearance checks in this file: a filter written
 * here could drift from the rule that later blocks the build.
 */
function choose(
  kind: ComponentKind,
  picks: Picks,
  catalog: Catalog,
  cap: number,
  score: (part: RecommendPart) => number,
  opts: { exclude?: Set<string>; requireCompatible?: boolean } = {},
): Chosen | null {
  const all = catalog[kind] ?? [];
  const candidates = opts.exclude ? all.filter((p) => !opts.exclude!.has(p.id)) : all;
  if (!candidates.length) return null;

  const byId = new Map(candidates.map((p) => [p.id, p]));
  const verdicts = rankCandidates(kind, candidates, picks);

  const compatible = verdicts.filter((v) => v.compatible);
  if (opts.requireCompatible && !compatible.length) return null;
  // Nothing fits: fall back to the whole list so the caller still gets a build,
  // and the final `checkCompatibility` reports the conflict honestly.
  const pool = compatible.length ? compatible : verdicts;

  const stocked = pool.filter((v) => v.part.stock > 0);
  const outOfStockOnly = stocked.length === 0;
  const usable = stocked.length ? stocked : pool;

  const affordable = usable.filter((v) => partPrice(v.part) <= cap);

  const warnFirst = (a: CandidateVerdict, b: CandidateVerdict) =>
    (a.warnings.length === 0 ? 0 : 1) - (b.warnings.length === 0 ? 0 : 1);

  let winner: CandidateVerdict;
  if (affordable.length) {
    winner = [...affordable].sort(
      (a, b) =>
        warnFirst(a, b) ||
        score(byId.get(b.part.id)!) - score(byId.get(a.part.id)!) ||
        partPrice(a.part) - partPrice(b.part),
    )[0];
  } else {
    // Over the sub-budget by necessity — take the cheapest thing that works.
    winner = [...usable].sort(
      (a, b) => warnFirst(a, b) || partPrice(a.part) - partPrice(b.part),
    )[0];
  }

  return {
    part: byId.get(winner.part.id)!,
    overAllocation: affordable.length === 0,
    outOfStockOnly,
  };
}

/**
 * The operating system line.
 *
 * Not part of the weighted split: a licence costs what it costs, so the only
 * real question is whether the budget is big enough to be worth spending on one
 * rather than on the hardware underneath it.
 */
function chooseOperatingSystem(
  catalog: Catalog,
  ceiling: number,
  goal: BuildGoal,
): RecommendPart | null {
  const options = catalog.os ?? [];
  if (!options.length) return null;

  const free = options.find((p) => partPrice(p) === 0) ?? null;
  const paid = options
    .filter((p) => partPrice(p) > 0 && p.stock > 0)
    .sort((a, b) => partPrice(a) - partPrice(b));

  if (!paid.length) return free;

  const threshold = OS_THRESHOLD[goal] ?? OS_THRESHOLD_DEFAULT;
  const licence = paid[0];
  return ceiling - partPrice(licence) >= threshold ? licence : (free ?? licence);
}

/* -------------------------------------------------------------------------- */
/* Repair                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which slot to change when a rule fires across two kinds. Lower goes first, so
 * a socket mismatch moves the motherboard rather than the processor and a
 * clearance failure moves the case rather than the graphics card — the parts
 * that define the machine's performance are the last ones touched.
 */
const MUTABILITY: Record<string, number> = {
  os: 0,
  fan: 1,
  cooler: 2,
  psu: 2,
  case: 3,
  storage: 4,
  ram: 5,
  motherboard: 6,
  cpu: 9,
  gpu: 10,
};

const MUTABILITY_DEFAULT = 5;

export type RepairRecord = {
  /** The engine's own issue id and title — never paraphrased. */
  issueId: string;
  issueTitle: string;
  kind: ComponentKind;
  from: string;
  to: string;
};

const MAX_REPAIR_PASSES = 18;

function clonePicks(picks: Picks): Picks {
  const out: Picks = {};
  for (const [kind, parts] of Object.entries(picks)) out[kind] = [...parts];
  return out;
}

/**
 * Runs the engine and substitutes the nearest compatible alternative until the
 * report has no errors left, or until no substitution is available.
 *
 * "Nearest" means closest in price to the part being replaced: a repair should
 * change what is broken, not quietly re-price the build. Parts already rejected
 * for a kind are excluded so the loop cannot oscillate between two conflicting
 * choices.
 */
function settle(
  picks: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
): { picks: Picks; report: CompatibilityReport; repairs: RepairRecord[] } {
  let current = clonePicks(picks);
  const repairs: RepairRecord[] = [];
  const rejected = new Map<string, Set<string>>();

  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass++) {
    const report = checkCompatibility(current);
    const errors = report.issues.filter((i) => i.severity === "error");
    const issue = errors[0];
    if (!issue) return { picks: current, report, repairs };

    const order = issue.kinds
      .filter((kind) => (current[kind]?.length ?? 0) > 0)
      .sort(
        (a, b) =>
          (MUTABILITY[a] ?? MUTABILITY_DEFAULT) - (MUTABILITY[b] ?? MUTABILITY_DEFAULT),
      );

    let applied = false;
    for (const kind of order) {
      const incumbent = current[kind][0];
      const replacement = repairSlot(
        kind,
        incumbent,
        issue,
        errors.length,
        current,
        catalog,
        caps,
        rejected,
      );
      if (!replacement) continue;

      repairs.push({
        issueId: issue.id,
        issueTitle: issue.title,
        kind,
        from: incumbent.name,
        to: replacement.name,
      });
      current = { ...current, [kind]: [replacement] };
      applied = true;
      break;
    }

    // Nothing left to substitute: return what we have with the issue intact.
    if (!applied) break;
  }

  return { picks: current, report: checkCompatibility(current), repairs };
}

/** How many alternatives one slot is tried with before the repair moves on. */
const REPAIR_TRIAL_LIMIT = 14;

/**
 * Finds the substitution for one slot that clears `issue`.
 *
 * A replacement is accepted when the issue is gone and the build is no worse
 * off overall — deliberately *not* "introduces nothing new". An AM5 processor
 * dropped onto a DDR4 board can only be rescued by moving the board and then
 * the memory kit, and each of those steps trades one error for another before
 * the last one clears both. Requiring every single move to be conflict-free
 * would make a platform change unreachable, which is exactly the substitution
 * customers most often need.
 *
 * Termination: a part is added to the slot's rejected set once it has been
 * moved away from, the error count is never allowed to rise, and the caller
 * caps the number of passes.
 */
function repairSlot(
  kind: ComponentKind,
  incumbent: RecommendPart,
  issue: CompatibilityIssue,
  errorsBefore: number,
  current: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
  rejected: Map<string, Set<string>>,
): RecommendPart | null {
  const exclude = rejected.get(kind) ?? new Set<string>();
  const incumbentPrice = partPrice(incumbent);

  // A repair may legitimately need to spend more than the slot's share — a
  // power supply with the right cabling is not optional — so the sub-budget is
  // relaxed to whatever the incumbent cost, with headroom.
  const cap = Math.max(caps[kind] ?? 0, Math.round(incumbentPrice * 1.75));

  const shortlist = (catalog[kind] ?? [])
    .filter((part) => part.id !== incumbent.id && !exclude.has(part.id))
    .sort(
      (a, b) =>
        // In stock first, then within the relaxed sub-budget, then nearest in
        // price: a repair changes what is broken, it does not re-price a build.
        (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
        (partPrice(a) <= cap ? 0 : 1) - (partPrice(b) <= cap ? 0 : 1) ||
        Math.abs(partPrice(a) - incumbentPrice) - Math.abs(partPrice(b) - incumbentPrice),
    )
    .slice(0, REPAIR_TRIAL_LIMIT);

  type Trial = { part: RecommendPart; errors: number; warnings: number; drift: number };
  let best: Trial | null = null;

  for (const candidate of shortlist) {
    const trial = checkCompatibility({ ...current, [kind]: [candidate] });
    const trialErrors = trial.issues.filter((i) => i.severity === "error");

    // The issue we were sent to fix has to actually be gone.
    if (trialErrors.some((i) => i.id === issue.id)) continue;
    if (trialErrors.length > errorsBefore) continue;

    const scored: Trial = {
      part: candidate,
      errors: trialErrors.length,
      warnings: trial.issues.filter((i) => i.severity === "warning").length,
      drift: Math.abs(partPrice(candidate) - incumbentPrice),
    };

    if (
      !best ||
      scored.errors < best.errors ||
      (scored.errors === best.errors && scored.warnings < best.warnings) ||
      (scored.errors === best.errors &&
        scored.warnings === best.warnings &&
        scored.drift < best.drift)
    ) {
      best = scored;
    }

    // Nothing beats a clean, warning-free result at the nearest price, and the
    // shortlist is already ordered by price proximity.
    if (best.errors === 0 && best.warnings === 0) break;
  }

  if (!best) return null;

  exclude.add(incumbent.id);
  rejected.set(kind, exclude);
  return best.part;
}

function stripKind(picks: Picks, kind: ComponentKind): Picks {
  const out = clonePicks(picks);
  delete out[kind];
  return out;
}

/* -------------------------------------------------------------------------- */
/* Trimming and upgrading                                                     */
/* -------------------------------------------------------------------------- */

/** Cheapest thing to give up first when the build lands over the ceiling. */
const TRIM_ORDER: ComponentKind[] = [
  "fan",
  "case",
  "cooler",
  "storage",
  "ram",
  "motherboard",
  "os",
  "psu",
  "cpu",
  "gpu",
];

/**
 * Where leftover budget buys the most, once every slot has had its planned
 * share. Until then the upgrade pass works on whichever slot is furthest below
 * its allocation, because the allocation *is* the plan — spending the last
 * rupee on a bigger card while the processor is still two tiers below what the
 * split called for produces exactly the bottleneck the split existed to avoid.
 */
const UPGRADE_ORDER: ComponentKind[] = [
  "gpu",
  "cpu",
  "motherboard",
  "ram",
  "storage",
  "cooler",
  "case",
];

const MAX_BUDGET_MOVES = 10;

/**
 * How many candidates each budget move tries before giving up on a slot. Every
 * trial runs the repair loop, so this bounds the work: the list is already
 * sorted best-first, and a move that needs the ninth-best option is not the
 * move that was going to fix the build.
 */
const BUDGET_TRIAL_LIMIT = 8;

/**
 * How far past its planned share one slot may reach while another is still
 * short of its own. Just enough to cross a price boundary — the next board up,
 * the next capacity — without turning the split into a suggestion.
 */
const ALLOCATION_OVERSHOOT = 1.1;

function total(picks: Picks): number {
  return Object.values(picks)
    .flat()
    .reduce((sum, part) => sum + partPrice(part), 0);
}

type SettleResult = {
  picks: Picks;
  report: CompatibilityReport;
  repairs: RepairRecord[];
};

/**
 * Brings the power supply up to the engine's own recommendation.
 *
 * A unit below `recommendedPsuW` but above the estimated draw is not an error —
 * `checkCompatibility` allows it, and at a tight budget it is the right call.
 * But once a bigger card has been upgraded in, the recommendation moves, and
 * shipping a machine whose own power panel says it wants more supply than it
 * has is not a recommendation anyone should act on. So every upgrade carries
 * the cost of the supply it implies, and is rejected if the pair does not fit.
 */
function enforcePsu(
  state: SettleResult,
  catalog: Catalog,
  caps: Record<string, number>,
  ceiling: number,
): SettleResult {
  const psu = state.picks.psu?.[0];
  if (!psu) return state;

  const recommended = state.report.power.recommendedPsuW;
  if ((psu.wattage ?? 0) >= recommended) return state;

  const spend = total(state.picks);
  const psuPrice = partPrice(psu);

  const candidates = (catalog.psu ?? [])
    .filter(
      (part) =>
        part.id !== psu.id &&
        part.stock > 0 &&
        (part.wattage ?? 0) >= recommended &&
        spend - psuPrice + partPrice(part) <= ceiling,
    )
    .sort((a, b) => scorePsu(b, recommended) - scorePsu(a, recommended))
    .slice(0, BUDGET_TRIAL_LIMIT);

  for (const candidate of candidates) {
    const trial = settle({ ...state.picks, psu: [candidate] }, catalog, caps);
    if (trial.report.status === "error") continue;
    if (total(trial.picks) > ceiling) continue;

    return {
      picks: trial.picks,
      report: trial.report,
      repairs: [
        ...state.repairs,
        {
          issueId: "psu-headroom",
          issueTitle: `Sized up to the ${recommended}W supply this build asks for`,
          kind: "psu",
          from: psu.name,
          to: candidate.name,
        },
        ...trial.repairs,
      ],
    };
  }

  return state;
}

/**
 * Brings the build under the ceiling by taking the smallest cut that gets there.
 *
 * Every candidate move is settled and re-checked before it is accepted, so a
 * cheaper part that breaks the machine is reverted rather than shipped.
 */
function trimToBudget(
  picks: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
  ceiling: number,
): { picks: Picks; report: CompatibilityReport; repairs: RepairRecord[] } {
  let settled = settle(picks, catalog, caps);
  let repairs = [...settled.repairs];

  for (let move = 0; move < MAX_BUDGET_MOVES; move++) {
    const spend = total(settled.picks);
    if (spend <= ceiling) break;

    const excess = spend - ceiling;
    let applied = false;

    for (const kind of TRIM_ORDER) {
      const incumbent = settled.picks[kind]?.[0];
      if (!incumbent) continue;
      const incumbentPrice = partPrice(incumbent);
      if (incumbentPrice === 0) continue;

      // Smallest cut first: the most expensive option that still closes the
      // gap, then progressively deeper cuts if the cascade eats the saving.
      const cheaper = (catalog[kind] ?? [])
        .filter((p) => p.id !== incumbent.id && partPrice(p) < incumbentPrice && p.stock > 0)
        .sort((a, b) => partPrice(b) - partPrice(a));
      if (!cheaper.length) continue;

      const start = cheaper.findIndex((p) => incumbentPrice - partPrice(p) >= excess);
      const ordered = start > 0 ? [...cheaper.slice(start), ...cheaper.slice(0, start)] : cheaper;

      for (const candidate of ordered.slice(0, BUDGET_TRIAL_LIMIT)) {
        // Compatibility is not pre-filtered: `settle` is allowed to cascade a
        // cheaper processor into a cheaper board and memory kit, which is often
        // the only way a build actually comes down in price.
        const trialSettled = settle({ ...settled.picks, [kind]: [candidate] }, catalog, caps);
        if (trialSettled.report.status === "error") continue;
        if (total(trialSettled.picks) >= spend) continue;

        settled = trialSettled;
        repairs = [...repairs, ...trialSettled.repairs];
        applied = true;
        break;
      }

      if (applied) break;
    }

    if (!applied) break;
  }

  return { picks: settled.picks, report: settled.report, repairs };
}

/* -------------------------------------------------------------------------- */
/* Minimum specification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Specifications a machine at this price should not ship without.
 *
 * These run *before* the general upgrade pass, because leftover budget spent on
 * a bigger graphics card is wasted if the build is still loading from a
 * mechanical drive or running 16GB of memory. Each rule is a floor, not a
 * preference: it fires only when the current pick fails it, spends the smallest
 * amount that clears it, and is skipped entirely when the money is not there.
 */
type FloorContext = { cpuTdp: number; wantRamGb: number };

type FloorRule = {
  kind: ComponentKind;
  /** Named concretely, because this text is what a customer reads when it fails. */
  shortfall: (ctx: FloorContext) => string;
  satisfied: (part: RecommendPart, ctx: FloorContext) => boolean;
};

const FLOOR_RULES: FloorRule[] = [
  {
    kind: "storage",
    shortfall: () => "a 1TB NVMe boot drive",
    satisfied: (part) =>
      (STORAGE_RANK[part.storageInterface ?? ""] ?? 0) >= 2 && (part.capacityGb ?? 0) >= 1000,
  },
  {
    kind: "ram",
    shortfall: (ctx) => `${ctx.wantRamGb}GB of memory`,
    satisfied: (part, ctx) => (part.capacityGb ?? 0) >= ctx.wantRamGb,
  },
  {
    kind: "cooler",
    shortfall: (ctx) => `a cooler rated past the processor's ${ctx.cpuTdp}W`,
    satisfied: (part, ctx) => (part.coolingCapacityW ?? 0) >= ctx.cpuTdp,
  },
];

function raiseFloors(
  picks: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
  ceiling: number,
  goal: BuildGoal,
): { picks: Picks; report: CompatibilityReport; repairs: RepairRecord[]; unmet: string[] } {
  let settled = settle(picks, catalog, caps);
  let repairs = [...settled.repairs];
  const unmet: string[] = [];

  for (const rule of FLOOR_RULES) {
    const incumbent = settled.picks[rule.kind]?.[0];
    if (!incumbent) continue;

    const ctx: FloorContext = {
      cpuTdp: settled.picks.cpu?.[0]?.tdp ?? 0,
      wantRamGb: THROUGHPUT_GOALS.has(goal) ? 64 : 32,
    };
    if (rule.satisfied(incumbent, ctx)) continue;

    const headroom = ceiling - total(settled.picks);
    const incumbentPrice = partPrice(incumbent);

    const candidates = (catalog[rule.kind] ?? []).filter(
      (part) =>
        part.id !== incumbent.id &&
        part.stock > 0 &&
        rule.satisfied(part, ctx) &&
        partPrice(part) - incumbentPrice <= headroom,
    );
    if (!candidates.length) {
      unmet.push(rule.shortfall(ctx));
      continue;
    }

    // Cheapest part that clears the floor — this pass buys adequacy, not tier.
    const verdicts = rankCandidates(rule.kind, candidates, stripKind(settled.picks, rule.kind));
    const byId = new Map(candidates.map((p) => [p.id, p]));
    const viable = verdicts
      .filter((v) => v.compatible)
      .map((v) => byId.get(v.part.id)!)
      .sort((a, b) => partPrice(a) - partPrice(b));

    let applied = false;
    for (const candidate of viable) {
      const trial = settle({ ...settled.picks, [rule.kind]: [candidate] }, catalog, caps);
      if (trial.report.status === "error") continue;
      if (total(trial.picks) > ceiling) continue;
      settled = trial;
      repairs = [...repairs, ...trial.repairs];
      applied = true;
      break;
    }
    if (!applied) unmet.push(rule.shortfall(ctx));
  }

  return { picks: settled.picks, report: settled.report, repairs, unmet };
}

/**
 * Spends what is left.
 *
 * A customer who says "up to three lakh" wants a three-lakh machine, not a
 * two-lakh one with change. Every move must be a genuine improvement on the
 * kind's own scale — and those scales are capped (clearance past the card,
 * capacity past 2TB, cooling past the CPU's rating buy nothing), so the pass
 * runs out of worthwhile purchases rather than burning the last rupee.
 *
 * Each upgrade is settled and re-checked, and is reverted if it pushes past the
 * ceiling or breaks compatibility — which is how a bigger card that outgrows
 * the power supply either takes a bigger PSU with it or does not happen at all.
 */
function upgradeIntoBudget(
  picks: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
  ceiling: number,
  resolution: TargetResolution,
  goal: BuildGoal,
): { picks: Picks; report: CompatibilityReport; repairs: RepairRecord[] } {
  let settled = settle(picks, catalog, caps);
  let repairs = [...settled.repairs];

  const scoreOf = (kind: ComponentKind, part: RecommendPart): number => {
    switch (kind) {
      case "gpu":
        return scoreGpu(part, resolution);
      case "cpu":
        return scoreCpu(part, goal);
      case "ram":
        return scoreRam(part, goal);
      case "storage":
        return scoreStorage(part);
      case "motherboard":
        return scoreMotherboard(part);
      case "cooler":
        return scoreCooler(part, settled.picks.cpu?.[0]?.tdp ?? 100);
      case "case":
        return scoreCase(part, settled.picks.gpu?.[0]?.gpuLengthMm ?? 340);
      default:
        return -partPrice(part);
    }
  };

  for (let move = 0; move < MAX_BUDGET_MOVES; move++) {
    const spend = total(settled.picks);
    const headroom = ceiling - spend;
    if (headroom <= 0) break;

    let applied = false;

    // Biggest shortfall against the plan first. Once every slot has met its
    // allocation every shortfall is zero or negative, the comparison ties, and
    // the order falls back to `UPGRADE_ORDER` — so the genuine surplus does go
    // to the graphics card, but only after the plan has actually been met.
    const shortfall = (kind: ComponentKind) => {
      const current = settled.picks[kind]?.[0];
      // An unfilled slot has nothing to upgrade, so it never claims priority.
      return current ? (caps[kind] ?? 0) - partPrice(current) : 0;
    };

    const order = [...UPGRADE_ORDER].sort(
      (a, b) =>
        Math.max(0, shortfall(b)) - Math.max(0, shortfall(a)) ||
        UPGRADE_ORDER.indexOf(a) - UPGRADE_ORDER.indexOf(b),
    );

    for (const kind of order) {
      const incumbent = settled.picks[kind]?.[0];
      if (!incumbent) continue;
      const incumbentPrice = partPrice(incumbent);
      const incumbentScore = scoreOf(kind, incumbent);

      // While a slot is still under its planned share, one upgrade must not
      // blow straight past that share: the plan is what keeps a build balanced,
      // and a processor three tiers above its allocation is how you end up with
      // a machine that is fast in exactly one dimension. Once every slot has
      // met its share this ceiling lifts and the surplus goes where it counts.
      const planCap =
        shortfall(kind) > 0
          ? Math.round(Math.max(caps[kind] ?? 0, incumbentPrice) * ALLOCATION_OVERSHOOT)
          : Number.POSITIVE_INFINITY;

      const candidates = (catalog[kind] ?? [])
        .filter(
          (p) =>
            p.id !== incumbent.id &&
            p.stock > 0 &&
            partPrice(p) > incumbentPrice &&
            partPrice(p) <= planCap &&
            partPrice(p) - incumbentPrice <= headroom &&
            scoreOf(kind, p) > incumbentScore,
        )
        .sort((a, b) => scoreOf(kind, b) - scoreOf(kind, a));

      for (const candidate of candidates.slice(0, BUDGET_TRIAL_LIMIT)) {
        // Deliberately not pre-filtered for compatibility: a better processor on
        // a different socket is only reachable if the repair loop is allowed to
        // bring the motherboard and the memory with it. The trial is accepted
        // only if the whole cascade settles clean and still fits the ceiling.
        const raw = settle({ ...settled.picks, [kind]: [candidate] }, catalog, caps);
        if (raw.report.status === "error") continue;

        // A bigger card has to pay for the supply it needs, in the same move.
        const trialSettled = enforcePsu(raw, catalog, caps, ceiling);
        if (trialSettled.report.status === "error") continue;

        const landed = trialSettled.picks[kind]?.[0];
        // A cascade that repaired away the very part we were upgrading to has
        // not improved anything.
        if (!landed || scoreOf(kind, landed) <= incumbentScore) continue;

        // Nor may a cascade walk the platform backwards. Swapping a DDR5 board
        // for a DDR4 one to afford a different processor trades the machine's
        // whole upgrade path for a better number in one slot.
        if (
          settled.picks.motherboard?.[0]?.memoryType === "DDR5" &&
          trialSettled.picks.motherboard?.[0]?.memoryType === "DDR4"
        ) {
          continue;
        }

        const trialTotal = total(trialSettled.picks);
        if (trialTotal > ceiling || trialTotal <= spend) continue;

        settled = trialSettled;
        repairs = [...repairs, ...trialSettled.repairs];
        applied = true;
        break;
      }

      if (applied) break;
    }

    if (!applied) break;
  }

  return { picks: settled.picks, report: settled.report, repairs };
}

/* -------------------------------------------------------------------------- */
/* Rationale                                                                  */
/* -------------------------------------------------------------------------- */

const CONNECTOR_LABEL: Record<string, string> = {
  "12vhpwr": "12VHPWR",
  pcie8: "8-pin PCIe",
  pcie6: "6-pin PCIe",
};

function joinSentences(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

function storageLabel(part: BuilderPart): string {
  const capacity =
    part.capacityGb === null
      ? ""
      : part.capacityGb >= 1000 && part.capacityGb % 1000 === 0
        ? `${part.capacityGb / 1000}TB`
        : `${part.capacityGb}GB`;
  const iface =
    part.storageInterface === "nvme-gen5"
      ? "NVMe Gen5"
      : part.storageInterface === "nvme-gen4"
        ? "NVMe Gen4"
        : part.storageInterface === "nvme-gen3"
          ? "NVMe Gen3"
          : part.storageInterface === "sata"
            ? "SATA SSD"
            : part.storageInterface === "hdd"
              ? "hard drive"
              : "drive";
  return `${capacity} ${iface}`.trim();
}

/**
 * A specific reason, assembled from the columns this exact part carries.
 *
 * Every clause is guarded: a part missing a spec loses that clause rather than
 * gaining a made-up one, so nothing here can state a figure the catalogue does
 * not hold.
 */
function rationaleFor(
  kind: ComponentKind,
  part: RecommendPart,
  picks: Picks,
  report: CompatibilityReport,
  input: NormalizedRecommendInput,
): string {
  const cpu = picks.cpu?.[0] ?? null;
  const gpu = picks.gpu?.[0] ?? null;
  const board = picks.motherboard?.[0] ?? null;
  const pcCase = picks.case?.[0] ?? null;

  switch (kind) {
    case "gpu": {
      const specs = joinSentences([
        part.vramGb ? `${part.vramGb}GB of VRAM` : null,
        part.vramGb && part.tdp ? "and" : null,
        part.tdp ? `${part.tdp}W board power` : null,
      ]);
      const want = VRAM_TARGET[input.resolution];
      const vram = part.vramGb ?? 0;

      const fit =
        input.resolution === "4K"
          ? vram >= want
            ? `At 4K the card does nearly all the work, and ${vram}GB keeps textures at maximum.`
            : `At 4K we would normally want ${want}GB; this is what your ceiling reaches, so expect to drop texture settings in the heaviest titles.`
          : input.resolution === "1440p"
            ? vram >= want
              ? `${vram}GB is the headroom that keeps 1440p at ${input.targetFps} FPS viable as titles get heavier.`
              : `${vram}GB is on the light side for 1440p — fine today, tighter as textures grow.`
            : `Comfortably more card than 1080p needs, which is why the budget leans on the processor for your ${input.targetFps} FPS target.`;

      const connectors = part.requiredConnectors?.length
        ? `Power is ${countConnectors(part.requiredConnectors)}, which set the supply below.`
        : null;

      return joinSentences([specs ? `${specs}.` : null, fit, connectors]);
    }

    case "cpu": {
      const specs = [
        part.cores ? `${part.cores} cores${part.threads ? ` / ${part.threads} threads` : ""}` : null,
        part.boostClock ? `${part.boostClock} GHz boost` : null,
        part.socket,
      ]
        .filter(Boolean)
        .join(" · ");

      const why = isX3D(part)
        ? "The 3D V-Cache is the largest per-rupee gain available in the games that bottleneck on the processor."
        : LATENCY_GOALS.has(input.goal)
          ? `Enough per-core speed to feed the card at ${input.resolution} without becoming the limit at ${input.targetFps} FPS.`
          : `Core count is where ${BUILD_GOALS.find((g) => g.id === input.goal)?.label.toLowerCase() ?? "this workload"} actually spends its time.`;

      const graphics = part.integratedGraphics
        ? "It also has integrated graphics, so the machine still boots to a display if the card ever comes out."
        : null;

      return joinSentences([specs ? `${specs}.` : null, why, graphics]);
    }

    case "motherboard": {
      const match = cpu?.socket
        ? `${part.chipset ?? "This chipset"} on ${part.socket} — the socket the ${cpu.name} needs.`
        : `${part.chipset ?? "This chipset"} on ${part.socket ?? "its socket"}.`;
      const memory = part.memorySlots
        ? `${part.memorySlots} DIMM ${pluralize(part.memorySlots, "slot")}${part.memoryType ? ` of ${part.memoryType}` : ""}${part.memorySpeed ? ` validated to ${part.memorySpeed} MT/s` : ""}.`
        : null;
      const storage = part.m2Slots
        ? `${part.m2Slots} M.2 ${pluralize(part.m2Slots, "slot")} for drives you add later.`
        : null;
      const size = part.formFactor ? `${part.formFactor} — it sets which cases fit.` : null;
      return joinSentences([match, memory, storage, size]);
    }

    case "ram": {
      const kit = joinSentences([
        part.capacityGb ? `${part.capacityGb}GB` : null,
        part.memoryType && part.memorySpeed
          ? `of ${part.memoryType}-${part.memorySpeed}`
          : part.memoryType
            ? `of ${part.memoryType}`
            : null,
        part.moduleCount ? `in ${part.moduleCount} ${pluralize(part.moduleCount, "module")}.` : ".",
      ]);
      const spare =
        board?.memorySlots && part.moduleCount && board.memorySlots > part.moduleCount
          ? `Leaves ${board.memorySlots - part.moduleCount} ${pluralize(board.memorySlots - part.moduleCount, "slot")} free on the ${board.name}.`
          : board?.memorySlots && part.moduleCount === board.memorySlots
            ? "Fills every slot on the board, so a later capacity bump means replacing the kit."
            : null;
      const why = THROUGHPUT_GOALS.has(input.goal)
        ? "Capacity is what stops a timeline or a model from spilling to disk."
        : "32GB is the comfortable amount for gaming with a browser, Discord and a capture tool open beside it.";
      return joinSentences([kit, spare, why]);
    }

    case "storage": {
      const label = storageLabel(part);
      const why =
        (part.capacityGb ?? 0) >= 2000
          ? "Room for Windows and a large installed library without juggling."
          : "Enough for Windows and a working rotation of current titles.";
      const later =
        board?.m2Slots && board.m2Slots > 1
          ? `The ${board.name} has ${board.m2Slots} M.2 slots, so a second drive is a five-minute job.`
          : board?.sataPorts
            ? `The ${board.name}'s single M.2 slot is taken by this drive; a second one goes on SATA.`
            : null;
      return joinSentences([`${label}.`, why, later]);
    }

    case "cooler": {
      const form =
        part.coolerType === "aio"
          ? part.radiatorSizeMm
            ? `${part.radiatorSizeMm}mm liquid cooler.`
            : "Liquid cooler."
          : part.coolerHeightMm
            ? `${part.coolerHeightMm}mm air cooler.`
            : "Air cooler.";
      const capacity =
        part.coolingCapacityW && cpu?.tdp
          ? `Rated around ${part.coolingCapacityW}W against the ${cpu.name}'s ${cpu.tdp}W, so it holds boost clocks instead of throttling.`
          : part.coolingCapacityW
            ? `Rated around ${part.coolingCapacityW}W.`
            : null;
      const fit =
        part.coolerType === "air" && part.coolerHeightMm && pcCase?.maxCoolerHeightMm
          ? `Clears the ${pcCase.name}'s ${pcCase.maxCoolerHeightMm}mm limit.`
          : part.coolerType === "aio" && part.radiatorSizeMm && pcCase
            ? `The ${pcCase.name} has a mount for the radiator.`
            : null;
      return joinSentences([form, capacity, fit]);
    }

    case "psu": {
      const power = report.power;
      const headline = joinSentences([
        part.wattage ? `${part.wattage}W` : null,
        part.efficiency ?? null,
        part.psuFormFactor === "SFX" ? "in the SFX format this case needs." : ".",
      ]).replace(" .", ".");
      const percent =
        power.estimatedWatts > 0 && part.wattage
          ? Math.round((power.estimatedWatts / part.wattage) * 100)
          : null;
      const load =
        percent === null
          ? null
          : `The build draws about ${power.estimatedWatts}W under load — ${percent}% of this unit.`;
      // The engine's sizing rule targets roughly 70% load. A unit a step under
      // it is still a sound choice, and saying that out loud is better than
      // quietly showing a recommendation the build does not meet.
      const sizing =
        part.wattage && power.recommendedPsuW > part.wattage
          ? `Our sizing rule would put ${power.recommendedPsuW}W on a build this size; at your ceiling this is the sound compromise, and it stays inside the safe band.`
          : percent !== null && percent <= 72
            ? "That is where a supply runs quietest, with room for a future card."
            : null;
      const cabling = gpu?.requiredConnectors?.length ? describeCabling(part, gpu) : null;
      return joinSentences([headline, load, sizing, cabling]);
    }

    case "case": {
      const boardFit = board?.formFactor
        ? `Takes ${board.formFactor} boards.`
        : part.supportedFormFactors?.length
          ? `Takes ${part.supportedFormFactors.join(", ")} boards.`
          : null;
      const gpuFit =
        gpu?.gpuLengthMm && part.maxGpuLengthMm
          ? `Clears the ${gpu.gpuLengthMm}mm card with ${part.maxGpuLengthMm - gpu.gpuLengthMm}mm to spare.`
          : null;
      const included = part.includedFans ?? 0;
      const fans =
        included > 0
          ? `Ships with ${included} ${pluralize(included, "fan")}, so airflow is sorted out of the box.`
          : "Ships without fans — a pack is included in this build below.";
      return joinSentences([boardFit, gpuFit, fans]);
    }

    case "fan": {
      return pcCase
        ? `The ${pcCase.name} ships with no fans. Without intake and exhaust the CPU and card throttle, so this pack is not optional.`
        : "Case airflow. Without intake and exhaust the CPU and card throttle.";
    }

    case "os": {
      if (partPrice(part) === 0) {
        return `No licence at this budget — every rupee goes into the hardware. Windows can be added at the counter whenever you want it.`;
      }
      return `${part.name}. Your ceiling covers the licence alongside the hardware, so the machine is ready to use rather than ready to install.`;
    }

    default:
      return part.headline ?? "";
  }
}

/** "1 × 12VHPWR" / "2 × 8-pin PCIe" — read straight off the card's own column. */
function countConnectors(required: string[]): string {
  const counts = new Map<string, number>();
  for (const raw of required) {
    const key = normalizeConnector(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => `${count} × ${CONNECTOR_LABEL[key] ?? key}`)
    .join(" and ");
}

function describeCabling(psu: BuilderPart, gpu: BuilderPart): string | null {
  const provided = psu.providedConnectors;
  if (!provided || !gpu.requiredConnectors?.length) return null;

  const needed = new Map<string, number>();
  for (const raw of gpu.requiredConnectors) {
    const key = normalizeConnector(raw);
    needed.set(key, (needed.get(key) ?? 0) + 1);
  }

  const missing = [...needed.entries()].filter(([key, count]) => (provided[key] ?? 0) < count);
  if (!missing.length) {
    return `It carries the ${[...needed.keys()].map((k) => CONNECTOR_LABEL[k] ?? k).join(" and ")} cabling the ${gpu.name} asks for natively.`;
  }
  if (missing.some(([key]) => key === "12vhpwr") && (provided.pcie8 ?? 0) >= 3) {
    return `It has no native 12VHPWR cable, but ${provided.pcie8} 8-pin outputs to drive the adapter that ships with the card.`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */

export type PartPick = {
  kind: ComponentKind;
  label: string;
  part: BuilderPart;
  /** What the customer pays for this part, after any sale price. */
  price: number;
  /** The slot's share of the budget, for the "where the money went" table. */
  allocated: number;
  /** Specific, built from this part's real attributes. */
  rationale: string;
  /** True when the repair loop swapped this slot to resolve a conflict. */
  repaired: boolean;
  /** The engine's own title for the conflict that forced the swap. */
  repairReason: string | null;
  inStock: boolean;
};

export type RecommendNote = {
  tone: "info" | "warning" | "error";
  text: string;
};

export type Recommendation = {
  input: NormalizedRecommendInput;
  goal: GoalOption;
  /** Ordered by `KIND_META.order` — the order the builder steps through. */
  parts: PartPick[];
  selection: BuildSelection;
  report: CompatibilityReport;
  budget: {
    min: number;
    max: number;
    floor: number;
    total: number;
    /** Positive when there is budget left; 0 once the build meets the ceiling. */
    remaining: number;
    /** Positive when the closest complete build costs more than the ceiling. */
    overBy: number;
    withinBudget: boolean;
    allocations: BudgetAllocation[];
  };
  /** Complete, compatible and inside the ceiling. */
  achievable: boolean;
  headline: string;
  summary: string;
  notes: RecommendNote[];
  repairs: RepairRecord[];
  /** Names of chosen parts that are not currently in stock. */
  outOfStock: string[];
  /** True while any chosen part still carries seeded sample pricing. */
  samplePricing: boolean;
  /** Suggested build name, used when the customer saves or quotes it. */
  suggestedName: string;
};

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The whole flow: allocate, pick, repair, fit to budget, explain.
 *
 * `catalog` is injectable so the same code can be exercised against a fixture
 * without a database.
 */
export async function recommendBuild(
  raw: RecommendInput,
  catalog?: Catalog,
): Promise<Recommendation> {
  const input = normalizeRecommendInput(raw);
  const parts = catalog ?? (await loadRecommendCatalog());
  return buildRecommendation(input, parts);
}

export function buildRecommendation(
  input: NormalizedRecommendInput,
  catalog: Catalog,
): Recommendation {
  const goal = BUILD_GOALS.find((g) => g.id === input.goal) ?? BUILD_GOALS[0];

  /* --- 1. Fixed lines, then the weighted split ---------------------------- */

  const os = chooseOperatingSystem(catalog, input.budgetMax, input.goal);
  const osCost = os ? partPrice(os) : 0;
  const hardwareBudget = Math.max(ABSOLUTE_FLOOR_PKR, input.budgetMax - osCost);
  const caps = allocateBudget(hardwareBudget, goal, input.resolution, input.targetFps);
  caps.os = osCost;

  /* --- 2. First pass, in dependency order --------------------------------- */

  let picks: Picks = {};
  if (os) picks.os = [os];

  const overAllocated = new Set<ComponentKind>();
  const stockStarved = new Set<ComponentKind>();
  const unfilled: ComponentKind[] = [];

  for (const kind of PICK_ORDER) {
    // Case fans are only bought when the case does not ship with any; the
    // engine's `no-fans` warning is exactly this condition.
    if (kind === "fan") {
      const chosenCase = picks.case?.[0];
      if (!chosenCase || (chosenCase.includedFans ?? 0) > 0) continue;
    }

    // The supply is sized from the machine it has to run, so it is chosen last
    // and against the engine's own recommendation for the parts already picked.
    const recommendedW =
      kind === "psu" ? estimatePower(picks).recommendedPsuW : 0;

    const cpuTdp = picks.cpu?.[0]?.tdp ?? 105;

    const score = (part: RecommendPart): number => {
      switch (kind) {
        case "gpu":
          return scoreGpu(part, input.resolution);
        case "cpu":
          return scoreCpu(part, input.goal);
        case "motherboard":
          return scoreMotherboard(part);
        case "ram":
          return scoreRam(part, input.goal);
        case "storage":
          return scoreStorage(part);
        case "cooler":
          return scoreCooler(part, cpuTdp);
        case "case":
          return scoreCase(part, picks.gpu?.[0]?.gpuLengthMm ?? 340);
        case "psu":
          return scorePsu(part, recommendedW);
        case "fan":
          return scoreFan(part);
        default:
          return -partPrice(part);
      }
    };

    const chosen = choose(kind, picks, catalog, caps[kind] ?? 0, score);
    if (!chosen) {
      unfilled.push(kind);
      continue;
    }
    if (chosen.overAllocation) overAllocated.add(kind);
    if (chosen.outOfStockOnly) stockStarved.add(kind);
    picks = { ...picks, [kind]: [chosen.part] };
  }

  /* --- 3. Repair, meet the floors, then fit to the budget ------------------ */

  let settled = settle(picks, catalog, caps);
  let repairs = [...settled.repairs];
  let unmetFloors: string[] = [];

  if (total(settled.picks) <= input.budgetMax) {
    // Adequacy before tier: a bigger card is wasted on a build still running a
    // mechanical boot drive or half the memory it wants.
    const floors = raiseFloors(settled.picks, catalog, caps, input.budgetMax, input.goal);
    settled = { picks: floors.picks, report: floors.report, repairs: floors.repairs };
    repairs = [...repairs, ...floors.repairs];
    unmetFloors = floors.unmet;
  }

  if (total(settled.picks) > input.budgetMax) {
    const trimmed = trimToBudget(settled.picks, catalog, caps, input.budgetMax);
    settled = { picks: trimmed.picks, report: trimmed.report, repairs: trimmed.repairs };
    repairs = [...repairs, ...trimmed.repairs];
  } else {
    const upgraded = upgradeIntoBudget(
      settled.picks,
      catalog,
      caps,
      input.budgetMax,
      input.resolution,
      input.goal,
    );
    settled = { picks: upgraded.picks, report: upgraded.report, repairs: upgraded.repairs };
    repairs = [...repairs, ...upgraded.repairs];
  }

  // The floors are re-checked after the budget passes: a processor upgraded
  // across sockets can outgrow its cooler, and a bigger card moves the power
  // recommendation. Both are cheap to re-run and neither can push past the
  // ceiling — each candidate move is rejected if it would.
  if (total(settled.picks) <= input.budgetMax) {
    const floors = raiseFloors(settled.picks, catalog, caps, input.budgetMax, input.goal);
    settled = { picks: floors.picks, report: floors.report, repairs: floors.repairs };
    repairs = [...repairs, ...floors.repairs];
    unmetFloors = [...new Set([...unmetFloors, ...floors.unmet])];

    const sized = enforcePsu(settled, catalog, caps, input.budgetMax);
    repairs = [...repairs, ...sized.repairs.slice(settled.repairs.length)];
    settled = sized;
  }

  // A case swapped in during repair or trimming can turn the fan pack from
  // necessary into redundant, or the other way round.
  settled = reconcileFans(settled.picks, catalog, caps);
  repairs = [...repairs, ...settled.repairs];

  const finalPicks = settled.picks;
  const report = settled.report;

  /* --- 4. Explain --------------------------------------------------------- */

  const repairedKinds = new Map<string, string>();
  for (const repair of repairs) repairedKinds.set(repair.kind, repair.issueTitle);

  const chosen: { kind: ComponentKind; part: RecommendPart }[] = [];
  for (const [key, list] of Object.entries(finalPicks)) {
    const part = list[0];
    if (!part || !isComponentKind(key)) continue;
    chosen.push({ kind: key, part });
  }
  chosen.sort((a, b) => KIND_META[a.kind].order - KIND_META[b.kind].order);

  const partPicks: PartPick[] = chosen.map(({ kind, part }) => ({
    kind,
    label: KIND_META[kind].label,
    part,
    price: partPrice(part),
    allocated: caps[kind] ?? 0,
    rationale: rationaleFor(kind, part, finalPicks, report, input),
    repaired: repairedKinds.has(kind),
    repairReason: repairedKinds.get(kind) ?? null,
    inStock: part.stock > 0,
  }));

  const spend = partPicks.reduce((sum, pick) => sum + pick.price, 0);
  const withinBudget = spend <= input.budgetMax;
  const achievable = withinBudget && report.status !== "error" && report.complete;

  const notes = buildNotes(input, finalPicks, report, spend, {
    unfilled,
    overAllocated,
    stockStarved,
    unmetFloors,
  });

  const gpu = finalPicks.gpu?.[0] ?? null;
  const cpu = finalPicks.cpu?.[0] ?? null;

  return {
    input,
    goal,
    parts: partPicks,
    selection: finalPicks,
    report,
    budget: {
      min: input.budgetMin,
      max: input.budgetMax,
      floor: input.budgetFloor,
      total: spend,
      remaining: Math.max(0, input.budgetMax - spend),
      overBy: Math.max(0, spend - input.budgetMax),
      withinBudget,
      allocations: PICK_ORDER.filter((kind) => finalPicks[kind]?.length).map((kind) => ({
        kind,
        label: KIND_META[kind].label,
        allocated: caps[kind] ?? 0,
      })),
    },
    achievable,
    headline: `${input.resolution} at ${input.targetFps} FPS · ${goal.label}`,
    summary: joinSentences([
      gpu && cpu ? `${gpu.name} paired with the ${cpu.name}.` : null,
      report.power.estimatedWatts > 0
        ? `About ${report.power.estimatedWatts}W under load, on a ${report.power.recommendedPsuW}W-class supply.`
        : null,
      `${formatPKR(spend)} for ${partPicks.length} parts.`,
    ]),
    notes,
    repairs,
    outOfStock: partPicks.filter((p) => !p.inStock).map((p) => p.part.name),
    samplePricing: partPicks.some((p) => p.part.samplePrice),
    suggestedName: `${input.resolution} ${goal.label} Build`,
  };
}

/**
 * Adds or drops the case-fan pack after the case may have changed.
 *
 * Run last, and settled again afterwards, because adding fans changes the power
 * estimate by a few watts and dropping them can free budget.
 */
function reconcileFans(
  picks: Picks,
  catalog: Catalog,
  caps: Record<string, number>,
): { picks: Picks; report: CompatibilityReport; repairs: RepairRecord[] } {
  const pcCase = picks.case?.[0] ?? null;
  const hasFans = (picks.fan?.length ?? 0) > 0;
  const caseHasFans = (pcCase?.includedFans ?? 0) > 0;

  let next = picks;
  if (pcCase && !caseHasFans && !hasFans) {
    const chosen = choose(
      "fan",
      picks,
      catalog,
      caps.fan ?? 0,
      scoreFan,
      { requireCompatible: true },
    );
    if (chosen) next = { ...picks, fan: [chosen.part] };
  } else if (caseHasFans && hasFans) {
    next = { ...picks };
    delete next.fan;
  }

  return settle(next, catalog, caps);
}

/* -------------------------------------------------------------------------- */
/* Honest notes                                                               */
/* -------------------------------------------------------------------------- */

function buildNotes(
  input: NormalizedRecommendInput,
  picks: Picks,
  report: CompatibilityReport,
  spend: number,
  flags: {
    unfilled: ComponentKind[];
    overAllocated: Set<ComponentKind>;
    stockStarved: Set<ComponentKind>;
    unmetFloors: string[];
  },
): RecommendNote[] {
  const notes: RecommendNote[] = [];

  /* --- The verdict that matters most -------------------------------------- */

  const errors = report.issues.filter((i) => i.severity === "error");
  if (errors.length) {
    notes.push({
      tone: "error",
      text: `We could not resolve ${errors.length === 1 ? "one conflict" : `${errors.length} conflicts`} from the parts currently in the catalogue. This build is shown as-is with the problem stated below — do not order it until we have swapped the offending part. Message us and we will.`,
    });
  }

  if (report.missing.length) {
    notes.push({
      tone: "error",
      text: `Still missing: ${report.missing.map((k) => KIND_META[k].label).join(", ")}. The catalogue has nothing that fits alongside the rest of this build.`,
    });
  }

  if (flags.unfilled.length) {
    notes.push({
      tone: "error",
      text: `No ${flags.unfilled.map((k) => KIND_META[k].label.toLowerCase()).join(" or ")} is listed in the catalogue at the moment.`,
    });
  }

  /* --- Budget ------------------------------------------------------------- */

  if (spend > input.budgetMax) {
    notes.push({
      tone: "warning",
      text: `This is the closest complete, compatible machine we can put together, and it comes to ${formatPKR(spend)} — ${formatPKR(spend - input.budgetMax)} over your ceiling of ${formatPKR(input.budgetMax)}. Nothing cheaper in stock makes a working build at this specification.`,
    });
  } else if (spend < input.budgetFloor) {
    notes.push({
      tone: "info",
      text: `${formatPKR(input.budgetMax - spend)} of your ceiling is unspent. Nothing in stock improves this build without going past it — the money is better kept, or put towards a monitor.`,
    });
  }

  if (input.budgetCapped) {
    notes.push({
      tone: "info",
      text: `You gave an open-ended budget, so we capped the recommendation at ${formatPKR(input.budgetMax)}. Tell us if you want to go further and we will spec it up.`,
    });
  }

  /* --- Where the spec falls short of the target ---------------------------- */

  const gpu = picks.gpu?.[0] ?? null;
  if (gpu) {
    const want = VRAM_TARGET[input.resolution];
    const vram = gpu.vramGb ?? 0;
    if (vram > 0 && vram < want) {
      notes.push({
        tone: "warning",
        text: `${gpu.name} carries ${vram}GB of VRAM. At ${input.resolution} we would rather see ${want}GB, and nothing with that much memory fits this budget alongside the rest of the build. It plays — you will be turning textures down sooner than you would on a ${want}GB card.`,
      });
    }
  }

  if (flags.unmetFloors.length) {
    notes.push({
      tone: "warning",
      text: `This budget did not stretch to ${flags.unmetFloors.join(", and ")}. Everything above is what the money reaches — say the word and we will show you what the next step up costs.`,
    });
  }

  // Only worth saying when the build actually landed inside the ceiling —
  // otherwise the over-budget note above has already explained the same thing.
  const stretched = [...flags.overAllocated];
  if (stretched.length && spend <= input.budgetMax) {
    notes.push({
      tone: "info",
      text: `Nothing compatible fitted the planned share for ${stretched.map((k) => KIND_META[k].label.toLowerCase()).join(", ")}, so the build spends more there and less elsewhere. The split below is the plan, not the outcome.`,
    });
  }

  const starved = [...flags.stockStarved];
  if (starved.length) {
    notes.push({
      tone: "warning",
      text: `Every compatible ${starved.map((k) => KIND_META[k].label.toLowerCase()).join(" and ")} option is out of stock right now. We can order one in — ask us for a timeline.`,
    });
  }

  /* --- Frame-rate honesty -------------------------------------------------- */

  notes.push({
    tone: "info",
    text: "We do not publish estimated frame rates. The performance table below shows only figures that exist in our records, with their source, and says so plainly where nothing has been measured.",
  });

  return notes;
}
