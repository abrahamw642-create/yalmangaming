/**
 * Yalman Gaming admin — shared vocabulary.
 *
 * Status lists, tone mappings and the per-kind compatibility field definitions
 * that drive the product editor. Deliberately dependency-light: it lives under
 * `components/` rather than `lib/` because client components (the forms) and
 * server code (`@/lib/admin-queries`, the `/api/admin` handlers) both import
 * it, and anything under `lib/` that touches the catalogue also pulls in the
 * Prisma client — which cannot be bundled into the browser.
 *
 * The field definitions are the single source of truth for "which columns
 * apply to which kind": the editor renders exactly these inputs, and the API
 * nulls every column outside the chosen kind's set so a CPU can never end up
 * carrying a radiator size.
 */

import type { BadgeTone } from "@/components/ui";
import { COMPONENT_KINDS, KIND_META, type ComponentKind } from "@/lib/types";

/* ========================================================================== */
/* Statuses                                                                   */
/* ========================================================================== */

export type StatusOption<T extends string = string> = {
  id: T;
  label: string;
  tone: BadgeTone;
  /** Shown in the status picker so the store knows what each one means. */
  hint?: string;
};

/** Mirrors `Order.status` in the Prisma schema. */
export const ORDER_STATUSES = [
  { id: "pending", label: "Pending", tone: "ember", hint: "Placed on the site — not yet called." },
  { id: "confirmed", label: "Confirmed", tone: "cyan", hint: "Customer called, stock and price agreed." },
  { id: "building", label: "Building", tone: "violet", hint: "On the bench being assembled or tested." },
  { id: "shipped", label: "Shipped", tone: "lime", hint: "Handed to the courier or collected." },
  { id: "delivered", label: "Delivered", tone: "emerald", hint: "With the customer." },
  { id: "cancelled", label: "Cancelled", tone: "rose", hint: "Not going ahead." },
] as const satisfies readonly StatusOption[];

export type OrderStatus = (typeof ORDER_STATUSES)[number]["id"];
export const ORDER_STATUS_IDS = ORDER_STATUSES.map((s) => s.id) as OrderStatus[];

/** Mirrors `Order.paymentStatus`. */
export const PAYMENT_STATUSES = [
  { id: "pending", label: "Unpaid", tone: "ember" },
  { id: "paid", label: "Paid", tone: "emerald" },
  { id: "refunded", label: "Refunded", tone: "rose" },
] as const satisfies readonly StatusOption[];

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]["id"];
export const PAYMENT_STATUS_IDS = PAYMENT_STATUSES.map((s) => s.id) as PaymentStatus[];

/** Mirrors `QuoteRequest.status`. */
export const QUOTE_STATUSES = [
  { id: "new", label: "New", tone: "cyan", hint: "Nobody has replied yet." },
  { id: "contacted", label: "Contacted", tone: "violet", hint: "Called or messaged on WhatsApp." },
  { id: "quoted", label: "Quoted", tone: "ember", hint: "A price has been given." },
  { id: "won", label: "Won", tone: "emerald", hint: "Turned into an order." },
  { id: "lost", label: "Lost", tone: "rose", hint: "Went elsewhere or went quiet." },
] as const satisfies readonly StatusOption[];

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["id"];
export const QUOTE_STATUS_IDS = QUOTE_STATUSES.map((s) => s.id) as QuoteStatus[];

/** Mirrors `CustomBuild.status`. */
export const BUILD_STATUSES = [
  { id: "draft", label: "Draft", tone: "neutral" },
  { id: "saved", label: "Saved", tone: "cyan" },
  { id: "quoted", label: "Quoted", tone: "ember" },
  { id: "ordered", label: "Ordered", tone: "emerald" },
] as const satisfies readonly StatusOption[];

export type BuildStatus = (typeof BUILD_STATUSES)[number]["id"];
export const BUILD_STATUS_IDS = BUILD_STATUSES.map((s) => s.id) as BuildStatus[];

/** Mirrors `Product.status`. */
export const PRODUCT_STATUSES = [
  { id: "active", label: "Active", tone: "emerald", hint: "Listed and orderable." },
  { id: "draft", label: "Draft", tone: "ember", hint: "Hidden from the storefront." },
  { id: "archived", label: "Archived", tone: "neutral", hint: "Kept for history, not sold." },
] as const satisfies readonly StatusOption[];

export type ProductStatus = (typeof PRODUCT_STATUSES)[number]["id"];
export const PRODUCT_STATUS_IDS = PRODUCT_STATUSES.map((s) => s.id) as ProductStatus[];

