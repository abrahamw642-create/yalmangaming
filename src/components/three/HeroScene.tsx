"use client";

/**
 * The homepage machine.
 *
 * NEVER import this from a Server Component — it pulls three.js, drei and every
 * part in `./parts` in at module scope. Callers bring it in like this:
 *
 *   const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
 *     ssr: false,
 *     loading: () => <SceneFallback />,
 *   });
 *
 * What it does:
 *   - a premium tower, lit as a studio product shot
 *   - a damped, clamped rotation that follows the pointer, plus a slow idle
 *     sway so the machine is alive when the pointer is still
 *   - RGB inside the chassis whose hue tracks the pointer (see `Rig`)
 *   - a parallaxing dust field behind it
 *   - a camera that drifts with the pointer and dollies back as the machine
 *     comes apart
 *   - `scrollProgress` (0..1) drives the exploded sequence. The caption
 *     boundaries are `EXPLODE_PHASES`, re-exported below and defined in
 *     `SceneFallback` so a caller can render them without importing WebGL.
 *
 * The canvas is decorative: `aria-hidden`, `pointer-events: none`, and nothing
 * on the page exists only inside it.
 */

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { clamp, cn } from "@/lib/utils";
import { ExplodedPC, resolveMachine, type MachineSpec } from "./ExplodedPC";
import { Particles } from "./Particles";
import {
  Rig,
  SCENE_CAMERA,
  clamp01,
  damp,
  dampVec3,
  type PointerRef,
  type Quality,
} from "./Rig";
import { SceneFallback } from "./SceneFallback";
import { useLowPower, useOnScreen } from "./useLowPower";

export { EXPLODE_PHASES, phaseAt } from "./SceneFallback";
export type { ExplodePhase } from "./SceneFallback";

/** How far the pointer can turn the machine. Small on purpose. */
const MAX_YAW = 0.26;
const MAX_PITCH = 0.1;
/**
 * Resting angle. Positive yaw turns the tempered-glass side further toward the
 * camera; the camera azimuth already favours it, and this opens it a little
 * further still.
 */
const BASE_YAW = 0.12;

export type HeroSceneProps = {
  /**
   * 0 = assembled, 1 = fully exploded. Fed from the page's scroll position by
   * the caller. Arrives as a prop but is stored in a ref, so scrolling never
   * re-renders React — only the render loop reads it.
   */
  scrollProgress?: number;
  className?: string;
};

