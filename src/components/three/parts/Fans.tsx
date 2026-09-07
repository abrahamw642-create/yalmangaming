"use client";

/**
 * Case fans, plus the rotor builder the GPU and the CPU cooler reuse.
 *
 * A fan is three pieces: a frame with a real circular aperture, a rotor merged
 * into a single geometry (hub + pitched blades), and — when the part is an RGB
 * part — a diffuser ring. Merging the blades matters: seven separate blade
 * meshes per fan across six fans is 42 draw calls for something you barely see.
 */

import * as React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import {
  type Quality,
  detail,
  mm,
  platedGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";

/** Which way a fan's intake face points, in case space. */
export type FanFacing = "front" | "rear" | "top" | "side";

export type FanSlot = {
  position: [number, number, number];
  facing: FanFacing;
};

export const FACING_ROTATION: Record<FanFacing, [number, number, number]> = {
  front: [0, 0, 0],
  rear: [0, Math.PI, 0],
  top: [-Math.PI / 2, 0, 0],
  side: [0, -Math.PI / 2, 0],
};

/**
 * A fan rotor whose axis is +Z, centred on its own origin.
 *
 * Blades are boxes pitched about their radial axis and swept around the hub,
 * which is enough to catch a highlight and read as a fan at any speed. The
 * caller owns the returned geometry and must dispose it.
 */
export function rotorGeometry(
  radius: number,
  bladeCount: number,
  thickness: number,
  quality: Quality,
): THREE.BufferGeometry {
  const radial = detail(quality, 14, 7);
  const hubR = radius * 0.3;

  const parts: THREE.BufferGeometry[] = [];

  const hub = new THREE.CylinderGeometry(hubR, hubR * 0.94, thickness, radial);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);

  const bladeLength = radius * 0.95 - hubR;
  const chord = ((Math.PI * 2 * radius) / bladeCount) * 0.78;
  const pitch = 0.42; // ~24°, the angle that makes a fan look like it moves air

  for (let i = 0; i < bladeCount; i++) {
    const blade = new THREE.BoxGeometry(bladeLength, chord, thickness * 0.22);
    blade.applyMatrix4(new THREE.Matrix4().makeRotationX(pitch));
    blade.translate(hubR + bladeLength / 2, 0, 0);
    blade.applyMatrix4(
      new THREE.Matrix4().makeRotationZ((i / bladeCount) * Math.PI * 2),
    );
    parts.push(blade);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) return new THREE.CylinderGeometry(hubR, hubR, thickness, radial);
  merged.computeVertexNormals();
  return merged;
}

/* -------------------------------------------------------------------------- */

export type FansProps = {
  slots: FanSlot[];
  /** Frame size in millimetres — 120 and 140 are what the shop sells. */
  sizeMm?: number;
  rgb?: boolean;
  /** Revolutions per second. 0 freezes the rotors (reduced-power tier). */
  spin?: number;
};

export function Fans({ slots, sizeMm = 120, rgb = false, spin = 0.6 }: FansProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const rotors = React.useRef<(THREE.Mesh | null)[]>([]);

  const size = mm(sizeMm);
  const depth = mm(25);
  const bladeCount = detail(quality, 9, 7);
  const segments = detail(quality, 16, 8);

  const geo = useDisposableSet(
    () => ({
      frame: platedGeometry(size, size, depth, {
        cornerRadius: size * 0.09,
        circles: [{ x: 0, y: 0, radius: size * 0.455 }],
        segments,
      }),
      rotor: rotorGeometry(size * 0.44, bladeCount, depth * 0.55, quality),
      ring: new THREE.TorusGeometry(size * 0.415, size * 0.028, 6, segments),
      pad: new THREE.BoxGeometry(size * 0.16, size * 0.16, 0.006),
    }),
    [size, depth, bladeCount, segments, quality],
  );

  useFrame((_state, dt) => {
    if (spin <= 0) return;
    const step = spin * Math.PI * 2 * dt;
    for (const rotor of rotors.current) {
      if (rotor) rotor.rotation.z += step;
    }
  });

  return (
    <group>
      {slots.map((slot, i) => (
        <group key={i} position={slot.position} rotation={FACING_ROTATION[slot.facing]}>
          <mesh geometry={geo.frame} material={mats.plastic} />
          <mesh
            ref={(node) => {
              rotors.current[i] = node;
            }}
            geometry={geo.rotor}
            material={mats.blade}
            position={[0, 0, -depth * 0.05]}
          />
          {rgb && (
            <mesh
              geometry={geo.ring}
              material={mats.rgb[i % mats.rgb.length]}
              position={[0, 0, depth / 2 - 0.006]}
            />
          )}
          {/* Anti-vibration pads at the corners. */}
          {(
            [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ] as const
          ).map(([sx, sy], p) => (
            <mesh
              key={p}
              geometry={geo.pad}
              material={mats.rubber}
              position={[sx * size * 0.42, sy * size * 0.42, depth / 2 + 0.002]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

export default Fans;