export function statusOption<T extends string>(
  options: readonly StatusOption<T>[],
  id: string | null | undefined,
): StatusOption<T> {
  return (
    options.find((option) => option.id === id) ?? {
      id: (id ?? "unknown") as T,
      label: id ?? "Unknown",
      tone: "neutral",
    }
  );
}

/* ========================================================================== */
/* Product list filters                                                       */
/* ========================================================================== */

/**
 * The saved views along the top of the product table. `sample` is first and
 * linked from the dashboard because replacing seeded sample prices with real
 * Yalman Gaming figures is the store's first job on this system.
 */
export const PRODUCT_FLAGS = [
  { id: "sample", label: "Sample pricing", tone: "ember" as BadgeTone },
  { id: "low-stock", label: "Low stock", tone: "ember" as BadgeTone },
  { id: "out-of-stock", label: "Out of stock", tone: "rose" as BadgeTone },
  { id: "on-sale", label: "On sale", tone: "rose" as BadgeTone },
  { id: "featured", label: "Featured", tone: "cyan" as BadgeTone },
  { id: "new", label: "New", tone: "violet" as BadgeTone },
  { id: "deal", label: "Deal", tone: "rose" as BadgeTone },
  { id: "no-image", label: "Placeholder image", tone: "neutral" as BadgeTone },
] as const;

export type ProductFlag = (typeof PRODUCT_FLAGS)[number]["id"];
export const PRODUCT_FLAG_IDS = PRODUCT_FLAGS.map((f) => f.id) as ProductFlag[];

export const ADMIN_PRODUCT_SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "created", label: "Newest" },
  { id: "name", label: "Name A–Z" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "stock-asc", label: "Stock: low to high" },
] as const;

export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number]["id"];
export const ADMIN_PRODUCT_SORT_IDS = ADMIN_PRODUCT_SORTS.map(
  (s) => s.id,
) as AdminProductSort[];

/** Every kind, in the order the builder steps through them. */
export const KIND_OPTIONS = [...COMPONENT_KINDS]
  .sort((a, b) => KIND_META[a].order - KIND_META[b].order)
  .map((kind) => ({ id: kind, label: KIND_META[kind].label }));

/* ========================================================================== */
/* Compatibility spec fields                                                  */
/* ========================================================================== */

/**
 * Every `Product` column the editor can write, other than the commerce fields
 * (price, stock, flags…) which every kind shares. Listed explicitly so the API
 * can null the ones that do not apply to the chosen kind.
 */
export const SPEC_COLUMNS = [
  "socket",
  "chipset",
  "tdp",
  "cores",
  "threads",
  "baseClock",
  "boostClock",
  "integratedGraphics",
  "memoryType",
  "memorySpeed",
  "memorySlots",
  "maxMemoryGb",
  "capacityGb",
  "moduleCount",
  "vramGb",
  "gpuLengthMm",
  "requiredConnectors",
  "recommendedPsuW",
  "slotWidth",
  "storageInterface",
  "formFactorDrive",
  "formFactor",
  "m2Slots",
  "sataPorts",
  "pcieVersion",
  "wattage",
  "efficiency",
  "modular",
  "psuFormFactor",
  "psuLengthMm",
  "providedConnectors",
  "coolerType",
  "coolerHeightMm",
  "radiatorSizeMm",
  "supportedSockets",
  "coolingCapacityW",
  "supportedFormFactors",
  "maxGpuLengthMm",
  "maxCoolerHeightMm",
  "maxPsuLengthMm",
  "radiatorSupport",
  "caseStyle",
  "dimensionsMm",
  "includedFans",
  "resolution",
  "refreshRate",
  "panelSizeIn",
  "panelType",
  "connectivity",
  "switchType",
  "rgb",
] as const;

export type SpecColumn = (typeof SPEC_COLUMNS)[number];

/**
 * How a column is stored:
 *   int/float  — real numeric columns
 *   boolean    — real boolean columns
 *   list/map   — JSON *text*, read and written through `@/lib/specs`
 */
export type SpecFieldType =
  | "text"
  | "select"
  | "int"
  | "float"
  | "boolean"
  | "list"
  | "map";

export type SpecField = {
  name: SpecColumn;
  label: string;
  type: SpecFieldType;
  /** For `select`; the first entry is always the empty "not set" option. */
  options?: readonly string[];
  /** Unit rendered after the input, e.g. `mm`, `W`. */
  suffix?: string;
  placeholder?: string;
  help?: string;
};

export type SpecGroup = { group: string; help?: string; fields: SpecField[] };

/* --- shared option lists -------------------------------------------------- */

