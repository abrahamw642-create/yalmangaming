"use client";

/**
 * Graphics card. Board-local frame (see Motherboard.tsx), origin at the top of
 * the PCIe x16 slot, at the slot's rear end.
 *
 * Extents:  X = card thickness (its slot height — vertical in the case)
 *           Y = how far the card reaches off the board, toward the glass
 *           Z = card length, front to back
 *
 * Which means the two broad faces end up horizontal in the tower: fans point at
 * the floor, backplate at the ceiling, and what you actually see through the
 * side panel is the card's long thin edge. That is why the accent strip lives
 * on the +Y face and the power connector stands up off the backplate.
 *
 * Length comes from `gpuLengthMm` on the real part, so a 240 mm card and a
 * 358 mm card are visibly different objects — which is the whole point of
 * drawing the build rather than a stock render.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  detail,
  mm,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";
import { rotorGeometry } from "./Fans";

export type GpuProps = {
  /** Real card length. Drives fan count and everything downstream. */
  lengthMm: number;
  /** Slot thickness: 2, 2.5 or 3. */
  slots?: number;
  /** Reach off the motherboard. Defaults from the length. */
  spanMm?: number;
  rgb?: boolean;
  /** Rotor revolutions per second; 0 freezes them. */
  spin?: number;
};

export function Gpu({
  lengthMm,
  slots = 2.5,
  spanMm,
  rgb = false,
  spin = 0.4,
}: GpuProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const rotors = React.useRef<(THREE.Mesh | null)[]>([]);

  const length = mm(Math.max(140, lengthMm));
  const thick = mm(Math.max(1.5, Math.min(4, slots)) * 20.32);
  // Taller cards are also longer in practice; clamp to plausible board heights.
  const span = mm(
    spanMm ?? THREE.MathUtils.clamp(105 + (lengthMm - 200) * 0.13, 100, 148),
  );

  const bodyZ0 = -0.1;
  const bodyLen = length - 0.03;
  const bodyMidZ = bodyZ0 + bodyLen / 2;

  const fanCount = lengthMm >= 300 ? 3 : lengthMm >= 215 ? 2 : 1;
  const fanR = Math.min(span * 0.44, (bodyLen / fanCount) * 0.46);
  const bevel = detail(quality, 3, 1);

  const geo = useDisposableSet(
    () => ({
      pcb: new THREE.BoxGeometry(0.016, span * 0.72, bodyLen * 0.94),
      shroud: roundedBoxGeometry(thick - 0.02, span - 0.05, bodyLen, 0.025, bevel),
      backplate: roundedBoxGeometry(0.01, span * 0.86, bodyLen - 0.05, 0.012, 1),
      bracket: new THREE.BoxGeometry(thick + 0.01, 1.2, 0.012),
      port: new THREE.BoxGeometry(thick * 0.55, 0.17, 0.02),
      fingers: new THREE.BoxGeometry(0.014, 0.07, 0.86),
      strip: new THREE.BoxGeometry(thick * 0.44, 0.014, bodyLen * 0.5),
      power: roundedBoxGeometry(0.05, 0.075, 0.24, 0.008, 1),
      rotor: rotorGeometry(fanR * 0.92, detail(quality, 11, 7), 0.03, quality),
      fanRing: new THREE.TorusGeometry(fanR, 0.012, 5, detail(quality, 18, 9)),
      hubCap: new THREE.CylinderGeometry(fanR * 0.3, fanR * 0.3, 0.012, detail(quality, 14, 7)),
    }),
    [span, thick, bodyLen, fanR, bevel, quality],
  );

  useFrame((_state, dt) => {
    if (spin <= 0) return;
    const step = spin * Math.PI * 2 * dt;
    for (const rotor of rotors.current) {
      if (rotor) rotor.rotation.z += step;
    }
  });

  const fanZ = (i: number) =>
    bodyZ0 + (bodyLen / fanCount) * (i + 0.5);

  return (
    <group>
      {/* Gold fingers seated in the slot. */}
      <mesh geometry={geo.fingers} material={mats.gold} position={[0, -0.02, 0.44]} />

      {/* PCB and its cooler. */}
      <mesh
        geometry={geo.pcb}
        material={mats.pcb}
        position={[0, span * 0.36 + 0.02, bodyMidZ]}
      />
      <mesh
        geometry={geo.shroud}
        material={mats.plastic}
        position={[-thick / 2 - 0.006, span / 2 + 0.02, bodyMidZ]}
      />
      <mesh
        geometry={geo.backplate}
        material={mats.aluminiumDark}
        position={[0.014, span * 0.45, bodyMidZ]}
      />

      {/* Accent strip on the edge that faces the glass. */}
      <mesh
        geometry={geo.strip}
        material={rgb ? mats.rgb[1] : mats.accent}
        position={[-thick / 2 - 0.006, span - 0.035, bodyMidZ]}
      />

      {/* PCIe power, standing proud of the backplate so cables read upward. */}
      <mesh
        geometry={geo.power}
        material={mats.plastic}
        position={[0.045, span * 0.78, bodyMidZ + bodyLen * 0.12]}
      />

      {/* Display outputs on the rear bracket. */}
      <mesh
        geometry={geo.bracket}
        material={mats.chassisEdge}
        position={[-thick / 2 + 0.01, 0.56, bodyZ0 - 0.02]}
      />
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={geo.port}
          material={mats.rubber}
          position={[-thick / 2 + 0.01, 0.24 + i * 0.24, bodyZ0 - 0.03]}
        />
      ))}

      {/* Fans, facing the case floor. */}
      {Array.from({ length: fanCount }, (_, i) => (
        <group
          key={i}
          position={[-thick + 0.02, span * 0.5, fanZ(i)]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <mesh geometry={geo.fanRing} material={mats.plastic} />
          <mesh
            ref={(node) => {
              rotors.current[i] = node;
            }}
            geometry={geo.rotor}
            material={mats.blade}
            position={[0, 0, -0.012]}
          />
          <mesh
            geometry={geo.hubCap}
            material={mats.chassisEdge}
            position={[0, 0, 0.004]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      ))}
    </group>
  );
}

export default Gpu;
