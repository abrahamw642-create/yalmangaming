"use client";

/**
 * Power supply unit. Modelled in CASE space around its own centre — the caller
 * places it, because where a PSU lives depends on whether the chassis has a
 * basement or an open floor.
 *
 * Extents:  X = unit width   (ATX 150 mm, SFX 125 mm)
 *           Y = unit height  (ATX 86 mm,  SFX 63.5 mm)
 *           Z = unit depth   — the real `psuLengthMm`, which is the same figure
 *               the compatibility engine measures against `maxPsuLengthMm`
 *
 * Mounted fan-down, the way every shrouded case takes it, so the intake is on
 * the −Y face and the modular cable panel faces the front of the machine. A
 * case with no basement takes the unit fan-up instead and the caller flips it.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import {
  detail,
  mm,
  platedGeometry,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";
import { rotorGeometry } from "./Fans";

export type PsuFormFactor = "ATX" | "SFX" | "SFX-L";

export type PsuProps = {
  /** Depth front-to-back, mm. ATX units run 140–200. */
  lengthMm?: number;
  formFactor?: string | null;
  /** Intake faces the floor. False mounts it fan-up, for cases with no shroud. */
  fanDown?: boolean;
  rgb?: boolean;
  /** Rotor revolutions per second; 0 freezes it. */
  spin?: number;
};

/** Published outer dimensions, millimetres. Depth comes from the real part. */
const PSU_BODY: Record<PsuFormFactor, { width: number; height: number }> = {
  ATX: { width: 150, height: 86 },
  SFX: { width: 125, height: 63.5 },
  "SFX-L": { width: 125, height: 63.5 },
};

function normaliseFormFactor(value: string | null | undefined): PsuFormFactor {
  switch (value) {
    case "SFX":
    case "SFX-L":
      return value;
    default:
      return "ATX";
  }
}