const SOCKETS = ["AM4", "AM5", "LGA1700", "LGA1851", "sTR5"] as const;
const MEMORY_TYPES = ["DDR4", "DDR5"] as const;
const BOARD_FORM_FACTORS = ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"] as const;
const STORAGE_INTERFACES = ["nvme-gen5", "nvme-gen4", "sata", "hdd"] as const;
const DRIVE_FORM_FACTORS = ["M.2-2280", "2.5in", "3.5in"] as const;
const EFFICIENCIES = [
  "80+ Bronze",
  "80+ Gold",
  "80+ Platinum",
  "80+ Titanium",
] as const;
const MODULARITY = ["full", "semi", "non"] as const;
const PSU_FORM_FACTORS = ["ATX", "SFX", "SFX-L"] as const;
const COOLER_TYPES = ["air", "aio"] as const;
const PANEL_TYPES = ["IPS", "VA", "TN", "OLED"] as const;
const CONNECTIVITY = ["wired", "wireless", "both"] as const;

/**
 * Connector keys must match `normalizeConnector` in `@/lib/compatibility` once
 * canonicalised — `8-pin` and `6+2` both reduce to `pcie8`. The engine reads
 * the PSU side as already-canonical keys, so the help text says so.
 */
const CONNECTOR_HELP =
  "Canonical keys: 12vhpwr, pcie8, pcie6. The engine matches a card's requirement against these exactly.";

/* --- reusable field definitions ------------------------------------------- */

const rgbField: SpecField = {
  name: "rgb",
  label: "RGB lighting",
  type: "boolean",
};

const dimensionsField: SpecField = {
  name: "dimensionsMm",
  label: "Dimensions",
  type: "text",
  placeholder: "450 x 210 x 480",
  help: "Width x height x depth in millimetres.",
};

const connectivityField: SpecField = {
  name: "connectivity",
  label: "Connection",
  type: "select",
  options: CONNECTIVITY,
};

/**
 * Field groups per kind. Anything absent from a kind's list is nulled on save,
 * which is how a product that changes kind sheds specs that no longer mean
 * anything.
 */
