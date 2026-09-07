"use client";

/**
 * Motherboard, modelled in its natural "on the bench" frame and rotated into
 * the tower by the caller (`rotation={[0, 0, Math.PI / 2]}`).
 *
 * Board-local axes — every board-mounted part in this folder uses them:
 *      +X  toward the case ceiling   (the board's long, 305 mm ATX dimension)
 *      +Y  out of the board, toward the glass
 *      +Z  toward the front of the case (the 244 mm ATX dimension)
 *
 * The dimensions are the real ones. An ATX board's rear edge is 305 mm because
 * that edge carries the 159 mm I/O window plus seven 20.32 mm expansion slots —
 * 301 mm of hardware. Micro-ATX drops three of those slots and lands at 244 mm,
 * which is exactly the published 305→244 difference. The layout below is driven
 * from that fact rather than from eyeballing a photo.
 */

import * as React from "react";
import * as THREE from "three";
import { Instance, Instances } from "@react-three/drei";
import {
  detail,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";

export type BoardFormFactor = "E-ATX" | "ATX" | "Micro-ATX" | "Mini-ITX";

export type BoardLayout = {
  formFactor: BoardFormFactor;
  /** Local X extent — vertical once installed. */
  height: number;
  /** Local Z extent — front-to-back once installed. */
  depth: number;
  socket: { x: number; z: number; size: number };
  dimm: { x: number; z0: number; pitch: number; slots: number; length: number };
  pcie: { x: number; z0: number; length: number; extra: number[] };
  m2: { x: number; z0: number; length: number }[];
  /** Expansion slots this board occupies on the rear panel. */
  expansionSlots: number;
};

const BOARD_DIMENSIONS: Record<BoardFormFactor, [height: number, depth: number]> = {
  "E-ATX": [3.05, 3.3],
  ATX: [3.05, 2.44],
  "Micro-ATX": [2.44, 2.44],
  "Mini-ITX": [1.7, 1.7],
};

const EXPANSION_SLOTS: Record<BoardFormFactor, number> = {
  "E-ATX": 7,
  ATX: 7,
  "Micro-ATX": 4,
  "Mini-ITX": 1,
};

export function normaliseFormFactor(value: string | null | undefined): BoardFormFactor {
  switch (value) {
    case "E-ATX":
    case "ATX":
    case "Micro-ATX":
    case "Mini-ITX":
      return value;
    default:
      return "ATX";
  }
}

/**
 * Positions of everything socketed on the board. Exported because the CPU, RAM,
 * cooler, GPU and M.2 drives are separate parts that have to land in the same
 * places — deriving them twice is how a card ends up floating beside its slot.
 */
export function boardLayout(
  formFactor: string | null | undefined,
  memorySlots?: number | null,
): BoardLayout {
  const ff = normaliseFormFactor(formFactor);
  const [height, depth] = BOARD_DIMENSIONS[ff];
  const halfH = height / 2;
  const halfD = depth / 2;

  // The socket sits ~92 mm down from the top edge and ~92 mm in from the rear
  // edge on a full ATX board; on smaller boards it simply gets closer to centre.
  const socketX = Math.max(-halfH + 0.5, halfH - 0.92);
  const socketZ = Math.min(halfD - 0.5, -halfD + 0.92);

  const slots =
    memorySlots && memorySlots > 0
      ? Math.min(4, Math.max(2, memorySlots))
      : ff === "Mini-ITX"
        ? 2
        : 4;
  const pitch = 0.11;

  // Memory sits forward of the socket, running parallel to the rear edge, which
  // is why sticks stand upright in a tower.
  const dimmZ0 = Math.min(socketZ + 0.55, halfD - 0.12 - (slots - 1) * pitch);
  const dimmX = Math.min(socketX + 0.06, halfH - 0.72);

  const pcieX = socketX - 0.7;
  const pcieZ0 = -halfD + 0.12;
  const extra: number[] = [];
  for (const step of [0.41, 0.82, 1.23]) {
    const x = pcieX - step;
    if (x > -halfH + 0.1) extra.push(x);
  }

  const m2Candidates = [
    { x: socketX - 0.38, z0: -halfD + 0.17, length: 0.8 },
    { x: pcieX - 0.21, z0: -halfD + 0.17, length: 0.8 },
    { x: pcieX - 0.62, z0: -halfD + 0.17, length: 0.8 },
  ];
  const m2 = m2Candidates.filter(
    (slot) => slot.x - 0.12 > -halfH && slot.z0 + slot.length < halfD,
  );

  return {
    formFactor: ff,
    height,
    depth,
    socket: { x: socketX, z: socketZ, size: 0.45 },
    dimm: { x: dimmX, z0: dimmZ0, pitch, slots, length: 1.33 },
    pcie: { x: pcieX, z0: pcieZ0, length: 0.89, extra },
    m2,
    expansionSlots: EXPANSION_SLOTS[ff],
  };
}

export type MotherboardProps = {
  layout: BoardLayout;
  rgb?: boolean;
  /**
   * How many M.2 slots have a drive fitted, counting from the first.
   *
   * Their heatshields are left off, because a shield is opaque and a customer
   * who has just chosen an NVMe drive needs to see it land in the machine. The
   * drive carries its own heatspreader, so the board still looks finished.
   */
  occupiedM2?: number;
};

export function Motherboard({ layout, rgb = true, occupiedM2 = 0 }: MotherboardProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const bevel = detail(quality, 2, 1);
  const radial = detail(quality, 10, 5);

  const { height: H, depth: D, socket, dimm, pcie, m2 } = layout;
  const halfH = H / 2;
  const halfD = D / 2;

  const geo = useDisposableSet(
    () => ({
      pcb: roundedBoxGeometry(H, 0.017, D, 0.02, bevel),
      ioShroud: roundedBoxGeometry(0.62, 0.24, 0.5, 0.03, bevel),
      ioStrip: new THREE.BoxGeometry(0.5, 0.012, 0.03),
      vrmTop: roundedBoxGeometry(0.2, 0.16, 0.72, 0.02, bevel),
      vrmSide: roundedBoxGeometry(0.62, 0.14, 0.18, 0.02, bevel),
      chipset: roundedBoxGeometry(0.56, 0.09, 0.56, 0.03, bevel),
      m2Shield: roundedBoxGeometry(0.22, 0.038, 0.86, 0.012, bevel),
      dimmSlot: roundedBoxGeometry(dimm.length + 0.02, 0.055, 0.062, 0.008, 1),
      dimmLatch: new THREE.BoxGeometry(0.05, 0.075, 0.05),
      pcieSlot: roundedBoxGeometry(0.062, 0.05, pcie.length, 0.01, 1),
      pcieShield: roundedBoxGeometry(0.075, 0.062, pcie.length + 0.03, 0.012, 1),
      socketBase: roundedBoxGeometry(socket.size + 0.12, 0.03, socket.size + 0.12, 0.01, 1),
      socketFrame: new THREE.BoxGeometry(socket.size + 0.14, 0.05, 0.035),
      atx24: roundedBoxGeometry(0.1, 0.12, 0.58, 0.012, 1),
      eps8: roundedBoxGeometry(0.09, 0.11, 0.2, 0.012, 1),
      choke: new THREE.BoxGeometry(0.05, 0.05, 0.05),
      cap: new THREE.CylinderGeometry(0.026, 0.026, 0.075, radial),
      header: new THREE.BoxGeometry(0.05, 0.045, 0.16),
    }),
    [H, D, dimm.length, pcie.length, socket.size, bevel, radial],
  );

  // VRM chokes flanking the socket, and a bank of capacitors below it. Small
  // repeated hardware is what stops a board reading as a flat green rectangle.
  const chokes = React.useMemo(() => {
    const out: [number, number, number][] = [];
    const rows = detail(quality, 8, 5);
    for (let i = 0; i < rows; i++) {
      out.push([socket.x + 0.42, 0.025, -halfD + 0.62 + i * 0.075]);
    }
    for (let i = 0; i < Math.min(4, rows); i++) {
      out.push([socket.x - 0.02 - i * 0.075, 0.025, socket.z - 0.42]);
    }
    return out;
  }, [socket.x, socket.z, halfD, quality]);

  const caps = React.useMemo(() => {
    const out: [number, number, number][] = [];
    const rows = detail(quality, 6, 3);
    for (let i = 0; i < rows; i++) {
      out.push([socket.x - 0.34, 0.046, socket.z + 0.12 + i * 0.07]);
    }
    return out;
  }, [socket.x, socket.z, quality]);

  const slotZ = (i: number) => dimm.z0 + i * dimm.pitch;

  return (
    <group>
      {/* PCB */}
      <mesh geometry={geo.pcb} material={mats.pcb} />

      {/* Rear I/O shroud, with the board's own accent strip along its face. */}
      <mesh
        geometry={geo.ioShroud}
        material={mats.plastic}
        position={[halfH - 0.34, 0.12, -halfD + 0.26]}
      />
      <mesh
        geometry={geo.ioStrip}
        material={rgb ? mats.rgb[2] : mats.accent}
        position={[halfH - 0.34, 0.245, -halfD + 0.02]}
      />

      {/* VRM heatsinks: one along the top edge, one on the rear edge. */}
      <mesh
        geometry={geo.vrmTop}
        material={mats.aluminiumDark}
        position={[halfH - 0.14, 0.088, socket.z + 0.05]}
      />
      <mesh
        geometry={geo.vrmSide}
        material={mats.aluminiumDark}
        position={[socket.x + 0.02, 0.078, -halfD + 0.62]}
      />

      {/* Chipset heatsink */}
      <mesh
        geometry={geo.chipset}
        material={mats.aluminiumDark}
        position={[
          Math.max(-halfH + 0.36, pcie.x - 0.55),
          0.053,
          Math.min(halfD - 0.4, 0.12),
        ]}
      />

      {/* M.2 heatshields, minus the ones a drive is sitting in. */}
      {m2.map((slot, i) =>
        i < occupiedM2 ? null : (
          <mesh
            key={i}
            geometry={geo.m2Shield}
            material={mats.aluminiumDark}
            position={[slot.x, 0.028, slot.z0 + slot.length / 2]}
          />
        ),
      )}

      {/* CPU socket: retention frame around a bare land grid. */}
      <mesh
        geometry={geo.socketBase}
        material={mats.plastic}
        position={[socket.x, 0.023, socket.z]}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={geo.socketFrame}
          material={mats.chrome}
          position={[socket.x, 0.04, socket.z + (side * (socket.size + 0.1)) / 2]}
        />
      ))}

      {/* DIMM slots — the modules themselves are a separate part. */}
      <Instances
        limit={dimm.slots}
        range={dimm.slots}
        geometry={geo.dimmSlot}
        material={mats.plastic}
      >
        {Array.from({ length: dimm.slots }, (_, i) => (
          <Instance key={i} position={[dimm.x, 0.036, slotZ(i)]} />
        ))}
      </Instances>
      <Instances
        limit={dimm.slots * 2}
        range={dimm.slots * 2}
        geometry={geo.dimmLatch}
        material={mats.chassisEdge}
      >
        {Array.from({ length: dimm.slots }, (_, i) => [
          <Instance
            key={`a${i}`}
            position={[dimm.x + dimm.length / 2 + 0.03, 0.046, slotZ(i)]}
          />,
          <Instance
            key={`b${i}`}
            position={[dimm.x - dimm.length / 2 - 0.03, 0.046, slotZ(i)]}
          />,
        ])}
      </Instances>

      {/* PCIe: a reinforced x16 for the graphics card, plainer slots below. */}
      <mesh
        geometry={geo.pcieShield}
        material={mats.chrome}
        position={[pcie.x, 0.035, pcie.z0 + pcie.length / 2]}
      />
      <mesh
        geometry={geo.pcieSlot}
        material={mats.gold}
        position={[pcie.x, 0.05, pcie.z0 + pcie.length / 2]}
      />
      {pcie.extra.map((x, i) => (
        <mesh
          key={i}
          geometry={geo.pcieSlot}
          material={mats.plastic}
          position={[x, 0.03, pcie.z0 + pcie.length / 2 - 0.18]}
        />
      ))}

      {/* Power connectors */}
      <mesh
        geometry={geo.atx24}
        material={mats.plastic}
        position={[Math.max(-halfH + 0.4, halfH - 0.9), 0.068, halfD - 0.12]}
      />
      <mesh
        geometry={geo.eps8}
        material={mats.plastic}
        position={[halfH - 0.12, 0.063, socket.z + 0.55]}
      />

      {/* Front-panel and fan headers along the front and bottom edges. */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={geo.header}
          material={mats.plastic}
          position={[-halfH + 0.14, 0.03, -halfD + 0.5 + i * 0.42]}
        />
      ))}

      <Instances
        limit={chokes.length}
        range={chokes.length}
        geometry={geo.choke}
        material={mats.aluminiumDark}
      >
        {chokes.map((position, i) => (
          <Instance key={i} position={position} />
        ))}
      </Instances>
      <Instances
        limit={caps.length}
        range={caps.length}
        geometry={geo.cap}
        material={mats.chassisEdge}
      >
        {caps.map((position, i) => (
          <Instance key={i} position={position} />
        ))}
      </Instances>
    </group>
  );
}

export default Motherboard;
