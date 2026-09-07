"use client";

/**
 * The machine itself — the one place that knows how a PC goes together.
 *
 * NEVER import this from a Server Component: it pulls three.js and every part
 * in `./parts` in at module scope. `HeroScene` and `BuilderScene` are the only
 * entry points, and callers reach them with
 * `dynamic(() => import(...), { ssr: false })`.
 *
 * Two jobs, deliberately kept apart:
 *
 *   `resolveMachine()` is pure. It turns a `BuildSelection` into a fully
 *   dimensioned `MachineSpec` — every position in the scene is derived here,
 *   from the same real spec fields the compatibility engine validates against
 *   (`gpuLengthMm`, `coolerHeightMm`, `radiatorSizeMm`, `formFactor`,
 *   `caseStyle`, `memorySlots`, `psuLengthMm`, `storageInterface`). Nothing
 *   downstream invents a dimension.
 *
 *   `<ExplodedPC>` renders that spec and animates it. Part groups are damped
 *   toward a target every frame; scroll progress arrives through a ref so
 *   scrolling never re-renders React, and a part that has just been added
 *   slides in from the direction it would come out.
 *
 * A note on honesty: the picture is a *product shot*, not a scale drawing. It
 * frames every chassis to the same height so the preview panel is stable, and
 * it will happily draw a board in a case that is too small for it — telling the
 * customer that it does not fit is `checkCompatibility`'s job, and duplicating
 * that judgement in geometry is how the two end up disagreeing.
 */

import * as React from "react";
// Type-only: the assembly holds references to three's `Group` but never
// constructs anything itself — every geometry belongs to a part.
import type * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { firstOf, partsOf } from "@/lib/compatibility";
import type { BuilderPart, BuildSelection } from "@/lib/types";
import { EXPLODE_PHASES } from "./SceneFallback";
import { clamp01, damp, dampVec3, mm, smoothstep } from "./Rig";
import { Case, rearApertures } from "./parts/Case";
import { Cooler, type RadiatorPlacement } from "./parts/Cooler";
import { Cpu } from "./parts/Cpu";
import { Fans, type FanSlot } from "./parts/Fans";
import { Gpu } from "./parts/Gpu";
import {
  Motherboard,
  boardLayout,
  normaliseFormFactor,
  type BoardFormFactor,
  type BoardLayout,
} from "./parts/Motherboard";
import { Psu } from "./parts/Psu";
import { RamSticks } from "./parts/RamSticks";
import { Storage, type DrivePlacement } from "./parts/Storage";

export { EXPLODE_PHASES, phaseAt } from "./SceneFallback";
export type { ExplodePhase } from "./SceneFallback";

/* ========================================================================== */
/* Chassis profiles                                                           */
/* ========================================================================== */

type CaseProfileKey = "full" | "mid" | "mini" | "itx";

/**
 * Starting dimensions per chassis class, scene units (1 = 100 mm). These are
 * only a floor: a case that has to swallow a 360 mm radiator or a 170 mm tower
 * cooler is grown to fit below, which is exactly what the real product does.
 */
const CASE_PROFILES: Record<
  CaseProfileKey,
  { w: number; h: number; d: number; shroud: number; slots: number }
> = {
  full: { w: 2.4, h: 5.55, d: 5.1, shroud: 1.05, slots: 7 },
  mid: { w: 2.15, h: 4.6, d: 4.55, shroud: 1.05, slots: 7 },
  mini: { w: 2.05, h: 3.95, d: 4.1, shroud: 1.05, slots: 4 },
  itx: { w: 1.95, h: 3.4, d: 3.6, shroud: 0, slots: 2 },
};

/** Distance from the motherboard tray's face to the board's own plane. */
const BOARD_PLANE_INSET = 0.33;
/** Air gap between the tallest thing on the board and the side panel. */
const SIDE_CLEARANCE = 0.14;
/** Height of a radiator core plus the fans bolted to it. */
const RAD_THICKNESS = 0.27;

