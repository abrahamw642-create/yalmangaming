"use client";

/**
 * Memory modules. Board-local frame, origin at the centre of the first DIMM
 * slot on the board surface (see Motherboard.tsx).
 *
 * Extents:  X = module length (133 mm, vertical once the board is installed)
 *           Y = how far it stands off the board
 *           Z = slot pitch direction, front to back
 *
 * The slots themselves belong to the motherboard; this part only draws what the
 * customer actually chose, so a 2×16 GB kit fills two of four slots and a 4×16
 * kit fills all of them. Population order matches how the parts are actually
 * fitted on the bench: the second and fourth slots first, for dual channel.
 */

import * as THREE from "three";
import {
  detail,
  mm,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";

export type RamSticksProps = {
  /** Modules in the kit. */
  count: number;
  /** Slots the board actually has. */
  slots: number;
  /** Distance between slot centres, scene units. */
  pitch: number;
  /** Module length, scene units. */
  length: number;
  rgb?: boolean;
  /** Total module height including the heat spreader, mm. */
  heightMm?: number;
};

/**
 * Which slots a kit goes in. Two modules on a four-slot board go in slots 2 and
 * 4 for dual channel — the same advice the builder gives in text.
 */
export function populatedSlots(slots: number, count: number): number[] {
  const n = Math.max(0, Math.min(slots, count));
  if (n === 0) return [];
  if (slots >= 4 && n === 2) return [1, 3];
  if (slots >= 4 && n === 1) return [1];
  if (slots >= 4 && n === 3) return [1, 2, 3];
  return Array.from({ length: n }, (_, i) => i);
}

export function RamSticks({
  count,
  slots,
  pitch,
  length,
  rgb = false,
  heightMm = 44,
}: RamSticksProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const bevel = detail(quality, 2, 1);

  const height = mm(heightMm);
  const seat = 0.055; // top face of the DIMM slot, per Motherboard.tsx
  const filled = populatedSlots(slots, count);

  const geo = useDisposableSet(
    () => ({
      pcb: new THREE.BoxGeometry(length, height * 0.72, 0.014),
      spreader: roundedBoxGeometry(length, height * 0.78, 0.038, 0.012, bevel),
      diffuser: roundedBoxGeometry(length * 0.94, height * 0.16, 0.03, 0.012, bevel),
      contacts: new THREE.BoxGeometry(length * 0.9, 0.05, 0.016),
    }),
    [length, height, bevel],
  );

  return (
    <group>
      {filled.map((slot, i) => {
        const z = slot * pitch;
        return (
          <group key={slot} position={[0, seat, z]}>
            <mesh geometry={geo.contacts} material={mats.gold} position={[0, -0.03, 0]} />
            <mesh
              geometry={geo.pcb}
              material={mats.pcb}
              position={[0, height * 0.36, 0]}
            />
            <mesh
              geometry={geo.spreader}
              material={mats.aluminiumDark}
              position={[0, height * 0.39, 0]}
            />
            {/* The lit bar along the top edge — the part you actually see
                through the side panel once the machine is closed up. */}
            <mesh
              geometry={geo.diffuser}
              material={rgb ? mats.rgb[i % mats.rgb.length] : mats.label}
              position={[0, height * 0.86, 0]}
            />
          </group>
        );
      })}
    </group>
  );
}

export default RamSticks;
