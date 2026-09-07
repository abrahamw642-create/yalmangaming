/**
 * Shared domain types for Yalman Gaming.
 *
 * This file is the contract between the catalog, the PC builder, the
 * compatibility engine and the storefront. Everything that needs to know
 * "what kinds of parts exist and what shape they have" imports from here.
 */

/* -------------------------------------------------------------------------- */
/* Component kinds                                                            */
/* -------------------------------------------------------------------------- */

/** Parts that go inside a PC and participate in compatibility checking. */
export const CORE_KINDS = [
  "cpu",
  "motherboard",
  "gpu",
  "ram",
  "storage",
  "psu",
  "cooler",
  "case",
  "fan",
  "os",
] as const;

/** Everything else the store sells. */
export const PERIPHERAL_KINDS = [
  "monitor",
  "keyboard",
  "mouse",
  "headset",
  "microphone",
  "webcam",
  "chair",
  "controller",
  "mousepad",
  "speaker",
] as const;

export const OTHER_KINDS = ["prebuilt"] as const;

export const COMPONENT_KINDS = [
  ...CORE_KINDS,
  ...PERIPHERAL_KINDS,
  ...OTHER_KINDS,
] as const;

export type CoreKind = (typeof CORE_KINDS)[number];
export type PeripheralKind = (typeof PERIPHERAL_KINDS)[number];
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export function isCoreKind(kind: string): kind is CoreKind {
  return (CORE_KINDS as readonly string[]).includes(kind);
}

export function isComponentKind(kind: string): kind is ComponentKind {
  return (COMPONENT_KINDS as readonly string[]).includes(kind);
}

/** Display metadata for each kind — labels, icons and builder ordering. */
export type KindMeta = {
  kind: ComponentKind;
  label: string;
  plural: string;
  /** lucide-react icon name, resolved by `src/components/ui/KindIcon.tsx`. */
  icon: string;
  /** Order in the PC builder. Lower comes first. */
  order: number;
  /** A build cannot be completed without a part of this kind. */
  required: boolean;
  /** More than one of these can be added to a build (storage, fans…). */
  multiple: boolean;
  /** One-line explanation shown to first-time builders. */
  hint: string;
};

export const KIND_META: Record<ComponentKind, KindMeta> = {
  cpu: {
    kind: "cpu",
    label: "Processor",
    plural: "Processors",
    icon: "cpu",
    order: 1,
    required: true,
    multiple: false,
    hint: "The brain of the build. Decides your minimum FPS in CPU-heavy games.",
  },
  motherboard: {
    kind: "motherboard",
    label: "Motherboard",
    plural: "Motherboards",
    icon: "circuit-board",
    order: 2,
    required: true,
    multiple: false,
    hint: "Everything plugs into this. Its socket must match your CPU.",
  },
  gpu: {
    kind: "gpu",
    label: "Graphics Card",
    plural: "Graphics Cards",
    icon: "gpu",
    order: 3,
    required: true,
    multiple: false,
    hint: "The single biggest factor in gaming performance at 1440p and 4K.",
  },
  ram: {
    kind: "ram",
    label: "Memory",
    plural: "Memory",
    icon: "memory-stick",
    order: 4,
    required: true,
    multiple: false,
    hint: "32GB is the comfortable default for gaming plus streaming in 2026.",
  },
  storage: {
    kind: "storage",
    label: "Storage",
    plural: "Storage",
    icon: "hard-drive",
    order: 5,
    required: true,
    multiple: true,
    hint: "An NVMe SSD for Windows and games. Add a second drive for capacity.",
  },
  cooler: {
    kind: "cooler",
    label: "CPU Cooler",
    plural: "CPU Coolers",
    icon: "fan",
    order: 6,
    required: true,
    multiple: false,
    hint: "Must clear your case height and support your CPU socket.",
  },
  psu: {
    kind: "psu",
    label: "Power Supply",
    plural: "Power Supplies",
    icon: "plug-zap",
    order: 7,
    required: true,
    multiple: false,
    hint: "Sized from your live wattage estimate, with headroom for spikes.",
  },
  case: {
    kind: "case",
    label: "Case",
    plural: "Cases",
    icon: "box",
    order: 8,
    required: true,
    multiple: false,
    hint: "Has to physically fit your GPU, cooler and motherboard.",
  },
  fan: {
    kind: "fan",
    label: "Case Fans",
    plural: "Case Fans",
    icon: "wind",
    order: 9,
    required: false,
    multiple: true,
    hint: "Airflow keeps clocks high. RGB optional.",
  },
  os: {
    kind: "os",
    label: "Operating System",
    plural: "Operating Systems",
    icon: "monitor-cog",
    order: 10,
    required: false,
    multiple: false,
    hint: "Pick Windows, or bring your own licence.",
  },
  monitor: {
    kind: "monitor",
    label: "Monitor",
    plural: "Monitors",
    icon: "monitor",
    order: 11,
    required: false,
    multiple: true,
    hint: "Match the panel to your GPU — no point at 4K if you target 240 FPS.",
  },
  keyboard: {
    kind: "keyboard",
    label: "Keyboard",
    plural: "Keyboards",
    icon: "keyboard",
    order: 12,
    required: false,
    multiple: false,
    hint: "",
  },
  mouse: {
    kind: "mouse",
    label: "Mouse",
    plural: "Mice",
    icon: "mouse",
    order: 13,
    required: false,
    multiple: false,
    hint: "",
  },
  headset: {
    kind: "headset",
    label: "Headset",
    plural: "Headsets",
    icon: "headphones",
    order: 14,
    required: false,
    multiple: false,
    hint: "",
  },
  microphone: {
    kind: "microphone",
    label: "Microphone",
    plural: "Microphones",
    icon: "mic",
    order: 15,
    required: false,
    multiple: false,
    hint: "",
  },
  webcam: {
    kind: "webcam",
    label: "Webcam",
    plural: "Webcams",
    icon: "video",
    order: 16,
    required: false,
    multiple: false,
    hint: "",
  },
  chair: {
    kind: "chair",
    label: "Gaming Chair",
    plural: "Gaming Chairs",
    icon: "armchair",
    order: 17,
    required: false,
    multiple: false,
    hint: "",
  },
  controller: {
    kind: "controller",
    label: "Controller",
    plural: "Controllers",
    icon: "gamepad-2",
    order: 18,
    required: false,
    multiple: false,
    hint: "",
  },
  mousepad: {
    kind: "mousepad",
    label: "Mousepad",
    plural: "Mousepads",
    icon: "square",
    order: 19,
    required: false,
    multiple: false,
    hint: "",
  },
  speaker: {
    kind: "speaker",
    label: "Speakers",
    plural: "Speakers",
    icon: "speaker",
    order: 20,
    required: false,
    multiple: false,
    hint: "",
  },
  prebuilt: {
    kind: "prebuilt",
    label: "Gaming PC",
    plural: "Gaming PCs",
    icon: "pc-case",
    order: 0,
    required: false,
    multiple: false,
    hint: "",
  },
};