function caseProfileKey(
  part: BuilderPart | null,
  board: BoardFormFactor,
): CaseProfileKey {
  const style = (part?.caseStyle ?? "").toLowerCase();
  // "Mini ITX" contains both words, so the ITX test has to come first.
  if (style.includes("full")) return "full";
  if (style.includes("itx") || style.includes("sff")) return "itx";
  if (style.includes("micro") || style.includes("mini")) return "mini";
  if (style.includes("mid") || style.includes("tower")) return "mid";

  // No usable `caseStyle`: take the cue from the board it has to hold.
  if (board === "E-ATX") return "full";
  if (board === "Mini-ITX") return "itx";
  if (board === "Micro-ATX") return "mini";
  return "mid";
}

/**
 * How a radiator of a given nominal size is actually built. 280 and 420 are two
 * and three 140 mm fans; 240 and 360 are two and three 120s.
 */
function radiatorFans(sizeMm: number): { fans: number; fanSizeMm: number } {
  const fans = sizeMm >= 330 ? 3 : sizeMm >= 230 ? 2 : 1;
  return { fans, fanSizeMm: Math.round(sizeMm / fans) };
}

/**
 * Case-fan frame size. There is no fan-size column on a part, so it comes from
 * the product name — the only place the figure exists — and anything that does
 * not parse as a real frame size falls back to 120.
 */
function fanSizeFromName(part: BuilderPart | null): number {
  const match = part?.name.match(/(\d{2,3})\s*mm/i);
  const size = match ? Number(match[1]) : NaN;
  return Number.isFinite(size) && size >= 80 && size <= 200 ? size : 120;
}

function driveType(part: BuilderPart): DrivePlacement["type"] {
  const iface = part.storageInterface ?? "";
  if (iface.startsWith("nvme")) return "m2";
  if (iface === "hdd") return "hdd";
  return "ssd";
}

/* ========================================================================== */
/* Machine specification                                                      */
/* ========================================================================== */

export type MachineSpec = {
  shell: {
    width: number;
    height: number;
    depth: number;
    shroudHeight: number;
    expansionSlots: number;
    rgb: boolean;
  };
  glass: boolean;
  /** Global RGB switch. Individual parts also need their own `rgb` flag. */
  rgb: boolean;

  board: {
    layout: BoardLayout;
    present: boolean;
    /** Case-space origin of the board plane. */
    origin: [number, number, number];
    planeX: number;
    topY: number;
    rgb: boolean;
  };

  cpu: { sizeMm: number } | null;
  ram: { count: number; heightMm: number; rgb: boolean } | null;
  gpu: { lengthMm: number; slots: number; rgb: boolean } | null;
  cooler: {
    type: "air" | "aio";
    heightMm: number;
    position: [number, number, number];
    radiator: RadiatorPlacement | null;
    rgb: boolean;
  } | null;
  psu: {
    lengthMm: number;
    formFactor: string | null;
    fanDown: boolean;
    position: [number, number, number];
    rgb: boolean;
  } | null;

  /** Board-local. Rendered inside the motherboard's frame. */
  m2: DrivePlacement[];
  /** Case space, on the shroud or the floor. */
  bays: DrivePlacement[];

  fans: {
    sizeMm: number;
    rgb: boolean;
    front: FanSlot[];
    rear: FanSlot[];
    top: FanSlot[];
  };

  /** Uniform scale that frames any chassis identically. */
  fit: number;
  /** Scene-space (already scaled by `fit`) values the Rig needs. */
  floorY: number;
  shadowScale: number;
  interior: [number, number, number][];

  /** Part identity per slot, so the renderer can animate an addition. */
  keys: Record<KeyId, string>;
};

export type MachineOptions = {
  glass?: boolean;
  rgb?: boolean;
  /**
   * Fill the empty slots with a plausible complete machine. The homepage shows
   * a machine; the builder shows a configuration, and an empty configuration
   * has to look empty or the preview is lying about what has been chosen.
   */
  showcase?: boolean;
};

