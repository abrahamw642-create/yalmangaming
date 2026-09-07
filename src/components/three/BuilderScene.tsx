"use client";

/**
 * The live picture of the build a customer is configuring.
 *
 * NEVER import this from a Server Component — it pulls three.js, drei and every
 * part in `./parts` in at module scope. `BuilderShell` brings it in with
 * `dynamic(() => import("@/components/three/BuilderScene"), { ssr: false })`,
 * which is the only supported way to mount it.
 *
 * It draws exactly what has been chosen and nothing else. Add a graphics card
 * and a card of the right length appears in the x16 slot; a four-module kit
 * fills four DIMMs where a two-module kit fills two; picking an AIO swaps the
 * tower for a pump and hangs its radiator off the ceiling. Every one of those
 * dimensions comes from the same columns `checkCompatibility` reads, so the
 * picture and the warnings can never tell the customer different stories.
 *
 * The chassis is the exception: it is always drawn, even before a case is
 * chosen, because an empty rectangle is a worse answer to "what am I building"
 * than an empty case is.
 */

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { BuildSelection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ExplodedPC, resolveMachine, type MachineSpec } from "./ExplodedPC";
import { Rig, SCENE_CAMERA, damp, type Quality } from "./Rig";
import { SceneFallback } from "./SceneFallback";
import { useLowPower, useOnScreen } from "./useLowPower";

export type BuilderSceneProps = {
  selection: BuildSelection;
  /** Pull the machine apart. Damped, so toggling it mid-transition is safe. */
  exploded?: boolean;
  /** Draw the tempered-glass side panel. */
  glass?: boolean;
  /** Animate the RGB zones. Off holds a steady cyan on every lit surface. */
  rgb?: boolean;
  className?: string;
};

export function BuilderScene({
  selection,
  exploded = false,
  glass = true,
  rgb = true,
  className,
}: BuilderSceneProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const power = useLowPower();
  const onScreen = useOnScreen(host, "150px");
  const finePointer = useFinePointer();

  const progress = React.useRef(0);

  const quality: Quality = power.tier === "reduced" ? "reduced" : "full";
  const active = power.tier !== "off" && power.webgl;

  const spec = React.useMemo<MachineSpec>(
    () => resolveMachine(selection, { glass, rgb }),
    [selection, glass, rgb],
  );

  if (!active) {
    return (
      <div
        ref={host}
        className={cn("relative h-full w-full", className)}
        aria-hidden="true"
      >
        <SceneFallback glow={false} />
      </div>
    );
  }

  return (
    // Decorative. Everything the picture shows is also in the parts list and
    // the compatibility panel beside it, in text.
    <div ref={host} className={cn("relative h-full w-full", className)} aria-hidden="true">
      <Canvas
        frameloop={!onScreen ? "never" : quality === "full" ? "always" : "demand"}
        dpr={quality === "full" ? [1, 2] : 1}
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
      >
        <ExplodeDriver target={exploded ? 1 : 0} progressRef={progress} />

        <Rig
          quality={quality}
          rgb={rgb}
          floorY={spec.floorY}
          shadowScale={spec.shadowScale}
          interior={spec.interior}
        >
          <ExplodedPC
            spec={spec}
            progressRef={progress}
            spin={quality === "full" ? 0.5 : 0}
            // Parts fly in along the path they would come out on, so choosing a
            // component reads as fitting it rather than as a redraw.
            animateEntry
          />
        </Rig>

        {/*
          Orbit is mouse and trackpad only. `OrbitControls` sets
          `touch-action: none` on the canvas the moment it connects, which turns
          a full-width preview into a scroll trap on a phone — one finger would
          spin the PC instead of moving the page. Touch visitors get the same
          composed three-quarter view and the same glass / RGB / exploded
          toggles, which is the part that carries the information.
        */}
        {finePointer && (
          <OrbitControls
            makeDefault
            target={SCENE_CAMERA.target}
            enablePan={false}
            enableDamping
            dampingFactor={0.075}
            rotateSpeed={0.6}
            zoomSpeed={0.55}
            minDistance={6}
            maxDistance={16}
            // Stops the customer orbiting under the floor or straight down the
            // top panel, both of which look like a bug rather than a view.
            minPolarAngle={Math.PI * 0.16}
            maxPolarAngle={Math.PI * 0.62}
          />
        )}
      </Canvas>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Turns the boolean `exploded` prop into the continuous 0..1 the parts read.
 *
 * Kept in a ref rather than React state on purpose: the transition runs for
 * about a second at 60 fps, and driving it through state would re-render the
 * whole builder sixty times for an animation nothing outside the canvas cares
 * about.
 */
function ExplodeDriver({
  target,
  progressRef,
}: {
  target: number;
  progressRef: React.RefObject<number>;
}) {
  const invalidate = useThree((state) => state.invalidate);

  React.useEffect(() => {
    invalidate();
  }, [target, invalidate]);

  useFrame((_state, dt) => {
    const current = progressRef.current;
    if (current === target) return;

    const next = damp(current, target, 2.8, dt);
    // Exponential damping never quite arrives; snap the last thousandth so the
    // loop can actually go idle.
    progressRef.current = Math.abs(next - target) < 1e-3 ? target : next;
    invalidate();
  });

  return null;
}

/**
 * True on devices driven by a mouse or trackpad.
 *
 * Read through `matchMedia` and kept live, because a Surface or an iPad with a
 * keyboard case can change the answer without a reload.
 */
function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return fine;
}

export default BuilderScene;
