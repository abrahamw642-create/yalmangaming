"use client";

/**
 * CPU cooling — a tower air cooler or an AIO liquid loop, chosen by the real
 * part's `coolerType`, sized by its real `coolerHeightMm` / `radiatorSizeMm`.
 *
 * Unlike the other board-mounted parts this one lives in CASE space, because an
 * AIO spans two frames at once: the pump bolts to the socket while the radiator
 * bolts to the chassis. Keeping the whole loop in one coordinate system is what
 * lets the tubes actually connect the two ends.
 *
 * The air tower is still modelled on the bench and rotated in, because that is
 * the orientation the hardware is designed in: the fin stack runs along the
 * cooler's axis, which points at the side panel once installed. That is exactly
 * why "cooler height" is a case-*width* constraint.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import {
  detail,
  mm,
  roundedBoxGeometry,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";
import { rotorGeometry } from "./Fans";

export type RadiatorPlacement = {
  mount: "top" | "front";
  /** Centre of the radiator core, case space. */
  position: [number, number, number];
  /** Core length along its long axis. */
  length: number;
  /** Core width across the fans. */
  width: number;
  thickness: number;
  fans: number;
  fanSizeMm: number;
};

export type CoolerProps = {
  type: "air" | "aio";
  /** Where the cold plate meets the CPU, in case space. */
  position: [number, number, number];
  /** Air tower height above the board, mm. */
  heightMm?: number;
  radiator?: RadiatorPlacement | null;
  rgb?: boolean;
  spin?: number;
};

export function Cooler({
  type,
  position,
  heightMm = 158,
  radiator = null,
  rgb = false,
  spin = 0.5,
}: CoolerProps) {
  return type === "aio" ? (
    <AioCooler position={position} radiator={radiator} rgb={rgb} spin={spin} />
  ) : (
    <AirCooler position={position} heightMm={heightMm} rgb={rgb} spin={spin} />
  );
}

/* -------------------------------------------------------------------------- */
/* Air tower                                                                  */
/* -------------------------------------------------------------------------- */

