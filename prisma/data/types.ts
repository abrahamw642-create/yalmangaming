/**
 * Seed-local product shape and helpers.
 *
 * This file is deliberately independent of `src/lib/*`: the seed runs through
 * `node --experimental-strip-types`, outside Next's module resolution, so it
 * cannot use the `@/` path alias. The JSON-text columns are written here with
 * the same encoding `src/lib/specs.ts` reads back (`parseStringList`,
 * `parseNumberMap`, `parseSpecSheet`) — if you change one side, change both.
 *
 * Every field mirrors a column on Prisma's `Product`. Optional fields are
 * simply omitted for kinds they do not apply to; the seed maps `undefined` to
 * SQL NULL so the compatibility engine's "a missing spec never produces a false
 * incompatible" contract holds.
 */

/** One row of the product page spec table. */
export type SpecRow = { group: string; label: string; value: string };

export type SeedProduct = {
  sku: string;
  slug: string;
  name: string;
  /** One of COMPONENT_KINDS in src/lib/types.ts. */
  kind: string;
  /** Brand *name*, resolved to an id by the seed. `null` for unbranded rows. */
  brand: string | null;
  /** Category *slug*, resolved to an id by the seed. */
  category: string;
  headline: string;
  description: string;

  /** Whole PKR. Never a float — see the money rules in docs/CONTRACT.md. */
  price: number;
  salePrice?: number;
  stock: number;
  /**
   * Neutral string or omitted. Never a duration: Yalman Gaming has not
   * confirmed warranty terms and the site must not invent them.
   */
  warranty?: string | null;

  featured?: boolean;
  isNew?: boolean;
  onDeal?: boolean;

  specSheet: SpecRow[];

  /* --- CPU ------------------------------------------------------------- */
  socket?: string;
  tdp?: number;
  /** Sustained package power (AMD PPT / Intel PL2-MTP). Engine-facing. */
  peakPowerW?: number;
  cores?: number;
  threads?: number;
  baseClock?: number;
  boostClock?: number;
  integratedGraphics?: boolean;

  /* --- Motherboard ----------------------------------------------------- */
  chipset?: string;
  formFactor?: string;
  memorySlots?: number;
  maxMemoryGb?: number;
  m2Slots?: number;
  sataPorts?: number;
  pcieVersion?: string;

  /* --- Memory (also used by motherboards for validated speed) ---------- */
  memoryType?: string;
  memorySpeed?: number;
  capacityGb?: number;
  moduleCount?: number;

  /* --- GPU ------------------------------------------------------------- */
  vramGb?: number;
  gpuLengthMm?: number;
  requiredConnectors?: string[];
  recommendedPsuW?: number;
  slotWidth?: number;

  /* --- Storage --------------------------------------------------------- */
  storageInterface?: string;
  formFactorDrive?: string;

  /* --- PSU ------------------------------------------------------------- */
  wattage?: number;
  efficiency?: string;
  modular?: string;
  psuFormFactor?: string;
  psuLengthMm?: number;
  providedConnectors?: Record<string, number>;

  /* --- Cooler ---------------------------------------------------------- */
  coolerType?: string;
  coolerHeightMm?: number;
  radiatorSizeMm?: number;
  supportedSockets?: string[];
  coolingCapacityW?: number;

  /* --- Case ------------------------------------------------------------ */
  supportedFormFactors?: string[];
  maxGpuLengthMm?: number;
  maxCoolerHeightMm?: number;
  maxPsuLengthMm?: number;
  radiatorSupport?: Record<string, number>;
  caseStyle?: string;
  dimensionsMm?: string;
  includedFans?: number;

  /* --- Peripherals ----------------------------------------------------- */
  resolution?: string;
  refreshRate?: number;
  panelSizeIn?: number;
  panelType?: string;
  connectivity?: string;
  switchType?: string;

  rgb?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Encoding helpers                                                           */
/* -------------------------------------------------------------------------- */

/** `["8-pin","8-pin"]` — matches `parseStringList` in src/lib/specs.ts. */
export function jsonList(list: string[] | undefined): string | null {
  return list && list.length ? JSON.stringify(list) : null;
}

/** `{"pcie8":4,"12vhpwr":1}` — matches `parseNumberMap` in src/lib/specs.ts. */
export function jsonMap(
  map: Record<string, number> | undefined,
): string | null {
  return map && Object.keys(map).length ? JSON.stringify(map) : null;
}

export function jsonSpecs(rows: SpecRow[]): string | null {
  return rows.length ? JSON.stringify(rows) : null;
}

/** Terse spec-row constructor so the data files stay readable. */
export function spec(group: string, label: string, value: string): SpecRow {
  return { group, label, value };
}

/**
 * There are no product photographs yet. Every image row points at the
 * hand-drawn per-kind silhouette in `public/images/placeholder/` and is flagged
 * `placeholder: true` so the storefront can style it as artwork rather than
 * pretending it is a photo of the actual part.
 */
export function placeholderImage(kind: string): string {
  return `/images/placeholder/${kind}.svg`;
}

/** The standard neutral warranty string. Never states a duration. */
export const MFR_WARRANTY = "Manufacturer warranty";