type KeyId =
  | "chassis"
  | "board"
  | "cpu"
  | "gpu"
  | "ram"
  | "cooler"
  | "psu"
  | "storage"
  | "fans";

export function resolveMachine(
  selection: BuildSelection,
  options: MachineOptions = {},
): MachineSpec {
  const { glass = true, rgb = true, showcase = false } = options;

  const casePart = firstOf(selection, "case");
  const boardPart = firstOf(selection, "motherboard");
  const cpuPart = firstOf(selection, "cpu");
  const gpuPart = firstOf(selection, "gpu");
  const ramPart = firstOf(selection, "ram");
  const coolerPart = firstOf(selection, "cooler");
  const psuPart = firstOf(selection, "psu");
  const driveParts = partsOf(selection, "storage");
  const fanParts = partsOf(selection, "fan");

  /* --- Board ------------------------------------------------------------ */

  const boardFf: BoardFormFactor = boardPart
    ? normaliseFormFactor(boardPart.formFactor)
    : showcase
      ? "ATX"
      : normaliseFormFactor(
          // With no board chosen, the case's own support list is the best
          // available hint at what the machine is going to be.
          casePart?.supportedFormFactors?.[0] ?? null,
        );

  const layout = boardLayout(boardFf, boardPart?.memorySlots ?? (showcase ? 4 : null));

  /* --- Cooling ---------------------------------------------------------- */

  const coolerType: "air" | "aio" =
    coolerPart?.coolerType === "aio" || coolerPart?.coolerType === "air"
      ? coolerPart.coolerType
      : coolerPart?.radiatorSizeMm
        ? "aio"
        : showcase && !coolerPart
          ? "aio"
          : "air";

  const hasCooler = Boolean(coolerPart) || showcase;
  const coolerHeightMm = coolerPart?.coolerHeightMm ?? 158;
  const radiatorSizeMm =
    coolerType === "aio"
      ? (coolerPart?.radiatorSizeMm ?? (showcase ? 360 : 240))
      : 0;
  const rad = radiatorSizeMm > 0 ? radiatorFans(radiatorSizeMm) : null;
  const radLength = radiatorSizeMm > 0 ? mm(radiatorSizeMm) : 0;
  const radWidth = rad ? mm(rad.fanSizeMm) + 0.03 : 0;
  const radFanDepth = rad ? mm(25) : 0;

  /* --- Graphics --------------------------------------------------------- */

  const gpuLengthMm = gpuPart?.gpuLengthMm ?? (showcase ? 320 : 300);
  const gpuTdp = gpuPart?.tdp ?? 0;
  // There is no slot-width column on a `BuilderPart`, so thickness comes from
  // the two figures that do exist: long cards and hot cards are thick cards.
  const gpuSlots = gpuLengthMm >= 315 || gpuTdp >= 320 ? 3.2 : gpuLengthMm >= 240 ? 2.6 : 2;

  /* --- Chassis ---------------------------------------------------------- */

  const profileKey = caseProfileKey(casePart, boardFf);
  const profile = CASE_PROFILES[profileKey];
  const shroudHeight = profile.shroud;

  // A small-form-factor chassis has no ceiling to hang a radiator from, so its
  // loop goes on the front intake instead.
  const radMount: RadiatorPlacement["mount"] = profileKey === "itx" ? "front" : "top";
  const topRad = hasCooler && coolerType === "aio" && rad !== null && radMount === "top";
  const frontRad = hasCooler && coolerType === "aio" && rad !== null && radMount === "front";

  // Width is set by whatever stands tallest off the board: a tower cooler's
  // height is measured across the case, which is why it is a width constraint.
  const towerClearance =
    hasCooler && coolerType === "air" ? mm(Math.max(60, coolerHeightMm)) : 0.78;
  let W = Math.max(profile.w, BOARD_PLANE_INSET + towerClearance + SIDE_CLEARANCE);
  if (topRad) W = Math.max(W, radWidth + 0.34);

  // Depth has to clear the graphics card from the rear bracket forward, plus a
  // front radiator if one is fitted, plus the power supply in the basement.
  const psuLengthMm = psuPart?.psuLengthMm ?? 160;
  let D = Math.max(
    profile.d,
    0.14 + mm(Math.max(140, gpuLengthMm)) + 0.42 + (frontRad ? RAD_THICKNESS + 0.3 : 0),
    mm(psuLengthMm) + 0.55,
  );
  if (topRad) D = Math.max(D, radLength + 0.5);

  // A top-mounted radiator eats the gap between the board and the ceiling.
  const topStack = topRad ? RAD_THICKNESS + radFanDepth + 0.12 : 0;
  const topGap = 0.16 + topStack;
  let H = Math.max(profile.h, shroudHeight + 0.08 + layout.height + topGap + 0.04);
  if (frontRad) H = Math.max(H, shroudHeight + radLength + 0.34);

  const halfW = W / 2;
  const halfH = H / 2;
  const halfD = D / 2;

  const expansionSlots = Math.max(1, Math.min(layout.expansionSlots, profile.slots));

  /* --- Board placement -------------------------------------------------- */

  const planeX = halfW - BOARD_PLANE_INSET;
  const topY = halfH - topGap;
  const boardCentreY = topY - layout.height / 2;
  const boardCentreZ = -halfD + 0.1 + layout.depth / 2;

  const rear = rearApertures(W, H, planeX, topY, expansionSlots);

  /** Board-local (bx, by, bz) → case space. The board frame is R_z(+90°). */
  const toCase = (bx: number, by: number, bz: number): [number, number, number] => [
    planeX - by,
    boardCentreY + bx,
    boardCentreZ + bz,
  ];

  /* --- Radiator placement ----------------------------------------------- */

  let radiator: RadiatorPlacement | null = null;
  if (rad && radLength > 0) {
    if (radMount === "top") {
      radiator = {
        mount: "top",
        position: [
          Math.min(
            Math.max(planeX - 0.34, -halfW + radWidth / 2 + 0.06),
            halfW - radWidth / 2 - 0.06,
          ),
          halfH - 0.07 - RAD_THICKNESS / 2,
          Math.max(halfD - 0.26 - radLength / 2, -halfD + radLength / 2 + 0.26),
        ],
        length: radLength,
        width: radWidth,
        thickness: RAD_THICKNESS,
        fans: rad.fans,
        fanSizeMm: rad.fanSizeMm,
      };
    } else {
      radiator = {
        mount: "front",
        position: [
          0,
          Math.min(
            -halfH + shroudHeight + 0.16 + radLength / 2,
            halfH - 0.16 - radLength / 2,
          ),
          halfD - 0.24 - RAD_THICKNESS / 2,
        ],
        length: radLength,
        width: radWidth,
        thickness: RAD_THICKNESS,
        fans: rad.fans,
        fanSizeMm: rad.fanSizeMm,
      };
    }
  }

  // The cold plate meets the top of the CPU's heat spreader: 0.082 above the
  // board in board-local units, which `Cpu` and `Motherboard` agree on.
  const coolerPosition = toCase(layout.socket.x, 0.082, layout.socket.z);

  /* --- Storage ---------------------------------------------------------- */

  const drives: { type: DrivePlacement["type"]; rgb: boolean }[] = driveParts.length
    ? driveParts.map((part) => ({ type: driveType(part), rgb: rgb && part.rgb }))
    : showcase
      ? [
          { type: "m2", rgb },
          { type: "ssd", rgb: false },
        ]
      : [];

  const m2: DrivePlacement[] = [];
  const bays: DrivePlacement[] = [];

  const bayY = -halfH + (shroudHeight > 0.5 ? shroudHeight : 0.04);
  const bayX = Math.min(Math.max(planeX - 0.9, -halfW + 0.52), planeX - 0.4);

  for (const drive of drives) {
    // Boards run out of M.2 slots; the compatibility engine already errors on
    // that, so an extra NVMe drive simply moves to a bay here rather than being
    // drawn floating in mid-air.
    const slot = drive.type === "m2" ? layout.m2[m2.length] : undefined;
    if (slot) {
      m2.push({
        type: "m2",
        position: [slot.x, 0.02, slot.z0 + slot.length / 2],
        length: slot.length,
        rgb: drive.rgb,
      });
      continue;
    }

    const isHdd = drive.type === "hdd";
    bays.push({
      type: isHdd ? "hdd" : "ssd",
      position: [
        bayX,
        bayY + (isHdd ? 0.142 : 0.047),
        halfD - 0.78 - bays.length * (isHdd ? 1.6 : 1.15),
      ],
    });
  }

  /* --- Case fans -------------------------------------------------------- */

  const fanSizeMm = fanSizeFromName(fanParts[0] ?? null);
  const fanSize = mm(fanSizeMm);
  const fanRgb = rgb && (fanParts.some((p) => p.rgb) || (showcase && fanParts.length === 0));

  const requestedFans = fanParts.length
    ? fanParts.length
    : showcase
      ? 4
      : (casePart?.includedFans ?? 0);

  const front: FanSlot[] = [];
  const rearFans: FanSlot[] = [];
  const top: FanSlot[] = [];

  let budget = requestedFans;
  if (budget > 0) {
    rearFans.push({
      position: [rear.fanX, rear.fanY, -halfD + 0.15],
      facing: "rear",
    });
    budget -= 1;
  }

  if (budget > 0 && !frontRad) {
    const span = H - 0.24;
    const count = Math.min(budget, Math.max(0, Math.floor(span / fanSize)), 3);
    for (let i = 0; i < count; i++) {
      front.push({
        position: [0, (i - (count - 1) / 2) * fanSize, halfD - 0.24],
        facing: "front",
      });
    }
    budget -= count;
  }

  if (budget > 0 && !topRad) {
    const span = D - 0.7;
    const count = Math.min(budget, Math.max(0, Math.floor(span / fanSize)), 3);
    for (let i = 0; i < count; i++) {
      top.push({
        position: [
          Math.min(Math.max(planeX - 0.34, -halfW + fanSize / 2 + 0.05), halfW - fanSize / 2 - 0.05),
          halfH - 0.17,
          halfD - 0.42 - i * fanSize,
        ],
        facing: "top",
      });
    }
    budget -= count;
  }

  /* --- Framing ---------------------------------------------------------- */

  // Every chassis is framed to the same height. A full tower and an ITX cube
  // would otherwise need two different cameras, and the builder's preview panel
  // is a fixed box.
  const fit = 4.2 / Math.max(H, D * 0.95, W * 2);

  const interior: [number, number, number][] = [
    [-halfW * 0.45 * fit, halfH * 0.42 * fit, 0.25 * fit],
    [-halfW * 0.4 * fit, 0, -0.35 * fit],
    [-halfW * 0.45 * fit, -halfH * 0.34 * fit, 0.5 * fit],
  ];

  /* --- Assemble --------------------------------------------------------- */

  return {
    shell: {
      width: W,
      height: H,
      depth: D,
      shroudHeight,
      expansionSlots,
      rgb: rgb && (casePart?.rgb ?? showcase),
    },
    glass,
    rgb,

    board: {
      layout,
      present: Boolean(boardPart) || showcase,
      origin: [planeX, boardCentreY, boardCentreZ],
      planeX,
      topY,
      rgb: rgb && (boardPart?.rgb ?? showcase),
    },

    cpu:
      cpuPart || showcase
        ? {
            // AM sockets are 40 mm square; Intel's LGA packages are 45 mm wide.
            sizeMm: (cpuPart?.socket?.startsWith("AM") ?? true) ? 40 : 45,
          }
        : null,

    ram:
      ramPart || showcase
        ? {
            count: ramPart?.moduleCount ?? (showcase ? 4 : 2),
            // RGB kits carry a diffuser bar and stand noticeably taller than a
            // plain heat-spreader kit.
            heightMm: (ramPart?.rgb ?? showcase) ? 48 : 40,
            rgb: rgb && (ramPart?.rgb ?? showcase),
          }
        : null,

    gpu:
      gpuPart || showcase
        ? {
            lengthMm: Math.max(140, gpuLengthMm),
            slots: gpuSlots,
            rgb: rgb && (gpuPart?.rgb ?? showcase),
          }
        : null,

    cooler: hasCooler
      ? {
          type: coolerType,
          heightMm: coolerHeightMm,
          position: coolerPosition,
          radiator,
          rgb: rgb && (coolerPart?.rgb ?? showcase),
        }
      : null,

    psu:
      psuPart || showcase
        ? {
            lengthMm: psuLengthMm,
            formFactor: psuPart?.psuFormFactor ?? "ATX",
            fanDown: shroudHeight > 0.5,
            position: [
              rear.psuX,
              // Bottom-aligned with the rear cut-out, so an SFX unit sits on
              // the floor of the window rather than floating in the middle.
              rear.psuY - 0.43 + mm(psuPart?.psuFormFactor?.startsWith("SFX") ? 63.5 : 86) / 2,
              -halfD + 0.07 + mm(psuLengthMm) / 2,
            ],
            rgb: rgb && (psuPart?.rgb ?? showcase),
          }
        : null,

    m2,
    bays,

    fans: { sizeMm: fanSizeMm, rgb: fanRgb, front, rear: rearFans, top },

    fit,
    floorY: (-halfH - 0.05) * fit,
    shadowScale: Math.max(W, D) * 2.6 * fit,
    interior,

    keys: {
      chassis: casePart?.id ?? "",
      board: boardPart?.id ?? "",
      cpu: cpuPart?.id ?? "",
      gpu: gpuPart?.id ?? "",
      ram: ramPart?.id ?? "",
      cooler: coolerPart?.id ?? "",
      psu: psuPart?.id ?? "",
      storage: driveParts.map((p) => p.id).join("|"),
      fans: fanParts.map((p) => p.id).join("|"),
    },
  };
}

