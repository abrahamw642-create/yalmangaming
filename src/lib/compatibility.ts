/**
 * Yalman Gaming — PC compatibility engine.
 *
 * Pure functions over a `BuildSelection`. No database access, no React: the
 * same code runs in the builder UI for live feedback and on the server before
 * a build is saved, quoted or added to the cart, so a client that skips the UI
 * cannot push an impossible build through.
 *
 * Severity contract:
 *   error   — the parts physically cannot work together. Blocks checkout.
 *   warning — it will work, but the customer should know. Allowed.
 *   info    — a helpful note. Never blocks anything.
 */

import type {
  BuilderPart,
  BuildSelection,
  CompatibilityIssue,
  CompatibilityReport,
  ComponentKind,
  PowerEstimate,
} from "./types";
import { BUILDER_STEP_KINDS, KIND_META } from "./types";

/* -------------------------------------------------------------------------- */
/* Selection access                                                           */
/* -------------------------------------------------------------------------- */

export function partsOf(
  selection: BuildSelection,
  kind: ComponentKind,
): BuilderPart[] {
  return selection[kind] ?? [];
}

export function firstOf(
  selection: BuildSelection,
  kind: ComponentKind,
): BuilderPart | null {
  return selection[kind]?.[0] ?? null;
}

export function allParts(selection: BuildSelection): BuilderPart[] {
  return Object.values(selection).flat();
}

/* -------------------------------------------------------------------------- */
/* Power                                                                      */
/* -------------------------------------------------------------------------- */

/** Standard PSU capacities actually sold, used to round recommendations up. */
const PSU_SIZES = [450, 500, 550, 600, 650, 750, 850, 1000, 1200, 1500, 1600];

/**
 * Baseline draw for the parts that have no TDP of their own: motherboard VRM,
 * chipset, USB devices and fans, plus a small allowance for peripherals drawing
 * from the board.
 */
const BASE_SYSTEM_WATTS = 25;

/**
 * Above this PSU load percentage the build gets a headroom warning. 80% leaves
 * the 20% margin that absorbs GPU transient spikes without tripping protection.
 */
const HEADROOM_WARN_PERCENT = 80;

function motherboardWatts(board: BuilderPart | null): number {
  if (!board) return 0;
  switch (board.formFactor) {
    case "Mini-ITX":
      return 35;
    case "Micro-ATX":
      return 45;
    case "E-ATX":
      return 70;
    default:
      return 55; // ATX
  }
}

function storageWatts(drive: BuilderPart): number {
  switch (drive.storageInterface) {
    case "nvme-gen5":
      return 11;
    case "nvme-gen4":
      return 8;
    case "sata":
      return 3;
    case "hdd":
      return 9;
    default:
      return 6;
  }
}

function coolerWatts(cooler: BuilderPart): number {
  // An AIO adds a pump plus radiator fans; an air cooler is a single fan.
  return cooler.coolerType === "aio" ? 18 : 5;
}

/**
 * The wattage a CPU actually sustains under load — the figure both the cooler
 * and the PSU have to cope with.
 *
 * `tdp` alone cannot be used because it means different things per vendor: AMD
 * publishes TDP (a 120W part pulls ~162W PPT) while Intel publishes base power
 * (a 125W part sustains ~250W PL2). Treating both as the same number rated a
 * 220W air cooler as adequate for a Core Ultra 9 285K. Catalogue rows carry the
 * real figure in `peakPowerW`; the multiplier is only a fallback for rows that
 * predate it.
 */
export function cpuSustainedWatts(cpu: BuilderPart): number {
  if (cpu.peakPowerW && cpu.peakPowerW > 0) return cpu.peakPowerW;
  return cpu.tdp ? Math.round(cpu.tdp * 1.35) : 0;
}

/**
 * Estimates draw under a sustained gaming load — the number that matters for
 * PSU sizing. CPUs are taken above their rated TDP because modern boost
 * behaviour (PBO / Intel PL2) routinely exceeds it, and GPUs get a margin for
 * transient spikes.
 */