export const KIND_SPEC_GROUPS: Record<ComponentKind, SpecGroup[]> = {
  cpu: [
    {
      group: "Platform",
      help: "Socket drives the CPU↔motherboard and CPU↔cooler rules.",
      fields: [
        { name: "socket", label: "Socket", type: "select", options: SOCKETS },
        { name: "chipset", label: "Architecture / series", type: "text", placeholder: "Zen 5" },
        {
          name: "integratedGraphics",
          label: "Has integrated graphics",
          type: "boolean",
          help: "Leave off and the builder blocks a build with no graphics card — it would boot to a blank screen.",
        },
      ],
    },
    {
      group: "Performance",
      fields: [
        { name: "cores", label: "Cores", type: "int" },
        { name: "threads", label: "Threads", type: "int" },
        { name: "baseClock", label: "Base clock", type: "float", suffix: "GHz" },
        { name: "boostClock", label: "Boost clock", type: "float", suffix: "GHz" },
        {
          name: "tdp",
          label: "TDP",
          type: "int",
          suffix: "W",
          help: "Power estimates take a CPU to 1.35× this figure to allow for boost behaviour.",
        },
      ],
    },
    {
      group: "Memory support",
      fields: [
        { name: "memoryType", label: "Memory type", type: "select", options: MEMORY_TYPES },
        { name: "memorySpeed", label: "Supported speed", type: "int", suffix: "MT/s" },
      ],
    },
  ],

  motherboard: [
    {
      group: "Platform",
      fields: [
        { name: "socket", label: "Socket", type: "select", options: SOCKETS },
        { name: "chipset", label: "Chipset", type: "text", placeholder: "B650" },
        {
          name: "formFactor",
          label: "Form factor",
          type: "select",
          options: BOARD_FORM_FACTORS,
          help: "Checked against the case's supported form factors.",
        },
        { name: "pcieVersion", label: "PCIe version", type: "text", placeholder: "PCIe 5.0" },
      ],
    },
    {
      group: "Memory",
      fields: [
        { name: "memoryType", label: "Memory type", type: "select", options: MEMORY_TYPES },
        { name: "memorySlots", label: "DIMM slots", type: "int" },
        { name: "maxMemoryGb", label: "Maximum memory", type: "int", suffix: "GB" },
        { name: "memorySpeed", label: "Validated speed", type: "int", suffix: "MT/s" },
      ],
    },
    {
      group: "Storage",
      fields: [
        { name: "m2Slots", label: "M.2 slots", type: "int" },
        { name: "sataPorts", label: "SATA ports", type: "int" },
      ],
    },
  ],

  gpu: [
    {
      group: "Graphics",
      fields: [
        { name: "vramGb", label: "VRAM", type: "int", suffix: "GB" },
        { name: "tdp", label: "Board power", type: "int", suffix: "W" },
        { name: "slotWidth", label: "Slot width", type: "float", suffix: "slots" },
      ],
    },
    {
      group: "Fitment and power",
      fields: [
        {
          name: "gpuLengthMm",
          label: "Card length",
          type: "int",
          suffix: "mm",
          help: "Compared against the case's maximum GPU clearance.",
        },
        {
          name: "requiredConnectors",
          label: "Required power connectors",
          type: "list",
          placeholder: "pcie8, pcie8, pcie8",
          help: CONNECTOR_HELP,
        },
        { name: "recommendedPsuW", label: "Recommended PSU", type: "int", suffix: "W" },
      ],
    },
  ],

  ram: [
    {
      group: "Kit",
      fields: [
        { name: "memoryType", label: "Memory type", type: "select", options: MEMORY_TYPES },
        { name: "capacityGb", label: "Total capacity", type: "int", suffix: "GB" },
        {
          name: "moduleCount",
          label: "Modules in kit",
          type: "int",
          help: "Compared against the board's DIMM slot count.",
        },
        { name: "memorySpeed", label: "Rated speed", type: "int", suffix: "MT/s" },
        rgbField,
      ],
    },
  ],

  storage: [
    {
      group: "Drive",
      fields: [
        { name: "capacityGb", label: "Capacity", type: "int", suffix: "GB" },
        {
          name: "storageInterface",
          label: "Interface",
          type: "select",
          options: STORAGE_INTERFACES,
          help: "NVMe drives consume an M.2 slot; sata/hdd consume a SATA port.",
        },
        {
          name: "formFactorDrive",
          label: "Physical form factor",
          type: "select",
          options: DRIVE_FORM_FACTORS,
        },
      ],
    },
  ],

  psu: [
    {
      group: "Output",
      fields: [
        { name: "wattage", label: "Wattage", type: "int", suffix: "W" },
        { name: "efficiency", label: "Efficiency rating", type: "select", options: EFFICIENCIES },
        { name: "modular", label: "Cabling", type: "select", options: MODULARITY },
      ],
    },
    {
      group: "Fitment and cabling",
      fields: [
        { name: "psuFormFactor", label: "Form factor", type: "select", options: PSU_FORM_FACTORS },
        { name: "psuLengthMm", label: "Depth", type: "int", suffix: "mm" },
        {
          name: "providedConnectors",
          label: "Connectors provided",
          type: "map",
          help: CONNECTOR_HELP,
        },
      ],
    },
  ],

  cooler: [
    {
      group: "Cooler",
      fields: [
        { name: "coolerType", label: "Type", type: "select", options: COOLER_TYPES },
        {
          name: "supportedSockets",
          label: "Supported sockets",
          type: "list",
          placeholder: "AM5, LGA1700, LGA1851",
          help: "A socket missing from this list makes the cooler a hard error with that CPU.",
        },
        {
          name: "coolingCapacityW",
          label: "Rated capacity",
          type: "int",
          suffix: "W",
          help: "Below the CPU's TDP the builder warns about throttling.",
        },
      ],
    },
    {
      group: "Clearance",
      fields: [
        {
          name: "coolerHeightMm",
          label: "Height (air coolers)",
          type: "int",
          suffix: "mm",
        },
        {
          name: "radiatorSizeMm",
          label: "Radiator size (AIO)",
          type: "int",
          suffix: "mm",
          placeholder: "360",
        },
        rgbField,
      ],
    },
  ],

  case: [
    {
      group: "Compatibility",
      fields: [
        {
          name: "supportedFormFactors",
          label: "Board form factors",
          type: "list",
          placeholder: "ATX, Micro-ATX, Mini-ITX",
        },
        { name: "caseStyle", label: "Style", type: "text", placeholder: "Mid Tower" },
        dimensionsField,
      ],
    },
    {
      group: "Clearances",
      fields: [
        { name: "maxGpuLengthMm", label: "Max GPU length", type: "int", suffix: "mm" },
        { name: "maxCoolerHeightMm", label: "Max cooler height", type: "int", suffix: "mm" },
        { name: "maxPsuLengthMm", label: "Max PSU depth", type: "int", suffix: "mm" },
        {
          name: "radiatorSupport",
          label: "Radiator mounts",
          type: "map",
          help: "Position to largest radiator, e.g. top 360, front 360, rear 120.",
        },
      ],
    },
    {
      group: "Cooling",
      fields: [
        {
          name: "includedFans",
          label: "Fans included",
          type: "int",
          help: "Zero raises an airflow warning unless case fans are added to the build.",
        },
        rgbField,
      ],
    },
  ],

  fan: [
    {
      group: "Fan",
      fields: [
        { name: "includedFans", label: "Fans in pack", type: "int" },
        { name: "dimensionsMm", label: "Size", type: "text", placeholder: "120 x 120 x 25" },
        rgbField,
      ],
    },
  ],

  os: [
    {
      group: "Licence",
      help: "Operating systems carry no compatibility attributes.",
      fields: [],
    },
  ],

  monitor: [
    {
      group: "Panel",
      fields: [
        { name: "panelSizeIn", label: "Size", type: "float", suffix: "in" },
        { name: "resolution", label: "Resolution", type: "text", placeholder: "2560x1440" },
        { name: "refreshRate", label: "Refresh rate", type: "int", suffix: "Hz" },
        { name: "panelType", label: "Panel type", type: "select", options: PANEL_TYPES },
      ],
    },
  ],

  keyboard: [
    {
      group: "Keyboard",
      fields: [
        { name: "switchType", label: "Switch", type: "text", placeholder: "Linear red" },
        connectivityField,
        rgbField,
      ],
    },
  ],

  mouse: [{ group: "Mouse", fields: [connectivityField, rgbField] }],

  headset: [{ group: "Headset", fields: [connectivityField, rgbField] }],

  microphone: [{ group: "Microphone", fields: [connectivityField] }],

  webcam: [
    {
      group: "Webcam",
      fields: [
        { name: "resolution", label: "Resolution", type: "text", placeholder: "1920x1080" },
        connectivityField,
      ],
    },
  ],

  chair: [{ group: "Chair", fields: [dimensionsField] }],

  controller: [{ group: "Controller", fields: [connectivityField, rgbField] }],

  mousepad: [{ group: "Mousepad", fields: [dimensionsField, rgbField] }],

  speaker: [{ group: "Speakers", fields: [connectivityField, rgbField] }],

  prebuilt: [
    {
      group: "Machine",
      help: "A prebuilt is sold as one unit; its parts live in the description and spec sheet.",
      fields: [
        { name: "caseStyle", label: "Chassis style", type: "text", placeholder: "Mid Tower" },
        { name: "recommendedPsuW", label: "PSU fitted", type: "int", suffix: "W" },
        dimensionsField,
        rgbField,
      ],
    },
  ],
};