/* ========================================================================== */
/* Explode staging                                                            */
/* ========================================================================== */

type SlotId =
  | "gpu"
  | "board"
  | "ram"
  | "m2"
  | "cpu"
  | "cooler"
  | "psu"
  | "bays"
  | "fansFront"
  | "fansRear"
  | "fansTop";

type SlotDef = {
  id: SlotId;
  /** Which phase window in `EXPLODE_PHASES` moves this group. */
  phase: string;
  /** Which part identity, when it changes, makes this group slide back in. */
  key: KeyId;
  /**
   * Travel when fully exploded, in the group's OWN parent frame — board-local
   * for anything mounted on the board, case space for the rest.
   */
  offset: [number, number, number];
};

/**
 * Travel is deliberately fanned out across different axes rather than pushed
 * along one.
 *
 * The board-mounted parts are CHILDREN of the board group, so their travel adds
 * to the board's: sending both toward the glass would separate them by the
 * difference of two similar numbers and the whole assembly would just slide
 * sideways in a lump. Instead the board goes out, the memory goes up, the card
 * goes down and forward, and the cooling loop lifts — so at full progress every
 * part sits in clear air with a readable gap around it.
 */
const SLOT_DEFS: SlotDef[] = [
  // Board-local: +X is up the case, +Y is out toward the glass, +Z is forward.
  { id: "gpu", phase: "gpu", key: "gpu", offset: [-1.1, 1.9, 0.7] },
  { id: "ram", phase: "ram", key: "ram", offset: [1.5, 0.9, 0] },
  { id: "m2", phase: "ram", key: "storage", offset: [-0.4, 1.3, 1.0] },
  { id: "cpu", phase: "cpu", key: "cpu", offset: [0.4, 1.2, -0.5] },
  // Case space.
  { id: "board", phase: "board", key: "board", offset: [-2.2, 0, 0] },
  // The pump and its radiator are one rigid loop joined by tubes, so the whole
  // thing lifts rather than the block travelling out on its own.
  { id: "cooler", phase: "cooler", key: "cooler", offset: [-1.7, 1.35, 0] },
  { id: "psu", phase: "power", key: "psu", offset: [0.5, -1.15, -2.1] },
  { id: "bays", phase: "power", key: "storage", offset: [-2.2, -0.7, 1.5] },
  { id: "fansFront", phase: "power", key: "fans", offset: [0, 0, 2.5] },
  { id: "fansRear", phase: "power", key: "fans", offset: [0.3, 0, -2.1] },
  { id: "fansTop", phase: "power", key: "fans", offset: [0, 1.8, 0] },
];