export function HeroScene({ scrollProgress = 0, className }: HeroSceneProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const power = useLowPower();
  const onScreen = useOnScreen(host, "300px");

  const pointer = React.useRef(new THREE.Vector2());
  const progress = React.useRef(0);
  // Captured from the canvas so effects outside it can wake a demand-driven
  // render loop. Null until the canvas exists, and after it is torn down.
  const invalidate = React.useRef<(() => void) | null>(null);

  const quality: Quality = power.tier === "reduced" ? "reduced" : "full";
  const active = power.tier !== "off" && power.webgl;

  const spec = React.useMemo<MachineSpec>(
    () => resolveMachine({}, { showcase: true, glass: true, rgb: true }),
    [],
  );

  React.useEffect(() => {
    progress.current = clamp01(scrollProgress);
    invalidate.current?.();
  }, [scrollProgress]);

  // The canvas hands its `invalidate` over in `onCreated`; drop the reference
  // when it goes away so nothing pokes a torn-down renderer.
  React.useEffect(() => {
    if (active) return;
    invalidate.current = null;
  }, [active]);

  React.useEffect(() => {
    if (!active) return;
    const node = host.current;
    if (!node) return;

    let queued = 0;
    const wake = () => {
      // One invalidate per animation frame however fast the pointer moves.
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        invalidate.current?.();
      });
    };

    // Tracked on the window rather than through R3F's own pointer events: the
    // canvas is `pointer-events: none` so the hero copy and its CTA stay
    // clickable straight through it.
    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointer.current.set(
        clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
        clamp(-((event.clientY - rect.top) / rect.height) * 2 + 1, -1, 1),
      );
      wake();
    };

    const onLeave = () => {
      pointer.current.set(0, 0);
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      cancelAnimationFrame(queued);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [active]);

  return (
    <div
      ref={host}
      className={cn("pointer-events-none relative h-full w-full", className)}
      aria-hidden="true"
    >
      {active ? (
        <Canvas
          frameloop={!onScreen ? "never" : quality === "full" ? "always" : "demand"}
          // Capped so a 3x phone does not render nine times the pixels of a
          // laptop for a decorative scene.
          dpr={quality === "full" ? [1, 2] : 1}
          // No shadow maps anywhere: the ground contact shadow in `Rig` is a
          // single blurred pass and looks better than a spot map at this scale.
          shadows={false}
          gl={{
            antialias: quality === "full",
            alpha: true,
            powerPreference: "high-performance",
          }}
          camera={{
            fov: SCENE_CAMERA.fov,
            near: SCENE_CAMERA.near,
            far: SCENE_CAMERA.far,
            position: SCENE_CAMERA.position,
          }}
          onCreated={(state) => {
            invalidate.current = state.invalidate;
          }}
          style={{ pointerEvents: "none" }}
        >
          <CameraDrift pointerRef={pointer} progressRef={progress} />

          <Particles
            count={quality === "full" ? 420 : 110}
            pointerRef={pointer}
            motion={quality === "full" ? 1 : 0}
            opacity={quality === "full" ? 1 : 0.8}
          />

          <Rig
            quality={quality}
            rgb
            pointerRef={pointer}
            floorY={spec.floorY}
            shadowScale={spec.shadowScale}
            interior={spec.interior}
          >
            <HeroMachine
              spec={spec}
              pointerRef={pointer}
              progressRef={progress}
              quality={quality}
            />
          </Rig>
        </Canvas>
      ) : (
        <SceneFallback />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HeroMachine({
  spec,
  pointerRef,
  progressRef,
  quality,
}: {
  spec: MachineSpec;
  pointerRef: PointerRef;
  progressRef: React.RefObject<number>;
  quality: Quality;
}) {
  const group = React.useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  // The idle sway is motion for its own sake, so the reduced tier does without
  // it — and without it there is nothing left to force a frame when the
  // pointer is still, which is the whole point of `frameloop="demand"`.
  const sway = quality === "full" ? 1 : 0;

  useFrame((state, dt) => {
    const node = group.current;
    if (!node) return;

    const t = state.clock.elapsedTime;
    const progress = clamp01(progressRef.current);
    const px = pointerRef.current.x;
    const py = pointerRef.current.y;

    // Clamped by construction: the pointer is already normalised to −1..1, so
    // the machine can never swing more than MAX_YAW off its resting angle.
    const yaw =
      BASE_YAW +
      px * MAX_YAW +
      Math.sin(t * 0.21) * 0.045 * sway +
      // Opens the interior further as the machine comes apart.
      progress * 0.18;
    const pitch = -py * MAX_PITCH + Math.sin(t * 0.17) * 0.018 * sway;

    const beforeYaw = node.rotation.y;
    const beforePitch = node.rotation.x;
    node.rotation.y = damp(node.rotation.y, yaw, 2.6, dt);
    node.rotation.x = damp(node.rotation.x, pitch, 2.6, dt);

    // Lifts a touch as it opens, which stops the exploded parts crowding the
    // bottom of the frame.
    const lift = progress * 0.18;
    const drift = dampVec3(node.position, 0, lift, 0, 2.4, dt);

    if (
      drift > 1e-4 ||
      Math.abs(node.rotation.y - beforeYaw) > 1e-5 ||
      Math.abs(node.rotation.x - beforePitch) > 1e-5
    ) {
      invalidate();
    }
  });

  return (
    <group ref={group} rotation={[0, BASE_YAW, 0]}>
      <ExplodedPC
        spec={spec}
        progressRef={progressRef}
        spin={quality === "full" ? 0.55 : 0}
        animateEntry={false}
      />
    </group>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Moves the camera itself rather than the machine, so the perspective shifts
 * with the pointer instead of the object merely spinning — a much smaller
 * amount of movement reads as much more depth.
 */
function CameraDrift({
  pointerRef,
  progressRef,
}: {
  pointerRef: PointerRef;
  progressRef: React.RefObject<number>;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const base = SCENE_CAMERA.position;

  useFrame((state, dt) => {
    const progress = clamp01(progressRef.current);
    // Pull back as the machine comes apart so the spread never leaves frame.
    const dolly = 1 + progress * 0.52;

    const delta = dampVec3(
      state.camera.position,
      base[0] * dolly + pointerRef.current.x * 0.62,
      base[1] * dolly + pointerRef.current.y * 0.45,
      base[2] * dolly,
      2.0,
      dt,
    );
    state.camera.lookAt(
      SCENE_CAMERA.target[0],
      SCENE_CAMERA.target[1],
      SCENE_CAMERA.target[2],
    );

    if (delta > 1e-4) invalidate();
  });

  return null;
}

export default HeroScene;