/** Flat list of the fields that apply to one kind. */
export function specFieldsForKind(kind: ComponentKind): SpecField[] {
  return KIND_SPEC_GROUPS[kind].flatMap((group) => group.fields);
}

/** Columns that must be cleared when a product is saved as `kind`. */
export function irrelevantSpecColumns(kind: ComponentKind): SpecColumn[] {
  const keep = new Set(specFieldsForKind(kind).map((field) => field.name));
  return SPEC_COLUMNS.filter((column) => !keep.has(column));
}

export const LIST_SPEC_COLUMNS = SPEC_COLUMNS.filter((column) =>
  ["requiredConnectors", "supportedSockets", "supportedFormFactors"].includes(column),
);

export const MAP_SPEC_COLUMNS = SPEC_COLUMNS.filter((column) =>
  ["providedConnectors", "radiatorSupport"].includes(column),
);

/* ========================================================================== */
/* Benchmarks                                                                 */
/* ========================================================================== */

export const BENCHMARK_RESOLUTIONS = ["1080p", "1440p", "4K"] as const;
export const BENCHMARK_PRESETS = ["Low", "Medium", "High", "Ultra"] as const;

/**
 * Seeded rows all carry this. Shown as a one-click default in the editor so
 * nobody is tempted to leave `source` vague — the storefront prints it next to
 * every figure, and an unattributed benchmark is an invented one.
 */
export const DEFAULT_BENCHMARK_SOURCE =
  "Manufacturer and press aggregate — pending Yalman in-store verification";

export const IN_STORE_BENCHMARK_SOURCE = "Yalman Gaming in-store test";

/* ========================================================================== */
/* Misc                                                                       */
/* ========================================================================== */

export const SHOWCASE_TIERS = ["Entry", "Mid-Range", "High-End", "Extreme"] as const;

export const ACCENTS = [
  "cyan",
  "violet",
  "ember",
  "emerald",
  "rose",
  "lime",
  "sky",
] as const;

export const COUPON_TYPES = [
  { id: "percent", label: "Percent off" },
  { id: "fixed", label: "Fixed amount off (PKR)" },
] as const;

export type CouponType = (typeof COUPON_TYPES)[number]["id"];