/** Kinds shown as steps in the builder, in order. */
export const BUILDER_STEP_KINDS: ComponentKind[] = [
  "cpu",
  "motherboard",
  "gpu",
  "ram",
  "storage",
  "cooler",
  "psu",
  "case",
  "fan",
  "os",
];

/* -------------------------------------------------------------------------- */
/* Builder intent                                                             */
/* -------------------------------------------------------------------------- */

export type BuildGoal =
  | "gaming"
  | "competitive"
  | "streaming"
  | "gaming-streaming"
  | "editing"
  | "rendering"
  | "ai"
  | "office"
  | "custom";

export type GoalOption = {
  id: BuildGoal;
  label: string;
  description: string;
  icon: string;
  /**
   * Relative emphasis used by the recommendation engine when splitting a
   * budget across parts. Values are weights, not percentages.
   */
  weights: { cpu: number; gpu: number; ram: number; storage: number };
};

export const BUILD_GOALS: GoalOption[] = [
  {
    id: "gaming",
    label: "Gaming",
    description: "High frame rates in modern single-player and AAA titles.",
    icon: "gamepad-2",
    weights: { cpu: 1, gpu: 1.6, ram: 1, storage: 1 },
  },
  {
    id: "competitive",
    label: "Competitive Gaming",
    description: "Valorant, CS2, PUBG — maximum FPS for high-refresh monitors.",
    icon: "crosshair",
    weights: { cpu: 1.5, gpu: 1.3, ram: 1, storage: 0.8 },
  },
  {
    id: "streaming",
    label: "Streaming",
    description: "Encoding headroom so your stream stays smooth.",
    icon: "radio",
    weights: { cpu: 1.5, gpu: 1.2, ram: 1.3, storage: 1.2 },
  },
  {
    id: "gaming-streaming",
    label: "Gaming + Streaming",
    description: "Play and broadcast on one machine without dropping frames.",
    icon: "tv",
    weights: { cpu: 1.4, gpu: 1.5, ram: 1.3, storage: 1.1 },
  },
  {
    id: "editing",
    label: "Video Editing",
    description: "Timeline scrubbing, exports and colour work.",
    icon: "clapperboard",
    weights: { cpu: 1.5, gpu: 1.2, ram: 1.6, storage: 1.6 },
  },
  {
    id: "rendering",
    label: "3D Rendering",
    description: "Blender, Unreal and CAD workloads.",
    icon: "box",
    weights: { cpu: 1.4, gpu: 1.6, ram: 1.5, storage: 1.2 },
  },
  {
    id: "ai",
    label: "AI / Machine Learning",
    description: "Local model training and inference — VRAM is king.",
    icon: "brain-circuit",
    weights: { cpu: 1.1, gpu: 2, ram: 1.5, storage: 1.3 },
  },
  {
    id: "office",
    label: "Office / Productivity",
    description: "Fast, quiet and reliable for everyday work.",
    icon: "briefcase",
    weights: { cpu: 1.2, gpu: 0.5, ram: 1, storage: 1 },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Skip the guidance — pick every part yourself.",
    icon: "sliders-horizontal",
    weights: { cpu: 1, gpu: 1, ram: 1, storage: 1 },
  },
];