function AirCooler({
  position,
  heightMm,
  rgb,
  spin,
}: {
  position: [number, number, number];
  heightMm: number;
  rgb: boolean;
  spin: number;
}) {
  const mats = useMaterials();
  const quality = useQuality();
  const rotor = React.useRef<THREE.Mesh>(null);

  const height = mm(Math.max(60, heightMm));
  const baseH = 0.42;
  const stackH = Math.max(0.25, height - baseH);
  const finW = 1.2; // fan-width across the stack
  const finD = 0.46; // airflow depth through the stack
  const finCount = detail(quality, 42, 18);
  const finGap = stackH / finCount;
  const radial = detail(quality, 12, 6);
  const bevel = detail(quality, 2, 1);

  const geo = useDisposableSet(
    () => ({
      base: roundedBoxGeometry(0.46, 0.11, 0.46, 0.015, bevel),
      coldPlate: new THREE.BoxGeometry(0.44, 0.014, 0.44),
      bracket: new THREE.BoxGeometry(0.9, 0.02, 0.06),
      pipe: new THREE.CylinderGeometry(0.031, 0.031, stackH + 0.2, radial),
      fin: new THREE.BoxGeometry(finW, 0.005, finD),
      cap: roundedBoxGeometry(finW + 0.03, 0.025, finD + 0.03, 0.01, 1),
      strip: new THREE.BoxGeometry(finW * 0.7, 0.012, 0.02),
      fanFrame: roundedBoxGeometry(1.2, 1.2, 0.05, 0.09, bevel),
      rotor: rotorGeometry(0.5, detail(quality, 9, 7), 0.05, quality),
    }),
    [stackH, finW, finD, radial, bevel, quality],
  );

  useFrame((_state, dt) => {
    if (spin > 0 && rotor.current) {
      rotor.current.rotation.z += spin * Math.PI * 2 * dt;
    }
  });

  const pipeX = [-0.14, -0.05, 0.05, 0.14];
  const pipeZ = [-0.11, 0.11];

  return (
    // rotation-z of +90° points the cooler's axis at the glass panel, which is
    // the direction its height is measured in.
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={geo.coldPlate} material={mats.copper} position={[0, 0.007, 0]} />
      <mesh geometry={geo.base} material={mats.aluminiumDark} position={[0, 0.075, 0]} />
      <mesh geometry={geo.bracket} material={mats.chassisEdge} position={[0, 0.13, 0]} />

      {/* Heat pipes rising out of the base and through the fin stack. */}
      <Instances
        limit={pipeX.length * pipeZ.length}
        range={pipeX.length * pipeZ.length}
        geometry={geo.pipe}
        material={mats.copper}
      >
        {pipeX.flatMap((x) =>
          pipeZ.map((z) => (
            <Instance
              key={`${x}:${z}`}
              position={[x, baseH + stackH / 2 - 0.1, z]}
            />
          )),
        )}
      </Instances>

      {/* Fin stack. Instanced — 42 plates as separate meshes would be 42 draws
          for something that is mostly edge-on. */}
      <Instances limit={finCount} range={finCount} geometry={geo.fin} material={mats.aluminium}>
        {Array.from({ length: finCount }, (_, i) => (
          <Instance key={i} position={[0, baseH + i * finGap, 0]} />
        ))}
      </Instances>

      <mesh geometry={geo.cap} material={mats.aluminiumDark} position={[0, height + 0.02, 0]} />
      <mesh
        geometry={geo.strip}
        material={rgb ? mats.rgb[0] : mats.accent}
        position={[0, height + 0.038, 0]}
      />

      {/* Intake fan on the front face of the stack. */}
      <group position={[0, baseH + stackH * 0.5, finD / 2 + 0.03]}>
        <mesh geometry={geo.fanFrame} material={mats.plastic} />
        <mesh
          ref={rotor}
          geometry={geo.rotor}
          material={mats.blade}
          position={[0, 0, -0.004]}
        />
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* AIO                                                                        */
/* -------------------------------------------------------------------------- */

function tubeCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  bulge: THREE.Vector3,
): THREE.CatmullRomCurve3 {
  // Two control points pushed out along `bulge` give the loose, slightly slack
  // arc a braided tube actually takes. A straight line reads as a pipe.
  const a = from.clone().add(bulge.clone().multiplyScalar(0.55));
  const b = to.clone().add(bulge.clone().multiplyScalar(0.75));
  return new THREE.CatmullRomCurve3([from, a, b, to]);
}

function AioCooler({
  position,
  radiator,
  rgb,
  spin,
}: {
  position: [number, number, number];
  radiator: RadiatorPlacement | null;
  rgb: boolean;
  spin: number;
}) {
  const mats = useMaterials();
  const quality = useQuality();
  const rotors = React.useRef<(THREE.Mesh | null)[]>([]);

  const radial = detail(quality, 16, 8);
  const bevel = detail(quality, 3, 1);
  const tubeSegments = detail(quality, 40, 14);
  const tubeRadial = detail(quality, 8, 5);
  const finCount = detail(quality, 26, 10);

  const pump = React.useMemo(
    () => new THREE.Vector3(position[0], position[1], position[2]),
    [position],
  );

  /** Port positions on the pump and on the radiator, in case space. */
  const ports = React.useMemo(() => {
    // Pump ports sit on its side, offset along Z, and stand just off the block.
    const pumpA = pump.clone().add(new THREE.Vector3(-0.34, 0.2, -0.1));
    const pumpB = pump.clone().add(new THREE.Vector3(-0.34, 0.2, 0.1));
    if (!radiator) return { pumpA, pumpB, radA: pumpA, radB: pumpB, bulge: new THREE.Vector3() };

    const [rx, ry, rz] = radiator.position;
    if (radiator.mount === "top") {
      // Ports on the underside of the rear end tank.
      const endZ = rz - radiator.length / 2 + 0.12;
      return {
        pumpA,
        pumpB,
        radA: new THREE.Vector3(rx - 0.16, ry - radiator.thickness / 2 - 0.05, endZ),
        radB: new THREE.Vector3(rx + 0.16, ry - radiator.thickness / 2 - 0.05, endZ),
        bulge: new THREE.Vector3(-0.5, 0.35, -0.35),
      };
    }
    // Front mount: ports on the inward face of the lower end tank.
    const endY = ry - radiator.length / 2 + 0.14;
    return {
      pumpA,
      pumpB,
      radA: new THREE.Vector3(rx - 0.16, endY, rz - radiator.thickness / 2 - 0.06),
      radB: new THREE.Vector3(rx + 0.16, endY, rz - radiator.thickness / 2 - 0.06),
      bulge: new THREE.Vector3(-0.55, -0.3, 0.5),
    };
  }, [pump, radiator]);

  const geo = useDisposableSet(() => {
    const radLength = radiator?.length ?? 2.75;
    const radWidth = radiator?.width ?? 1.2;
    const radThick = radiator?.thickness ?? 0.27;
    const fanSize = mm(radiator?.fanSizeMm ?? 120);

    return {
      coldPlate: new THREE.BoxGeometry(0.5, 0.016, 0.5),
      block: roundedBoxGeometry(0.62, 0.34, 0.62, 0.05, bevel),
      cap: new THREE.CylinderGeometry(0.24, 0.24, 0.022, radial),
      capRing: new THREE.TorusGeometry(0.25, 0.018, 6, radial),
      barb: new THREE.CylinderGeometry(0.06, 0.06, 0.16, radial),
      tubeA: new THREE.TubeGeometry(
        tubeCurve(ports.pumpA, ports.radA, ports.bulge),
        tubeSegments,
        0.055,
        tubeRadial,
        false,
      ),
      tubeB: new THREE.TubeGeometry(
        tubeCurve(ports.pumpB, ports.radB, ports.bulge),
        tubeSegments,
        0.055,
        tubeRadial,
        false,
      ),
      radCore: new THREE.BoxGeometry(radWidth, radThick, radLength - 0.28),
      radTank: roundedBoxGeometry(radWidth, radThick + 0.03, 0.14, 0.02, 1),
      radFin: new THREE.BoxGeometry(radWidth - 0.03, radThick - 0.04, 0.006),
      fanFrame: roundedBoxGeometry(fanSize, fanSize, 0.05, fanSize * 0.09, bevel),
      rotor: rotorGeometry(fanSize * 0.44, detail(quality, 9, 7), 0.05, quality),
    };
  }, [radiator, ports, radial, bevel, tubeSegments, tubeRadial, quality]);

  useFrame((_state, dt) => {
    if (spin <= 0) return;
    const step = spin * Math.PI * 2 * dt;
    for (const node of rotors.current) {
      if (node) node.rotation.z += step;
    }
  });

  const radLength = radiator?.length ?? 0;
  const finGap = radLength > 0 ? (radLength - 0.4) / finCount : 0;

  return (
    <group>
      {/* Pump block on the socket. Same rotation as the board so the cold plate
          sits flat on the CPU. */}
      <group position={position} rotation={[0, 0, Math.PI / 2]}>
        <mesh geometry={geo.coldPlate} material={mats.copper} position={[0, 0.008, 0]} />
        <mesh geometry={geo.block} material={mats.plastic} position={[0, 0.19, 0]} />
        <mesh
          geometry={geo.cap}
          material={rgb ? mats.rgb[0] : mats.accent}
          position={[0, 0.37, 0]}
        />
        <mesh
          geometry={geo.capRing}
          material={mats.chassisEdge}
          position={[0, 0.368, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {[-0.1, 0.1].map((z) => (
          <mesh
            key={z}
            geometry={geo.barb}
            material={mats.chassisEdge}
            position={[0.2, 0.34, z]}
            rotation={[0, 0, Math.PI / 2]}
          />
        ))}
      </group>

      {/* Tubes are built in case space, so they meet the radiator wherever the
          chassis put it. */}
      <mesh geometry={geo.tubeA} material={mats.rubber} />
      <mesh geometry={geo.tubeB} material={mats.rubber} />

      {radiator && (
        <group
          position={radiator.position}
          rotation={radiator.mount === "front" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <mesh geometry={geo.radCore} material={mats.aluminiumDark} />
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={geo.radTank}
              material={mats.chassisEdge}
              position={[0, 0, (side * (radLength - 0.14)) / 2]}
            />
          ))}
          <Instances
            limit={finCount}
            range={finCount}
            geometry={geo.radFin}
            material={mats.aluminium}
          >
            {Array.from({ length: finCount }, (_, i) => (
              <Instance
                key={i}
                position={[0, 0, -radLength / 2 + 0.2 + i * finGap]}
              />
            ))}
          </Instances>

          {/* Fans on the airflow face — under a top radiator, behind a front
              one. The group rotation above already put us in that frame. */}
          {Array.from({ length: radiator.fans }, (_, i) => (
            <group
              key={i}
              position={[
                0,
                -radiator.thickness / 2 - 0.04,
                -radLength / 2 + (radLength / radiator.fans) * (i + 0.5),
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <mesh geometry={geo.fanFrame} material={mats.plastic} />
              <mesh
                ref={(node) => {
                  rotors.current[i] = node;
                }}
                geometry={geo.rotor}
                material={mats.blade}
                position={[0, 0, -0.004]}
              />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

export default Cooler;
