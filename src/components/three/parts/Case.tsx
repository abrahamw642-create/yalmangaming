"use client";

/**
 * The chassis: floor, ceiling, rear panel, motherboard tray, PSU basement,
 * mesh front and the tempered glass side panel.
 *
 * Orientation used by every part in this folder (scene units, 1 = 100 mm):
 *
 *      +Y  up (case ceiling)
 *      +Z  the front of the case          -Z  the rear I/O panel
 *      -X  the glass side (toward camera) +X  the motherboard tray
 *
 * The rear panel is a real extruded plate with real apertures cut in it — the
 * I/O window, the expansion-slot column, the rear fan and the PSU cut-out — so
 * you can see through the back of the machine when it turns. Faking those with
 * dark rectangles falls apart the moment the light moves.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import {
  type CircleHole,
  type RectHole,
  damp,
  detail,
  platedGeometry,
  roundedBoxGeometry,
  smoothstep,
  useDisposableSet,
  useMaterials,
  useQuality,
} from "../Rig";

/** Sheet-metal thickness. Real cases are 0.8–1.0 mm; 2 mm reads better. */
const T = 0.02;

export type RearApertures = {
  ioW: number; ioH: number; ioX: number; ioY: number;
  slotW: number; slotH: number; slotX: number; slotY: number;
  fanR: number; fanX: number; fanY: number;
  psuW: number; psuH: number; psuX: number; psuY: number;
};

/**
 * Where the apertures land on the rear panel.
 *
 * Exported because the parts that go *through* those holes are not children of
 * this component — the rear exhaust fan and the power supply are placed by the
 * assembly in case space, and a fan that does not sit in its own grille is the
 * single most obvious way for a procedural chassis to look wrong.
 */
export function rearApertures(
  W: number,
  H: number,
  boardPlaneX: number,
  boardTopY: number,
  expansionSlots: number,
): RearApertures {
  const halfW = W / 2;
  const halfH = H / 2;

  // A hole that touches the outline turns the extrusion inside out, so every
  // aperture is clamped inside the plate with a margin.
  const limitX = (x: number, w: number) =>
    THREE.MathUtils.clamp(x, -halfW + w / 2 + 0.05, halfW - w / 2 - 0.05);
  const limitY = (y: number, h: number) =>
    THREE.MathUtils.clamp(y, -halfH + h / 2 + 0.05, halfH - h / 2 - 0.05);

  // ATX rear edge, top to bottom: a 159 mm tall I/O window, then the
  // expansion-slot column. The rear fan sits *beside* the I/O window on the
  // glass side — the only place on a ~200 mm wide back panel it fits.
  const ioW = 0.45;
  const ioH = Math.min(1.59, H * 0.36);
  const ioX = limitX(boardPlaneX - 0.25, ioW);
  const ioY = limitY(boardTopY - ioH / 2, ioH);

  const slotW = 1.2;
  const slotH = Math.max(0.25, Math.min(0.203 * expansionSlots + 0.05, H - 2));
  const slotX = limitX(boardPlaneX - 0.65, slotW);
  const slotY = limitY(ioY - ioH / 2 - slotH / 2 - 0.04, slotH);

  const fanR = Math.max(0.2, Math.min(0.55, W / 2 - 0.4));
  const fanX = limitX(boardPlaneX - 1.12, fanR * 2);
  const fanY = limitY(boardTopY - 0.62, fanR * 2);

  const psuW = Math.min(1.5, W - 0.4);
  const psuH = 0.86;
  const psuX = limitX(boardPlaneX - 0.72, psuW);
  const psuY = limitY(-halfH + 0.14 + psuH / 2, psuH);

  return {
    ioW, ioH, ioX, ioY,
    slotW, slotH, slotX, slotY,
    fanR, fanX, fanY,
    psuW, psuH, psuX, psuY,
  };
}

export type CaseProps = {
  width: number;
  height: number;
  depth: number;
  /** X of the motherboard PCB plane — the rear apertures line up with it. */
  boardPlaneX: number;
  /** Y of the board's top edge. The I/O window hangs from it. */
  boardTopY: number;
  /** Height of the PSU basement. 0 renders an open floor instead. */
  shroudHeight: number;
  glass: boolean;
  rgb: boolean;
  expansionSlots?: number;
  /** Scroll/explode progress, read per frame so scrolling never re-renders. */
  progressRef: React.RefObject<number>;
  /** Progress window over which the panels come off. */
  shellPhase: [number, number];
};

/** How far each removable panel travels once the shell is fully open. */
const PANEL_TRAVEL = {
  glass: -2.4,
  front: 2.2,
  top: 1.6,
};

