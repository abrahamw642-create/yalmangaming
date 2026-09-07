"use client";

/**
 * The processor itself: substrate, integrated heat spreader and the retention
 * frame's corner tabs. Board-local frame, origin at the centre of the socket on
 * the board surface (see Motherboard.tsx).
 *
 * Deliberately small and quiet — in an assembled machine the CPU is invisible
 * under the cooler, and it only earns screen time during the exploded sequence.
 * The IHS uses the chrome material because a nickel-plated lid is the shiniest
 * thing inside a PC and it makes the part instantly readable at any distance.
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

export type CpuProps = {
  /** Package edge length. LGA1700 is 45×37.5 mm, AM5 is 40×40. */
  sizeMm?: number;
  /** Seat height above the board — matches Motherboard's socket base. */
  seatY?: number;
};

export function Cpu({ sizeMm = 40, seatY = 0.038 }: CpuProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const bevel = detail(quality, 3, 1);

  const size = mm(sizeMm);

  const geo = useDisposableSet(
    () => ({
      substrate: new THREE.BoxGeometry(size, 0.014, size),
      ihs: roundedBoxGeometry(size * 0.82, 0.03, size * 0.82, 0.018, bevel),
      tab: roundedBoxGeometry(size * 0.16, 0.016, size * 0.1, 0.006, 1),
      notch: new THREE.BoxGeometry(size * 0.1, 0.016, size * 0.02),
    }),
    [size, bevel],
  );

  const half = size * 0.41;

  return (
    <group position={[0, seatY, 0]}>
      <mesh geometry={geo.substrate} material={mats.pcbLight} position={[0, 0.007, 0]} />
      <mesh geometry={geo.ihs} material={mats.chrome} position={[0, 0.029, 0]} />
      {/* Orientation notches on the IHS — the small asymmetry that stops the
          lid reading as a plain cube. */}
      {(
        [
          [half, 0.5],
          [-half, 0.5],
        ] as const
      ).map(([x, z], i) => (
        <mesh
          key={i}
          geometry={geo.tab}
          material={mats.chrome}
          position={[x, 0.029, z * size * 0.5]}
        />
      ))}
      <mesh
        geometry={geo.notch}
        material={mats.pcbLight}
        position={[0, 0.045, -size * 0.3]}
      />
    </group>
  );
}

export default Cpu;