export function Psu({
  lengthMm = 160,
  formFactor = "ATX",
  fanDown = true,
  rgb = false,
  spin = 0.35,
}: PsuProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const rotor = React.useRef<THREE.Mesh>(null);

  const body = PSU_BODY[normaliseFormFactor(formFactor)];

  const W = mm(body.width);
  const H = mm(body.height);
  // SFX-L units are longer than the plain SFX 100 mm; the real figure decides.
  const D = mm(THREE.MathUtils.clamp(lengthMm, 100, 230));

  // The fan is as large as the shorter of the two faces it has to fit inside,
  // which is what actually decides whether a unit ships a 120 or a 140.
  const fanR = Math.min(W, D) * 0.44;

  const bevel = detail(quality, 3, 1);
  const radial = detail(quality, 16, 8);
  const bladeCount = detail(quality, 9, 7);
  const ventCount = detail(quality, 5, 3);

  const geo = useDisposableSet(() => {
    // Rear face: an exhaust grille beside the mains inlet and rocker switch.
    // Cut as real apertures, because this face lines up behind the chassis's
    // own PSU cut-out and you look straight through both of them.
    const ventW = W * 0.5;
    const ventH = H * 0.6;
    const pitch = ventW / ventCount;
    const vents = Array.from({ length: ventCount }, (_, i) => ({
      x: -W * 0.16 - ventW / 2 + pitch * (i + 0.5),
      y: 0,
      w: pitch * 0.6,
      h: ventH,
      r: 0.01,
    }));

    return {
      shell: roundedBoxGeometry(W, H, D, 0.025, bevel),
      rear: platedGeometry(W - 0.02, H - 0.02, 0.012, {
        cornerRadius: 0.02,
        rects: vents,
        segments: detail(quality, 8, 4),
      }),
      inlet: roundedBoxGeometry(0.24, 0.19, 0.05, 0.012, 1),
      inletFace: new THREE.BoxGeometry(0.18, 0.13, 0.012),
      rocker: roundedBoxGeometry(0.13, 0.09, 0.03, 0.008, 1),
      recess: new THREE.CylinderGeometry(fanR * 1.06, fanR * 1.06, 0.03, radial),
      fanRing: new THREE.TorusGeometry(fanR, 0.014, 6, radial),
      fanGuard: new THREE.TorusGeometry(fanR * 0.62, 0.006, 4, radial),
      rotor: rotorGeometry(fanR * 0.92, bladeCount, 0.04, quality),
      hub: new THREE.CylinderGeometry(fanR * 0.28, fanR * 0.28, 0.02, radial),
      socket: roundedBoxGeometry(0.11, 0.05, 0.03, 0.008, 1),
      label: new THREE.BoxGeometry(W * 0.66, 0.004, D * 0.52),
      strip: new THREE.BoxGeometry(W * 0.5, 0.012, 0.016),
    };
  }, [W, H, D, fanR, bevel, radial, bladeCount, ventCount, quality]);

  useFrame((_state, dt) => {
    if (spin > 0 && rotor.current) {
      rotor.current.rotation.z += spin * Math.PI * 2 * dt;
    }
  });

  // Modular sockets: two rows across the front face, the layout every semi- or
  // fully-modular unit uses.
  const sockets = React.useMemo(() => {
    const out: [number, number, number][] = [];
    const cols = detail(quality, 5, 3);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < cols; col++) {
        out.push([
          -W * 0.32 + (W * 0.64 * col) / Math.max(1, cols - 1),
          H * 0.2 - row * H * 0.4,
          D / 2 + 0.012,
        ]);
      }
    }
    return out;
  }, [W, H, D, quality]);

  // The intake group's local +Z is the direction air is drawn from, so it has
  // to point out of the shell — down when the unit is fan-down, up otherwise.
  const intakeY = fanDown ? -H / 2 : H / 2;
  const intakeRotX = fanDown ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group>
      <mesh geometry={geo.shell} material={mats.chassis} />

      {/* --- Rear face: grille, mains inlet, switch ---------------------- */}
      <mesh
        geometry={geo.rear}
        material={mats.chassisEdge}
        position={[0, 0, -D / 2 - 0.005]}
      />
      <mesh
        geometry={geo.inlet}
        material={mats.plastic}
        position={[W * 0.29, H * 0.04, -D / 2 - 0.02]}
      />
      <mesh
        geometry={geo.inletFace}
        material={mats.rubber}
        position={[W * 0.29, H * 0.04, -D / 2 - 0.043]}
      />
      <mesh
        geometry={geo.rocker}
        material={mats.plastic}
        position={[W * 0.29, -H * 0.26, -D / 2 - 0.014]}
      />

      {/* --- Intake fan --------------------------------------------------- */}
      <group position={[0, intakeY, 0]} rotation={[intakeRotX, 0, 0]}>
        {/* A shallow recess so the rotor sits below the shell face instead of
            floating on top of it. */}
        <mesh
          geometry={geo.recess}
          material={mats.panel}
          position={[0, 0, -0.02]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh geometry={geo.fanRing} material={mats.plastic} position={[0, 0, -0.006]} />
        <mesh
          ref={rotor}
          geometry={geo.rotor}
          material={mats.blade}
          position={[0, 0, -0.018]}
        />
        <mesh
          geometry={geo.hub}
          material={mats.chassisEdge}
          position={[0, 0, -0.01]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh geometry={geo.fanGuard} material={mats.chassisEdge} position={[0, 0, -0.004]} />
      </group>

      {/* --- Modular cable panel, facing the front of the case ------------ */}
      <Instances
        limit={sockets.length}
        range={sockets.length}
        geometry={geo.socket}
        material={mats.rubber}
      >
        {sockets.map((position, i) => (
          <Instance key={i} position={position} />
        ))}
      </Instances>

      {/* Spec label on whichever face ends up uppermost — hidden by the shroud
          in an assembled machine, which is exactly when you see it in the
          exploded view. */}
      <mesh geometry={geo.label} material={mats.label} position={[0, -intakeY - 0.003, 0]} />

      {/* Accent strip along the front edge: on a basement-mounted unit this is
          the only part a customer ever sees through the glass. */}
      <mesh
        geometry={geo.strip}
        material={rgb ? mats.rgb[2] : mats.accent}
        position={[0, -H * 0.38, D / 2 + 0.006]}
      />
    </group>
  );
}

export default Psu;