const PHASE_RANGE = new Map(EXPLODE_PHASES.map((phase) => [phase.id, phase.range]));

const SLOTS: (SlotDef & { range: [number, number] })[] = SLOT_DEFS.map((slot) => ({
  ...slot,
  range: PHASE_RANGE.get(slot.phase) ?? [0, 1],
}));

const SHELL_PHASE: [number, number] = PHASE_RANGE.get("shell") ?? [0, 0.18];

/** How far along its explode path a newly added part starts. */
const ENTRY_TRAVEL = 0.6;

function zeroed(): Record<SlotId, number> {
  const out = {} as Record<SlotId, number>;
  for (const slot of SLOT_DEFS) out[slot.id] = 0;
  return out;
}

function emptied(): Record<SlotId, string> {
  const out = {} as Record<SlotId, string>;
  for (const slot of SLOT_DEFS) out[slot.id] = "";
  return out;
}

/* ========================================================================== */
/* Renderer                                                                   */
/* ========================================================================== */

export type ExplodedPCProps = {
  spec: MachineSpec;
  /** 0 assembled → 1 fully exploded. Read per frame, never a React prop. */
  progressRef: React.RefObject<number>;
  /** Rotor revolutions per second. 0 freezes every fan. */
  spin?: number;
  /** Slide a part in along its explode path the first time it appears. */
  animateEntry?: boolean;
};