export function Case({
  width: W,
  height: H,
  depth: D,
  boardPlaneX,
  boardTopY,
  shroudHeight,
  glass,
  rgb,
  expansionSlots = 7,
  progressRef,
  shellPhase,
}: CaseProps) {
  const mats = useMaterials();
  const quality = useQuality();
  const invalidate = useThree((state) => state.invalidate);

  const glassRef = React.useRef<THREE.Group>(null);
  const frontRef = React.useRef<THREE.Group>(null);
  const topRef = React.useRef<THREE.Group>(null);

  const segments = detail(quality, 12, 6);
  const bevel = detail(quality, 3, 1);

  /**
   * Derived once and reused by both the plate geometry and the slot covers laid
   * over it, so the covers can never drift off the holes they cover.
   */
  const rear = React.useMemo(
    () => rearApertures(W, H, boardPlaneX, boardTopY, expansionSlots),
    [W, H, boardPlaneX, boardTopY, expansionSlots],
  );

  const geo = useDisposableSet(() => {
    const rects: RectHole[] = [
      { x: rear.ioX, y: rear.ioY, w: rear.ioW, h: rear.ioH, r: 0.02 },
      { x: rear.slotX, y: rear.slotY, w: rear.slotW, h: rear.slotH, r: 0.02 },
    ];
    // Only cut the PSU window when the basement actually clears the slots.
    if (
      shroudHeight > 0.5 &&
      rear.psuY + rear.psuH / 2 < rear.slotY - rear.slotH / 2 - 0.02
    ) {
      rects.push({ x: rear.psuX, y: rear.psuY, w: rear.psuW, h: rear.psuH, r: 0.03 });
    }
    const circles: CircleHole[] = [
      { x: rear.fanX, y: rear.fanY, radius: rear.fanR },
    ];

    const ventW = Math.max(0.4, W - 0.5);
    const ventD = Math.max(0.4, D * 0.52);
    const shroudDepth = Math.max(0.4, D - 0.36);

    return {
      floor: roundedBoxGeometry(W, T, D, 0.02, bevel),
      ceiling: platedGeometry(W, D, T, {
        cornerRadius: 0.05,
        rects: [{ x: 0, y: -0.06, w: ventW, h: ventD, r: 0.04 }],
        segments,
      }),
      ceilingMesh: new THREE.BoxGeometry(ventW - 0.02, ventD - 0.02, 0.004),
      back: platedGeometry(W, H, T, {
        cornerRadius: 0.05,
        rects,
        circles,
        segments,
      }),
      traySide: roundedBoxGeometry(T, H - 0.04, D - 0.04, 0.02, bevel),
      tray: new THREE.BoxGeometry(
        0.016,
        Math.max(0.2, H - shroudHeight - 0.12),
        D - 0.16,
      ),
      grommet: new THREE.BoxGeometry(0.03, 0.9, 0.09),
      frontFrame: platedGeometry(W, H, 0.03, {
        cornerRadius: 0.06,
        rects: [{ x: 0, y: 0, w: W - 0.24, h: H - 0.24, r: 0.05 }],
        segments,
      }),
      frontMesh: new THREE.BoxGeometry(W - 0.25, H - 0.25, 0.004),
      glass: roundedBoxGeometry(0.008, H - 0.07, D - 0.07, 0.02, bevel),
      glassTrim: platedGeometry(D - 0.07, H - 0.07, 0.012, {
        cornerRadius: 0.03,
        rects: [{ x: 0, y: 0, w: D - 0.17, h: H - 0.17, r: 0.03 }],
        segments,
      }),
      shroud: roundedBoxGeometry(
        W - T * 2,
        Math.max(0.05, shroudHeight),
        shroudDepth,
        0.02,
        bevel,
      ),
      foot: roundedBoxGeometry(0.16, 0.05, 0.36, 0.02, 1),
      slotCover: roundedBoxGeometry(rear.slotW - 0.1, 0.185, 0.012, 0.006, 1),
      lightBar: new THREE.BoxGeometry(0.022, Math.max(0.2, H - 0.5), 0.022),
      buttonRing: new THREE.TorusGeometry(0.045, 0.009, 6, segments),
      port: new THREE.BoxGeometry(0.09, 0.012, 0.05),
    };
  }, [W, H, D, shroudHeight, segments, bevel, rear]);

  useFrame((_state, dt) => {
    const open = smoothstep(shellPhase[0], shellPhase[1], progressRef.current);

    let moving = false;
    const step = (
      node: THREE.Group | null,
      axis: "x" | "y" | "z",
      target: number,
    ) => {
      if (!node) return;
      const before = node.position[axis];
      node.position[axis] = damp(before, target, 3.2, dt);
      if (Math.abs(node.position[axis] - target) > 1e-4) moving = true;
    };

    step(glassRef.current, "x", PANEL_TRAVEL.glass * open);
    step(frontRef.current, "z", PANEL_TRAVEL.front * open);
    step(topRef.current, "y", PANEL_TRAVEL.top * open);

    // Keeps `frameloop="demand"` scenes ticking only while something moves.
    if (moving) invalidate();
  });

  const halfW = W / 2;
  const halfH = H / 2;
  const halfD = D / 2;
  const slotCovers = Math.max(1, Math.min(expansionSlots, 9));

  return (
    <group>
      {/* --- Structure ------------------------------------------------- */}
      <mesh geometry={geo.floor} material={mats.chassis} position={[0, -halfH + T / 2, 0]} />
      <mesh
        geometry={geo.back}
        material={mats.chassis}
        position={[0, 0, -halfD + T / 2]}
      />
      <mesh
        geometry={geo.traySide}
        material={mats.chassis}
        position={[halfW - T / 2, 0, 0]}
      />

      {/* Motherboard tray with its cable grommets. */}
      <mesh
        geometry={geo.tray}
        material={mats.panel}
        position={[halfW - 0.25, shroudHeight / 2 - 0.02, 0]}
      />
      <mesh
        geometry={geo.grommet}
        material={mats.rubber}
        position={[halfW - 0.245, shroudHeight / 2 + 0.15, halfD - 0.55]}
      />
      <mesh
        geometry={geo.grommet}
        material={mats.rubber}
        position={[halfW - 0.245, shroudHeight / 2 - 0.5, halfD - 0.55]}
      />

      {/* Expansion slot covers over the rear aperture. */}
      <Instances
        limit={slotCovers}
        range={slotCovers}
        geometry={geo.slotCover}
        material={mats.chassisEdge}
      >
        {Array.from({ length: slotCovers }, (_, i) => (
          <Instance
            key={i}
            position={[
              rear.slotX,
              rear.slotY + rear.slotH / 2 - 0.115 - i * 0.203,
              -halfD + 0.035,
            ]}
          />
        ))}
      </Instances>

      {/* PSU basement. Small cases have none — the PSU sits on the floor. */}
      {shroudHeight > 0.5 && (
        <mesh
          geometry={geo.shroud}
          material={mats.panel}
          position={[0, -halfH + shroudHeight / 2, -halfD + (D - 0.36) / 2 + T]}
        />
      )}

      {/* Feet */}
      {(
        [
          [-halfW + 0.2, halfD - 0.3],
          [halfW - 0.2, halfD - 0.3],
          [-halfW + 0.2, -halfD + 0.3],
          [halfW - 0.2, -halfD + 0.3],
        ] as const
      ).map(([x, z], i) => (
        <mesh
          key={i}
          geometry={geo.foot}
          material={mats.rubber}
          position={[x, -halfH - 0.025, z]}
        />
      ))}

      {/* --- Front panel (lifts away when exploded) --------------------- */}
      <group ref={frontRef}>
        <mesh
          geometry={geo.frontFrame}
          material={mats.chassis}
          position={[0, 0, halfD - 0.015]}
        />
        <mesh
          geometry={geo.frontMesh}
          material={mats.perforated}
          position={[0, 0, halfD - 0.026]}
        />
        {/* Front light bar — the one piece of RGB visible with the case shut. */}
        <mesh
          geometry={geo.lightBar}
          material={rgb ? mats.rgb[0] : mats.accent}
          position={[-halfW + 0.06, 0, halfD + 0.004]}
        />
      </group>

      {/* --- Top panel + front I/O -------------------------------------- */}
      <group ref={topRef}>
        <mesh
          geometry={geo.ceiling}
          material={mats.chassis}
          position={[0, halfH - T / 2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={geo.ceilingMesh}
          material={mats.perforated}
          position={[0, halfH - T - 0.004, 0.06]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={geo.buttonRing}
          material={rgb ? mats.rgb[1] : mats.accent}
          position={[-halfW + 0.22, halfH + 0.004, halfD - 0.18]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {[0, 1].map((i) => (
          <mesh
            key={i}
            geometry={geo.port}
            material={mats.rubber}
            position={[-halfW + 0.42 + i * 0.13, halfH - 0.002, halfD - 0.18]}
          />
        ))}
      </group>

      {/* --- Tempered glass side panel ---------------------------------- */}
      {glass && (
        <group ref={glassRef}>
          <mesh
            geometry={geo.glassTrim}
            material={mats.chassisEdge}
            position={[-halfW + 0.014, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          />
          {/* Rendered after everything else it tints; depthWrite is off on the
              glass material so the interior is never z-fought away. */}
          <mesh
            geometry={geo.glass}
            material={mats.glass}
            position={[-halfW + 0.008, 0, 0]}
            renderOrder={10}
          />
        </group>
      )}
    </group>
  );
}

export default Case;