export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  /** `null` means open-ended. */
  max: number | null;
  blurb: string;
};

export const BUDGET_BANDS: BudgetBand[] = [
  {
    id: "under-150k",
    label: "Under PKR 150,000",
    min: 0,
    max: 150_000,
    blurb: "Solid 1080p esports performance.",
  },
  {
    id: "150-250k",
    label: "PKR 150,000 – 250,000",
    min: 150_000,
    max: 250_000,
    blurb: "High-refresh 1080p, comfortable 1440p.",
  },
  {
    id: "250-400k",
    label: "PKR 250,000 – 400,000",
    min: 250_000,
    max: 400_000,
    blurb: "Serious 1440p gaming with headroom.",
  },
  {
    id: "400-600k",
    label: "PKR 400,000 – 600,000",
    min: 400_000,
    max: 600_000,
    blurb: "High-refresh 1440p and entry 4K.",
  },
  {
    id: "600k-plus",
    label: "PKR 600,000+",
    min: 600_000,
    max: null,
    blurb: "No-compromise 4K and creator workloads.",
  },
];

export type TargetResolution = "1080p" | "1440p" | "4K";
export const RESOLUTIONS: TargetResolution[] = ["1080p", "1440p", "4K"];

export type TargetFps = 60 | 120 | 144 | 240;
export const FPS_TARGETS: { value: TargetFps; label: string; note: string }[] = [
  { value: 60, label: "60 FPS", note: "Smooth on a standard monitor" },
  { value: 120, label: "120 FPS", note: "Noticeably more responsive" },
  { value: 144, label: "144 FPS", note: "The high-refresh sweet spot" },
  { value: 240, label: "240 FPS+", note: "Competitive esports" },
];

export const POPULAR_GAMES = [
  "Valorant",
  "CS2",
  "Fortnite",
  "Call of Duty: Warzone",
  "GTA V",
  "Cyberpunk 2077",
  "Call of Duty",
  "Minecraft",
  "PUBG",
  "Apex Legends",
  "Elden Ring",
  "Rocket League",
] as const;

/* -------------------------------------------------------------------------- */
/* Assembly services                                                          */
/* -------------------------------------------------------------------------- */

export type AssemblyService = {
  id: string;
  label: string;
  description: string;
  /** PKR. 0 means included free with an assembled build. */
  price: number;
  /** Ticked by default when a customer opts into assembly. */
  defaultOn: boolean;
};

/**
 * Service pricing is sample data pending confirmation from Yalman Gaming —
 * the UI labels it as such and the admin can edit every figure.
 */