export function ExplodedPC({
  spec,
  progressRef,
  spin = 0.5,
  animateEntry = false,
}: ExplodedPCProps) {
  const invalidate = useThree((state) => state.invalidate);

  const groups = React.useRef<Partial<Record<SlotId, THREE.Group | null>>>({});
  const entry = React.useRef<Record<SlotId, number>>(zeroed());
  const seen = React.useRef<Record<SlotId, string>>(emptied());

  // Stable callback refs — a fresh closure per render would detach and
  // reattach every group on every state change.
  const setRef = React.useMemo(() => {
    const out = {} as Record<SlotId, (node: THREE.Group | null) => void>;
    for (const slot of SLOT_DEFS) {
      out[slot.id] = (node) => {
        groups.current[slot.id] = node;
      };
    }
    return out;
  }, []);

  const { keys } = spec;

  React.useEffect(() => {
    for (const slot of SLOT_DEFS) {
      const key = keys[slot.key];
      if (animateEntry && key && key !== seen.current[slot.id]) {
        entry.current[slot.id] = 1;
      }
      seen.current[slot.id] = key;
    }
    invalidate();
  }, [keys, animateEntry, invalidate]);

  useFrame((_state, dt) => {
    const progress = clamp01(progressRef.current);
    let moving = false;

    for (const slot of SLOTS) {
      const node = groups.current[slot.id];
      if (!node) continue;

      // Explode travel and entry travel share a path, so a part that is added
      // mid-explode slides in along the line it would have come out on.
      const travel =
        smoothstep(slot.range[0], slot.range[1], progress) +
        entry.current[slot.id] * ENTRY_TRAVEL;

      const delta = dampVec3(
        node.position,
        slot.offset[0] * travel,
        slot.offset[1] * travel,
        slot.offset[2] * travel,
        3.4,
        dt,
      );
      if (delta > 5e-4) moving = true;
    }

    for (const slot of SLOT_DEFS) {
      const value = entry.current[slot.id];
      if (value > 1e-3) {
        entry.current[slot.id] = damp(value, 0, 2.6, dt);
        moving = true;
      } else if (value !== 0) {
        entry.current[slot.id] = 0;
      }
    }

    // Keeps a `frameloop="demand"` canvas alive exactly while something moves.
    if (moving) invalidate();
  });

  const { board, fans } = spec;
  const { layout } = board;
  const { dimm, pcie, socket } = layout;

  return (
    <group scale={spec.fit}>
      <Case
        width={spec.shell.width}
        height={spec.shell.height}
        depth={spec.shell.depth}
        boardPlaneX={board.planeX}
        boardTopY={board.topY}
        shroudHeight={spec.shell.shroudHeight}
        glass={spec.glass}
        rgb={spec.shell.rgb}
        expansionSlots={spec.shell.expansionSlots}
        progressRef={progressRef}
        shellPhase={SHELL_PHASE}
      />

      {/* --- Everything mounted on the motherboard --------------------- */}
      <group ref={setRef.board}>
        <group position={board.origin} rotation={[0, 0, Math.PI / 2]}>
          {board.present && (
            <Motherboard
              layout={layout}
              rgb={board.rgb}
              occupiedM2={spec.m2.length}
            />
          )}

          <group ref={setRef.cpu}>
            {spec.cpu && (
              <group position={[socket.x, 0, socket.z]}>
                <Cpu sizeMm={spec.cpu.sizeMm} />
              </group>
            )}
          </group>

          <group ref={setRef.ram}>
            {spec.ram && (
              <group position={[dimm.x, 0, dimm.z0]}>
                <RamSticks
                  count={spec.ram.count}
                  slots={dimm.slots}
                  pitch={dimm.pitch}
                  length={dimm.length}
                  heightMm={spec.ram.heightMm}
                  rgb={spec.ram.rgb}
                />
              </group>
            )}
          </group>

          <group ref={setRef.gpu}>
            {spec.gpu && (
              // Seated on the x16 slot: the card's own origin is the rear end
              // of the slot, at the height its gold fingers bottom out.
              <group position={[pcie.x, 0.055, pcie.z0]}>
                <Gpu
                  lengthMm={spec.gpu.lengthMm}
                  slots={spec.gpu.slots}
                  rgb={spec.gpu.rgb}
                  spin={spin}
                />
              </group>
            )}
          </group>

          <group ref={setRef.m2}>
            {spec.m2.length > 0 && <Storage drives={spec.m2} />}
          </group>
        </group>
      </group>

      {/* --- Chassis-mounted hardware ---------------------------------- */}
      <group ref={setRef.cooler}>
        {spec.cooler && (
          <Cooler
            type={spec.cooler.type}
            position={spec.cooler.position}
            heightMm={spec.cooler.heightMm}
            radiator={spec.cooler.radiator}
            rgb={spec.cooler.rgb}
            spin={spin}
          />
        )}
      </group>

      <group ref={setRef.psu}>
        {spec.psu && (
          <group position={spec.psu.position}>
            <Psu
              lengthMm={spec.psu.lengthMm}
              formFactor={spec.psu.formFactor}
              fanDown={spec.psu.fanDown}
              rgb={spec.psu.rgb}
              spin={spin * 0.7}
            />
          </group>
        )}
      </group>

      <group ref={setRef.bays}>
        {spec.bays.length > 0 && <Storage drives={spec.bays} />}
      </group>

      <group ref={setRef.fansFront}>
        {fans.front.length > 0 && (
          <Fans slots={fans.front} sizeMm={fans.sizeMm} rgb={fans.rgb} spin={spin} />
        )}
      </group>
      <group ref={setRef.fansRear}>
        {fans.rear.length > 0 && (
          <Fans slots={fans.rear} sizeMm={fans.sizeMm} rgb={fans.rgb} spin={spin} />
        )}
      </group>
      <group ref={setRef.fansTop}>
        {fans.top.length > 0 && (
          <Fans slots={fans.top} sizeMm={fans.sizeMm} rgb={fans.rgb} spin={spin} />
        )}
      </group>
    </group>
  );
}

export default ExplodedPC;