export function estimatePower(selection: BuildSelection): PowerEstimate {
  const breakdown: PowerEstimate["breakdown"] = [];
  const push = (kind: ComponentKind, label: string, watts: number) => {
    if (watts > 0) breakdown.push({ kind, label, watts: Math.round(watts) });
  };

  const cpu = firstOf(selection, "cpu");
  if (cpu) push("cpu", cpu.name, cpuSustainedWatts(cpu));

  const gpu = firstOf(selection, "gpu");
  if (gpu?.tdp) push("gpu", gpu.name, gpu.tdp * 1.1);

  const board = firstOf(selection, "motherboard");
  if (board) push("motherboard", board.name, motherboardWatts(board));

  const ram = firstOf(selection, "ram");
  if (ram) {
    const modules = ram.moduleCount ?? 2;
    push("ram", ram.name, modules * (ram.memoryType === "DDR5" ? 4 : 3));
  }

  const drives = partsOf(selection, "storage");
  for (const drive of drives) push("storage", drive.name, storageWatts(drive));

  const cooler = firstOf(selection, "cooler");
  if (cooler) push("cooler", cooler.name, coolerWatts(cooler));

  const fans = partsOf(selection, "fan");
  if (fans.length) {
    push("fan", `${fans.length} × case fan`, fans.length * 2.5);
  }

  const subtotal = breakdown.reduce((sum, row) => sum + row.watts, 0);
  const estimatedWatts = Math.round(subtotal + (subtotal > 0 ? BASE_SYSTEM_WATTS : 0));

  // Target roughly 60-70% PSU load: quietest fan curve, best efficiency, and
  // room for a future GPU upgrade.
  const target = Math.ceil(estimatedWatts * 1.45);
  const recommendedPsuW =
    estimatedWatts === 0
      ? 0
      : (PSU_SIZES.find((size) => size >= target) ?? PSU_SIZES[PSU_SIZES.length - 1]);

  const psu = firstOf(selection, "psu");
  const selectedPsuW = psu?.wattage ?? null;

  return {
    estimatedWatts,
    recommendedPsuW,
    breakdown,
    selectedPsuW,
    loadPercent:
      selectedPsuW && selectedPsuW > 0
        ? Math.round((estimatedWatts / selectedPsuW) * 100)
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Connectors                                                                 */
/* -------------------------------------------------------------------------- */

/** Maps the many ways a PCIe power connector is written to one canonical key. */
export function normalizeConnector(raw: string): string {
  const v = raw.toLowerCase().replace(/\s+/g, "");
  if (/12vhpwr|12v-2x6|12v2x6|16-pin|16pin/.test(v)) return "12vhpwr";
  if (/8-pin|8pin|6\+2/.test(v)) return "pcie8";
  if (/6-pin|6pin/.test(v)) return "pcie6";
  return v;
}

const CONNECTOR_LABELS: Record<string, string> = {
  "12vhpwr": "12VHPWR (16-pin)",
  pcie8: "8-pin PCIe",
  pcie6: "6-pin PCIe",
};

function connectorLabel(key: string): string {
  return CONNECTOR_LABELS[key] ?? key;
}

/** Counts each canonical connector a GPU needs. */
function requiredConnectorCounts(gpu: BuilderPart): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of gpu.requiredConnectors ?? []) {
    const key = normalizeConnector(raw);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

function parseDimensions(value: string | null): number[] | null {
  if (!value) return null;
  const nums = value.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return null;
  return nums.slice(0, 3).map(Number);
}

/**
 * Runs every built-in rule against a selection.
 *
 * Rules only fire when both sides of the comparison are present AND both carry
 * the data the rule needs. A missing spec never produces a false "incompatible"
 * — the engine stays silent rather than guessing.
 */
export function checkCompatibility(
  selection: BuildSelection,
): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];
  const add = (issue: CompatibilityIssue) => issues.push(issue);

  const cpu = firstOf(selection, "cpu");
  const board = firstOf(selection, "motherboard");
  const gpu = firstOf(selection, "gpu");
  const ram = firstOf(selection, "ram");
  const psu = firstOf(selection, "psu");
  const cooler = firstOf(selection, "cooler");
  const pcCase = firstOf(selection, "case");
  const drives = partsOf(selection, "storage");

  const power = estimatePower(selection);

  /* --- CPU <-> motherboard socket ---------------------------------------- */
  if (cpu?.socket && board?.socket && cpu.socket !== board.socket) {
    add({
      id: "cpu-socket",
      severity: "error",
      kinds: ["cpu", "motherboard"],
      title: "CPU and motherboard sockets do not match",
      detail: `${cpu.name} is an ${cpu.socket} processor but ${board.name} has an ${board.socket} socket. The CPU physically will not seat in this board.`,
      fix: `Choose an ${cpu.socket} motherboard, or a CPU that uses ${board.socket}.`,
    });
  }

  /* --- RAM <-> motherboard ------------------------------------------------ */
  if (ram?.memoryType && board?.memoryType && ram.memoryType !== board.memoryType) {
    add({
      id: "ram-type",
      severity: "error",
      kinds: ["ram", "motherboard"],
      title: `${ram.memoryType} memory will not fit a ${board.memoryType} board`,
      detail: `${board.name} accepts ${board.memoryType} only. ${ram.memoryType} modules are keyed differently and cannot be installed.`,
      fix: `Pick a ${board.memoryType} kit.`,
    });
  }

  if (ram?.moduleCount && board?.memorySlots && ram.moduleCount > board.memorySlots) {
    add({
      id: "ram-slots",
      severity: "error",
      kinds: ["ram", "motherboard"],
      title: "Not enough memory slots",
      detail: `This kit has ${ram.moduleCount} modules but ${board.name} only has ${board.memorySlots} DIMM slots.`,
      fix: `Choose a kit with ${board.memorySlots} modules or fewer.`,
    });
  }

  if (ram?.capacityGb && board?.maxMemoryGb && ram.capacityGb > board.maxMemoryGb) {
    add({
      id: "ram-capacity",
      severity: "error",
      kinds: ["ram", "motherboard"],
      title: "Memory capacity exceeds the board's maximum",
      detail: `${board.name} supports up to ${board.maxMemoryGb}GB. This kit is ${ram.capacityGb}GB.`,
      fix: `Choose a kit of ${board.maxMemoryGb}GB or less.`,
    });
  }

  if (ram?.memorySpeed && board?.memorySpeed && ram.memorySpeed > board.memorySpeed) {
    add({
      id: "ram-speed",
      severity: "warning",
      kinds: ["ram", "motherboard"],
      title: "Memory is rated faster than the board's supported speed",
      detail: `This kit runs at ${ram.memorySpeed} MT/s; ${board.name} is validated to ${board.memorySpeed} MT/s. The kit will work but may clock down.`,
      fix: "Fine to proceed — or pick a board with higher validated memory support.",
    });
  }

  /* --- Motherboard <-> case ---------------------------------------------- */
  if (board?.formFactor && pcCase?.supportedFormFactors?.length) {
    if (!pcCase.supportedFormFactors.includes(board.formFactor)) {
      add({
        id: "board-case-fit",
        severity: "error",
        kinds: ["motherboard", "case"],
        title: "Motherboard does not fit this case",
        detail: `${pcCase.name} accepts ${pcCase.supportedFormFactors.join(", ")} boards. ${board.name} is ${board.formFactor}.`,
        fix: `Choose a ${board.formFactor}-compatible case, or a smaller board.`,
      });
    }
  }

  /* --- GPU <-> case ------------------------------------------------------- */
  if (gpu?.gpuLengthMm && pcCase?.maxGpuLengthMm) {
    if (gpu.gpuLengthMm > pcCase.maxGpuLengthMm) {
      add({
        id: "gpu-length",
        severity: "error",
        kinds: ["gpu", "case"],
        title: "Graphics card is too long for this case",
        detail: `${gpu.name} is ${gpu.gpuLengthMm}mm long. ${pcCase.name} clears ${pcCase.maxGpuLengthMm}mm.`,
        fix: "Choose a shorter card or a case with more GPU clearance.",
      });
    } else if (pcCase.maxGpuLengthMm - gpu.gpuLengthMm < 15) {
      add({
        id: "gpu-length-tight",
        severity: "warning",
        kinds: ["gpu", "case"],
        title: "Very tight graphics card clearance",
        detail: `Only ${pcCase.maxGpuLengthMm - gpu.gpuLengthMm}mm to spare. Front cabling and radiators can eat this margin.`,
        fix: "It fits, but plan cable routing carefully.",
      });
    }
  }

  /* --- Cooler <-> CPU ----------------------------------------------------- */
  if (cooler?.supportedSockets?.length && cpu?.socket) {
    if (!cooler.supportedSockets.includes(cpu.socket)) {
      add({
        id: "cooler-socket",
        severity: "error",
        kinds: ["cooler", "cpu"],
        title: "Cooler does not support this CPU socket",
        detail: `${cooler.name} ships with mounting hardware for ${cooler.supportedSockets.join(", ")}. Your CPU is ${cpu.socket}.`,
        fix: `Choose a cooler that lists ${cpu.socket} support.`,
      });
    }
  }

  // Compare against sustained draw, not the published TDP — see
  // `cpuSustainedWatts`. An Intel part rated 125W base holds ~250W under load,
  // and judging a cooler against the 125W figure passes hardware that throttles.
  const cpuLoadWatts = cpu ? cpuSustainedWatts(cpu) : 0;
  if (cooler?.coolingCapacityW && cpuLoadWatts && cooler.coolingCapacityW < cpuLoadWatts) {
    add({
      id: "cooler-capacity",
      severity: "warning",
      kinds: ["cooler", "cpu"],
      title: "Cooler may not keep up with this CPU",
      detail: `${cpu!.name} sustains about ${cpuLoadWatts}W under load; ${cooler.name} is rated for roughly ${cooler.coolingCapacityW}W. Expect thermal throttling.`,
      fix: "Step up to a larger air cooler or an AIO.",
    });
  }

  /* --- Cooler <-> case ---------------------------------------------------- */
  if (cooler?.coolerType === "air" && cooler.coolerHeightMm && pcCase?.maxCoolerHeightMm) {
    if (cooler.coolerHeightMm > pcCase.maxCoolerHeightMm) {
      add({
        id: "cooler-height",
        severity: "error",
        kinds: ["cooler", "case"],
        title: "CPU cooler is too tall for this case",
        detail: `${cooler.name} stands ${cooler.coolerHeightMm}mm. ${pcCase.name} clears ${pcCase.maxCoolerHeightMm}mm — the side panel will not close.`,
        fix: "Choose a lower-profile cooler, an AIO, or a taller case.",
      });
    }
  }

  if (cooler?.coolerType === "aio" && cooler.radiatorSizeMm && pcCase?.radiatorSupport) {
    const largest = Math.max(...Object.values(pcCase.radiatorSupport));
    if (cooler.radiatorSizeMm > largest) {
      const mounts = Object.entries(pcCase.radiatorSupport)
        .map(([pos, size]) => `${pos} ${size}mm`)
        .join(", ");
      add({
        id: "radiator-fit",
        severity: "error",
        kinds: ["cooler", "case"],
        title: "Radiator will not fit this case",
        detail: `${cooler.name} uses a ${cooler.radiatorSizeMm}mm radiator. ${pcCase.name} mounts: ${mounts}.`,
        fix: `Choose a radiator of ${largest}mm or smaller.`,
      });
    }
  }

  /* --- PSU ---------------------------------------------------------------- */
  if (psu?.wattage && power.estimatedWatts > 0) {
    if (psu.wattage < power.estimatedWatts) {
      add({
        id: "psu-undersized",
        severity: "error",
        kinds: ["psu"],
        title: "Power supply is too small for this build",
        detail: `The build draws around ${power.estimatedWatts}W under load but ${psu.name} delivers ${psu.wattage}W. The system will shut down or fail to boot.`,
        fix: `Fit a ${power.recommendedPsuW}W unit or larger.`,
      });
    } else if (power.loadPercent !== null && power.loadPercent > HEADROOM_WARN_PERCENT) {
      // Warn on genuinely thin headroom, not merely on being below the
      // recommended size. `recommendedPsuW` targets ~70% load, so a unit a step
      // under it is still a sound choice — flagging that would nag customers
      // who picked sensibly. Below ~20% headroom, GPU transient spikes (which
      // can briefly double the card's draw) start tripping OCP.
      add({
        id: "psu-tight",
        severity: "warning",
        kinds: ["psu"],
        title: "Power supply has little headroom",
        detail: `At about ${power.estimatedWatts}W estimated draw this unit runs at roughly ${power.loadPercent}% load. GPU transient spikes can trip its protection.`,
        fix: `${power.recommendedPsuW}W is the comfortable size for this build.`,
      });
    }
  }

  if (gpu && psu) {
    const required = requiredConnectorCounts(gpu);
    const provided = psu.providedConnectors ?? null;
    if (Object.keys(required).length > 0 && provided) {
      for (const [key, needed] of Object.entries(required)) {
        const have = provided[key] ?? 0;
        if (have >= needed) continue;

        // A 12VHPWR card can run off an adapter from spare 8-pin cables, which
        // works but is worth flagging rather than blocking.
        if (key === "12vhpwr" && (provided.pcie8 ?? 0) >= 3) {
          add({
            id: "psu-12vhpwr-adapter",
            severity: "warning",
            kinds: ["psu", "gpu"],
            title: "Graphics card will need its 12VHPWR adapter",
            detail: `${psu.name} has no native 12VHPWR cable, but it has ${provided.pcie8} 8-pin PCIe connectors to drive the adapter included with ${gpu.name}.`,
            fix: "Works as-is. A PSU with a native 12VHPWR cable is tidier and safer.",
          });
          continue;
        }

        add({
          id: `psu-connector-${key}`,
          severity: "error",
          kinds: ["psu", "gpu"],
          title: "Power supply lacks the required GPU connectors",
          detail: `${gpu.name} needs ${needed} × ${connectorLabel(key)} but ${psu.name} provides ${have}.`,
          fix: "Choose a PSU with the right PCIe power cabling.",
        });
      }
    }
  }

  if (psu?.psuFormFactor && pcCase?.supportedFormFactors) {
    // An SFX unit fits an ATX case with a bracket; the reverse does not hold.
    const caseIsSmall = pcCase.caseStyle?.toLowerCase().includes("itx") ?? false;
    if (caseIsSmall && psu.psuFormFactor === "ATX") {
      add({
        id: "psu-form-factor",
        severity: "warning",
        kinds: ["psu", "case"],
        title: "Check power supply clearance",
        detail: `${pcCase.name} is a small-form-factor case and ${psu.name} is a full ATX unit. Many ITX cases take SFX only.`,
        fix: "Confirm with us on WhatsApp, or choose an SFX unit.",
      });
    }
  }

  if (psu?.psuLengthMm && pcCase?.maxPsuLengthMm && psu.psuLengthMm > pcCase.maxPsuLengthMm) {
    add({
      id: "psu-length",
      severity: "error",
      kinds: ["psu", "case"],
      title: "Power supply is too long for this case",
      detail: `${psu.name} is ${psu.psuLengthMm}mm deep; ${pcCase.name} allows ${pcCase.maxPsuLengthMm}mm.`,
      fix: "Choose a shorter unit.",
    });
  }

  /* --- Storage <-> motherboard ------------------------------------------- */
  if (board && drives.length) {
    const nvme = drives.filter((d) => d.storageInterface?.startsWith("nvme")).length;
    const sata = drives.filter(
      (d) => d.storageInterface === "sata" || d.storageInterface === "hdd",
    ).length;

    if (board.m2Slots !== null && board.m2Slots !== undefined && nvme > board.m2Slots) {
      add({
        id: "storage-m2",
        severity: "error",
        kinds: ["storage", "motherboard"],
        title: "Too many NVMe drives for this motherboard",
        detail: `You have selected ${nvme} NVMe drives but ${board.name} has ${board.m2Slots} M.2 slots.`,
        fix: `Remove ${nvme - board.m2Slots} NVMe drive(s), or swap to SATA.`,
      });
    }

    if (board.sataPorts !== null && board.sataPorts !== undefined && sata > board.sataPorts) {
      add({
        id: "storage-sata",
        severity: "error",
        kinds: ["storage", "motherboard"],
        title: "Too many SATA drives for this motherboard",
        detail: `You have selected ${sata} SATA drives but ${board.name} has ${board.sataPorts} SATA ports.`,
        fix: `Remove ${sata - board.sataPorts} drive(s).`,
      });
    }
  }

  /* --- Graphics output ---------------------------------------------------- */
  if (cpu && !gpu && !cpu.integratedGraphics) {
    add({
      id: "no-display-output",
      severity: "error",
      kinds: ["cpu", "gpu"],
      title: "This build has no way to output video",
      detail: `${cpu.name} has no integrated graphics, and no graphics card is selected. The machine will boot but show nothing on screen.`,
      fix: "Add a graphics card, or choose a CPU with integrated graphics.",
    });
  }

  /* --- Airflow note ------------------------------------------------------- */
  if (pcCase && (pcCase.includedFans ?? 0) === 0 && partsOf(selection, "fan").length === 0) {
    add({
      id: "no-fans",
      severity: "warning",
      kinds: ["case", "fan"],
      title: "No case fans selected",
      detail: `${pcCase.name} does not include fans and none have been added. Without airflow the CPU and GPU will throttle.`,
      fix: "Add at least two or three case fans.",
    });
  }

  /* --- Physical footprint note -------------------------------------------- */
  const caseDims = parseDimensions(pcCase?.dimensionsMm ?? null);
  if (caseDims && pcCase) {
    const [w, , d] = caseDims;
    if (w > 250 && d > 500) {
      add({
        id: "case-footprint",
        severity: "info",
        kinds: ["case"],
        title: "This is a large case",
        detail: `${pcCase.name} measures ${pcCase.dimensionsMm}mm. Check your desk or floor space before ordering.`,
      });
    }
  }

  /* --- Completeness ------------------------------------------------------- */
  const missing = BUILDER_STEP_KINDS.filter(
    (kind) => KIND_META[kind].required && partsOf(selection, kind).length === 0,
  );

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");

  return {
    status: hasError ? "error" : hasWarning ? "warning" : "ok",
    issues,
    power,
    missing,
    complete: missing.length === 0 && !hasError,
  };
}