export const ASSEMBLY_SERVICES: AssemblyService[] = [
  {
    id: "assembly",
    label: "Professional PC Assembly",
    description: "Your parts, built and tested by the Yalman Gaming bench.",
    price: 5_000,
    defaultOn: true,
  },
  {
    id: "cable-management",
    label: "Cable Management",
    description: "Routed, tied and tucked behind the tray.",
    price: 2_000,
    defaultOn: true,
  },
  {
    id: "bios",
    label: "BIOS Setup",
    description: "Latest BIOS, XMP/EXPO memory profile enabled.",
    price: 0,
    defaultOn: true,
  },
  {
    id: "windows",
    label: "Windows Installation",
    description: "Clean install and activation of your licence.",
    price: 2_500,
    defaultOn: true,
  },
  {
    id: "drivers",
    label: "Driver Installation",
    description: "Chipset, GPU and peripheral drivers, all current.",
    price: 0,
    defaultOn: true,
  },
  {
    id: "performance",
    label: "Performance Testing",
    description: "Benchmark pass to confirm the machine hits expected numbers.",
    price: 1_500,
    defaultOn: true,
  },
  {
    id: "stress",
    label: "Stress Testing",
    description: "Extended thermal and stability run before it leaves the shop.",
    price: 2_000,
    defaultOn: false,
  },
  {
    id: "rgb",
    label: "RGB Configuration",
    description: "Lighting profiles set up and synced across components.",
    price: 1_500,
    defaultOn: false,
  },
  {
    id: "delivery",
    label: "Delivery",
    description: "Packed and delivered. Cost varies by city — confirmed on quote.",
    price: 2_500,
    defaultOn: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Compatibility                                                              */
/* -------------------------------------------------------------------------- */

export type IssueSeverity = "error" | "warning" | "info";

export type CompatibilityIssue = {
  id: string;
  severity: IssueSeverity;
  /** Kinds involved, used to highlight the offending builder steps. */
  kinds: ComponentKind[];
  title: string;
  detail: string;
  /** Optional concrete next step, e.g. "Pick an AM5 motherboard". */
  fix?: string;
};

export type PowerEstimate = {
  /** Sum of component draw under a realistic gaming load. */
  estimatedWatts: number;
  /** Estimate plus transient/upgrade headroom, rounded to a real PSU size. */
  recommendedPsuW: number;
  /** Per-kind contribution, for the power breakdown UI. */
  breakdown: { kind: ComponentKind; label: string; watts: number }[];
  /** Selected PSU capacity, if one is chosen. */
  selectedPsuW: number | null;
  /** Percentage of the selected PSU the build draws. */
  loadPercent: number | null;
};

export type CompatibilityReport = {
  /** `error` blocks checkout, `warning` allows it with a confirmation. */
  status: "ok" | "warning" | "error";
  issues: CompatibilityIssue[];
  power: PowerEstimate;
  /** Required kinds still empty. */
  missing: ComponentKind[];
  /** True when every required kind is filled and there are no errors. */
  complete: boolean;
};

/* -------------------------------------------------------------------------- */
/* Build state (client-side, serialisable)                                    */
/* -------------------------------------------------------------------------- */

/**
 * The minimal product shape the builder and compatibility engine need.
 * Deliberately a plain object so it can live in localStorage and travel to
 * the server in a request body.
 */
export type BuilderPart = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  kind: ComponentKind;
  brandName: string | null;
  price: number;
  salePrice: number | null;
  samplePrice: boolean;
  stock: number;
  imageUrl: string | null;
  headline: string | null;

  // Compatibility attributes (all optional — only some apply per kind).
  socket: string | null;
  chipset: string | null;
  tdp: number | null;
  peakPowerW: number | null;
  integratedGraphics: boolean;
  memoryType: string | null;
  memorySpeed: number | null;
  memorySlots: number | null;
  maxMemoryGb: number | null;
  capacityGb: number | null;
  moduleCount: number | null;
  vramGb: number | null;
  gpuLengthMm: number | null;
  requiredConnectors: string[] | null;
  recommendedPsuW: number | null;
  storageInterface: string | null;
  formFactor: string | null;
  m2Slots: number | null;
  sataPorts: number | null;
  wattage: number | null;
  efficiency: string | null;
  providedConnectors: Record<string, number> | null;
  psuFormFactor: string | null;
  psuLengthMm: number | null;
  coolerType: string | null;
  coolerHeightMm: number | null;
  radiatorSizeMm: number | null;
  supportedSockets: string[] | null;
  coolingCapacityW: number | null;
  supportedFormFactors: string[] | null;
  maxGpuLengthMm: number | null;
  maxCoolerHeightMm: number | null;
  maxPsuLengthMm: number | null;
  radiatorSupport: Record<string, number> | null;
  caseStyle: string | null;
  dimensionsMm: string | null;
  includedFans: number | null;
  rgb: boolean;
};

/** A slot in the build: one kind, one or more parts. */
export type BuildSelection = Record<string, BuilderPart[]>;

export type BuildState = {
  id: string | null;
  shareCode: string | null;
  name: string;
  goal: BuildGoal | null;
  budgetId: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  resolution: TargetResolution | null;
  targetFps: TargetFps | null;
  games: string[];
  selection: BuildSelection;
  services: string[];
  assembleForMe: boolean;
};

export const EMPTY_BUILD: BuildState = {
  id: null,
  shareCode: null,
  name: "Untitled Build",
  goal: null,
  budgetId: null,
  budgetMin: null,
  budgetMax: null,
  resolution: null,
  targetFps: null,
  games: [],
  selection: {},
  services: [],
  assembleForMe: false,
};

/* -------------------------------------------------------------------------- */
/* Catalog helpers                                                            */
/* -------------------------------------------------------------------------- */

export type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "rating"
  | "name";

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "newest", label: "Newest" },
  { id: "rating", label: "Top Rated" },
  { id: "name", label: "Name A–Z" },
];

export type StockState = "in-stock" | "low-stock" | "out-of-stock";

export function stockState(stock: number, lowStockAt = 3): StockState {
  if (stock <= 0) return "out-of-stock";
  if (stock <= lowStockAt) return "low-stock";
  return "in-stock";
}