/* -------------------------------------------------------------------------- */
/* Candidate filtering                                                        */
/* -------------------------------------------------------------------------- */

export type CandidateVerdict = {
  part: BuilderPart;
  /** False when adding this part would introduce a hard error. */
  compatible: boolean;
  /** Warnings this part would introduce — shown as a caution badge. */
  warnings: CompatibilityIssue[];
  /** The first blocking issue, for the "why not" tooltip. */
  blocker: CompatibilityIssue | null;
};

/**
 * Evaluates each candidate against the rest of the current build so the picker
 * can sort compatible parts first and explain why the others are excluded.
 *
 * Implemented by swapping the candidate into a copy of the selection and
 * re-running the engine — the rules stay in exactly one place, so a filter can
 * never drift out of sync with validation.
 */
export function rankCandidates(
  kind: ComponentKind,
  candidates: BuilderPart[],
  selection: BuildSelection,
): CandidateVerdict[] {
  // Ignore issues that are already present without the candidate, so an
  // unrelated existing conflict does not grey out every option.
  const baselineIds = new Set(
    checkCompatibility(withoutKind(selection, kind)).issues.map((i) => i.id),
  );

  return candidates.map((part) => {
    const trial = { ...withoutKind(selection, kind), [kind]: [part] };
    const report = checkCompatibility(trial);
    const fresh = report.issues.filter((i) => !baselineIds.has(i.id));

    // An issue only disqualifies this candidate if every OTHER part it
    // implicates has actually been chosen. Otherwise the conflict is with an
    // empty slot the customer has not reached yet, and the fix may well be the
    // other part rather than this one — e.g. picking a CPU with no integrated
    // graphics raises "no display output" until a GPU is added, which must not
    // grey out perfectly good processors at the CPU step.
    const decidable = (issue: CompatibilityIssue) =>
      issue.kinds.every((k) => k === kind || partsOf(selection, k).length > 0);

    const blocker =
      fresh.find((i) => i.severity === "error" && decidable(i)) ?? null;

    return {
      part,
      compatible: !blocker,
      warnings: fresh.filter((i) => i.severity === "warning" && decidable(i)),
      blocker,
    };
  });
}

function withoutKind(
  selection: BuildSelection,
  kind: ComponentKind,
): BuildSelection {
  const copy: BuildSelection = { ...selection };
  delete copy[kind];
  return copy;
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                     */
/* -------------------------------------------------------------------------- */

export function partPrice(part: BuilderPart): number {
  return part.salePrice && part.salePrice > 0 && part.salePrice < part.price
    ? part.salePrice
    : part.price;
}

export function componentsTotal(selection: BuildSelection): number {
  return allParts(selection).reduce((sum, part) => sum + partPrice(part), 0);
}

/** True when any selected part is still carrying seeded sample pricing. */
export function hasSamplePricing(selection: BuildSelection): boolean {
  return allParts(selection).some((p) => p.samplePrice);
}

/** Parts that are out of stock — surfaced before checkout. */
export function outOfStockParts(selection: BuildSelection): BuilderPart[] {
  return allParts(selection).filter((p) => p.stock <= 0);
}
