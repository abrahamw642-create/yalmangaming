"use client";

/**
 * Shared 3D furniture — lighting, environment, materials, geometry helpers.
 *
 * NEVER import this from a Server Component. It pulls in three.js and drei at
 * module scope. The two entry points (`HeroScene`, `BuilderScene`) are the only
 * things callers should touch, and they must be brought in with
 * `dynamic(() => import(...), { ssr: false })`.
 *
 * Everything HeroScene and BuilderScene have in common lives here so the two
 * views are lit identically — a machine on the homepage and the same machine in
 * the builder should look like the same object photographed in the same studio.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/* ========================================================================== */
/* Units and camera                                                           */
/* ========================================================================== */

/**
 * Scene units are decimetres: 1 unit = 100 mm. Every real dimension we hold
 * (gpuLengthMm, coolerHeightMm, radiatorSizeMm…) is millimetres, so converting
 * is a single multiply and the scene stays at a scale where the default camera
 * near/far planes and light falloff behave sensibly.
 */
export const MM = 0.01;

/** Millimetres to scene units. */
export const mm = (value: number) => value * MM;

/**
 * Both canvases frame the machine the same way: a front-three-quarter view from
 * the glass side, slightly above centre. The case sits centred on the origin so
 * it rotates about its own middle rather than swinging around a floor pivot.
 *
 * The azimuth is weighted toward −X on purpose. Everything worth looking at is
 * behind the tempered-glass panel, so the view has to favour that face over the
 * mesh front — an even 45° reads as "a box" because the front, which is mostly
 * a blank grille, takes half the frame.
 */
export const SCENE_CAMERA = {
  fov: 32,
  near: 0.4,
  far: 60,
  position: [-7.4, 2.1, 6.9] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
};

/* ========================================================================== */
/* Quality tier                                                               */
/* ========================================================================== */

export type Quality = "full" | "reduced";

const QualityContext = React.createContext<Quality>("full");

export function useQuality(): Quality {
  return React.useContext(QualityContext);
}

/** Pick a segment count / instance count per tier. */
export function detail(quality: Quality, full: number, reduced: number): number {
  return quality === "full" ? full : reduced;
}

/**
 * Pointer position in normalised device space (-1..1), tracked on the window by
 * the scene wrapper rather than by R3F. The canvases are `pointer-events: none`
 * so the hero can sit behind real text and still react to the cursor.
 */
export type PointerRef = React.RefObject<THREE.Vector2>;

/* ========================================================================== */
/* Maths                                                                      */
/* ========================================================================== */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = clamp01(span === 0 ? (x >= edge1 ? 1 : 0) : (x - edge0) / span);
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent exponential approach. `lambda` is roughly "how many
 * e-foldings per second" — 4 is brisk, 1.5 is languid. Using this instead of
 * `lerp(a, b, 0.1)` is what keeps the motion identical on a 60 Hz laptop and a
 * 165 Hz monitor.
 */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

/** Damps a vector toward a target in place. Returns the largest axis delta. */
export function dampVec3(
  v: THREE.Vector3,
  tx: number,
  ty: number,
  tz: number,
  lambda: number,
  dt: number,
): number {
  const dx = tx - v.x;
  const dy = ty - v.y;
  const dz = tz - v.z;
  v.x = damp(v.x, tx, lambda, dt);
  v.y = damp(v.y, ty, lambda, dt);
  v.z = damp(v.z, tz, lambda, dt);
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}

/* ========================================================================== */
/* Disposal                                                                   */
/* ========================================================================== */

type Disposable = { dispose: () => void };

/**
 * Memoised resource that is released when the component unmounts or the deps
 * change. R3F disposes objects it constructs from JSX, but geometries and
 * materials we build imperatively and hand over as *props* are ours to clean
 * up — without this a route change leaks every buffer on the GPU.
 */
export function useDisposable<T extends Disposable>(
  factory: () => T,
  deps: React.DependencyList,
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = React.useMemo(factory, deps);
  React.useEffect(() => () => value.dispose(), [value]);
  return value;
}

/** Same contract for a fixed-shape record of resources. */
export function useDisposableSet<T extends Record<string, Disposable>>(
  factory: () => T,
  deps: React.DependencyList,
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = React.useMemo(factory, deps);
  React.useEffect(
    () => () => {
      for (const item of Object.values(value)) item.dispose();
    },
    [value],
  );
  return value;
}

/* ========================================================================== */
/* Geometry helpers                                                           */
/* ========================================================================== */

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * A box with softened edges, centred on its own origin.
 *
 * Hardware reads as *manufactured* mainly because of how its edges catch a
 * highlight; a plain BoxGeometry looks like a placeholder no matter how good
 * the material is. Below ~2 mm of radius the bevel is invisible, so we fall
 * back to a plain box and save the extrusion.
 */
export function roundedBoxGeometry(
  w: number,
  h: number,
  d: number,
  radius = 0.02,
  smoothness = 2,
): THREE.BufferGeometry {
  const r = Math.min(radius, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  if (!(r > 0.002)) return new THREE.BoxGeometry(w, h, d);

  const shape = roundedRectShape(w - r * 2, h - r * 2, r * 0.999);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-3, d - r * 2),
    curveSegments: smoothness,
    bevelEnabled: true,
    bevelSegments: smoothness,
    bevelSize: r,
    bevelThickness: r,
    steps: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export type RectHole = { x: number; y: number; w: number; h: number; r?: number };
export type CircleHole = { x: number; y: number; radius: number };

/**
 * A flat plate in the XY plane with rectangular and circular cut-outs, extruded
 * along Z. Used for the rear panel (I/O aperture, expansion slots, fan grille)
 * and for fan frames — cutting real holes rather than faking them with dark
 * paint is what sells the chassis as sheet metal.
 */
export function platedGeometry(
  w: number,
  h: number,
  thickness: number,
  opts: {
    cornerRadius?: number;
    rects?: RectHole[];
    circles?: CircleHole[];
    segments?: number;
  } = {},
): THREE.BufferGeometry {
  const { cornerRadius = 0.02, rects = [], circles = [], segments = 8 } = opts;
  const shape = roundedRectShape(w, h, Math.min(cornerRadius, w / 2, h / 2));

  for (const hole of rects) {
    const r = Math.min(hole.r ?? 0.008, hole.w / 2 - 1e-4, hole.h / 2 - 1e-4);
    const path = new THREE.Path();
    const x = hole.x - hole.w / 2;
    const y = hole.y - hole.h / 2;
    path.moveTo(x + r, y);
    path.lineTo(x + hole.w - r, y);
    path.quadraticCurveTo(x + hole.w, y, x + hole.w, y + r);
    path.lineTo(x + hole.w, y + hole.h - r);
    path.quadraticCurveTo(x + hole.w, y + hole.h, x + hole.w - r, y + hole.h);
    path.lineTo(x + r, y + hole.h);
    path.quadraticCurveTo(x, y + hole.h, x, y + hole.h - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
    shape.holes.push(path);
  }

  for (const hole of circles) {
    const path = new THREE.Path();
    // Holes must wind opposite to the outline, hence clockwise = true.
    path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ========================================================================== */
/* Materials                                                                  */
/* ========================================================================== */

export type SceneMaterials = {
  /** Painted steel chassis. */
  chassis: THREE.MeshStandardMaterial;
  /** Brighter machined edge / bracket metal. */
  chassisEdge: THREE.MeshStandardMaterial;
  /** Matte interior panel, tray, shroud. */
  panel: THREE.MeshStandardMaterial;
  /** Perforated front / top mesh — thin and see-through. */
  perforated: THREE.MeshStandardMaterial;
  /** Smoked tempered side panel. */
  glass: THREE.MeshPhysicalMaterial;
  pcb: THREE.MeshStandardMaterial;
  pcbLight: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  aluminium: THREE.MeshStandardMaterial;
  aluminiumDark: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  plastic: THREE.MeshStandardMaterial;
  blade: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  label: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  /** Steady cyan status light — used when RGB is switched off. */
  accent: THREE.MeshStandardMaterial;
  /** Three RGB zones, hue-offset from each other and driven by `Rig`. */
  rgb: [
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
  ];
};

const MaterialsContext = React.createContext<SceneMaterials | null>(null);

export function useMaterials(): SceneMaterials {
  const materials = React.useContext(MaterialsContext);
  if (!materials) {
    throw new Error("useMaterials must be used inside <Rig>.");
  }
  return materials;
}

function createMaterials(quality: Quality): SceneMaterials {
  const std = (
    params: THREE.MeshStandardMaterialParameters,
  ): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial(params);

  const rgbZone = (hue: number) =>
    std({
      color: "#05070c",
      emissive: new THREE.Color().setHSL(hue, 0.85, 0.55),
      emissiveIntensity: 2.2,
      metalness: 0.1,
      roughness: 0.35,
      // Emissive strips are the one thing allowed to clip past white: without
      // post-processing bloom, un-tonemapped emission is what reads as "lit".
      toneMapped: false,
    });

  return {
    // Powder-coated steel is a DIELECTRIC with a dark pigment, not a dark
    // metal. Metals take their specular colour from the base colour, so a near
    // black chassis at metalness ~0.9 reflects about one percent of the studio
    // and renders as a silhouette. Keeping metalness low and letting the
    // clear-ish specular do the work is what makes the panels read as painted
    // sheet rather than as a hole in the page.
    chassis: std({ color: "#20252f", metalness: 0.4, roughness: 0.38 }),
    // Bare machined edges and brackets genuinely are metal, so they get the
    // high metalness — and the light base colour that has to come with it.
    chassisEdge: std({ color: "#8792a6", metalness: 0.95, roughness: 0.26 }),
    panel: std({ color: "#181d27", metalness: 0.25, roughness: 0.62 }),
    perforated: std({
      color: "#141922",
      metalness: 0.35,
      roughness: 0.5,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      // Real `transmission` forces the renderer into a second full scene pass
      // every frame. A tinted, very smooth, clear-coated surface reflecting the
      // environment reads as tempered glass for a fraction of the cost.
      color: "#0a1018",
      metalness: 0,
      roughness: 0.045,
      transparent: true,
      opacity: 0.17,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    // A real motherboard is matte black. Rendered at its true albedo against a
    // near-black page it disappears entirely, so every dark dielectric here is
    // lifted to roughly the value a black object *reads* as under studio light.
    pcb: std({ color: "#1e2c3a", metalness: 0.15, roughness: 0.55 }),
    pcbLight: std({ color: "#2a3646", metalness: 0.15, roughness: 0.5 }),
    gold: std({ color: "#c9a24d", metalness: 1, roughness: 0.34 }),
    aluminium: std({ color: "#a3adbe", metalness: 1, roughness: 0.26 }),
    // Anodised heatsinks and shrouds. Still obviously metal, but light enough
    // to catch the rim lights instead of swallowing them.
    aluminiumDark: std({ color: "#6d7688", metalness: 1, roughness: 0.34 }),
    copper: std({ color: "#b26b3c", metalness: 1, roughness: 0.3 }),
    plastic: std({ color: "#262c38", metalness: 0.1, roughness: 0.48 }),
    blade: std({
      color: "#333b4a",
      metalness: 0.05,
      roughness: 0.66,
      side: THREE.DoubleSide,
    }),
    chrome: std({
      color: "#ced5e3",
      metalness: 1,
      roughness: quality === "full" ? 0.1 : 0.2,
    }),
    label: std({ color: "#dde4f0", metalness: 0, roughness: 0.9 }),
    rubber: std({ color: "#171b24", metalness: 0, roughness: 0.9 }),
    accent: std({
      color: "#04070c",
      emissive: "#22d3ee",
      emissiveIntensity: 2,
      roughness: 0.4,
      toneMapped: false,
    }),
    rgb: [rgbZone(0.52), rgbZone(0.72), rgbZone(0.9)],
  };
}

/* ========================================================================== */
/* Rig                                                                        */
/* ========================================================================== */

export type RigProps = {
  quality: Quality;
  /** Animate the RGB zones. When false they hold a steady cyan. */
  rgb?: boolean;
  /** Pointer, if the scene tracks one. RGB hue and fill lights follow it. */
  pointerRef?: PointerRef | null;
  /** World Y of the surface the machine stands on. */
  floorY?: number;
  /** Ground shadow footprint, in scene units. */
  shadowScale?: number;
  contactShadows?: boolean;
  /** Points inside the chassis for the animated RGB lights to occupy. */
  interior?: [number, number, number][];
  children?: React.ReactNode;
};

const HUE_SPREAD = 0.085;

/** Reused in the render loop; allocating a Color per frame is not free. */
const WHITE = /* @__PURE__ */ new THREE.Color(1, 1, 1);

/**
 * Lighting, environment and shared materials for both scenes.
 *
 * The environment is a *procedural* studio: drei's `Environment` renders the
 * `<Lightformer>` children into a cube render target once (`frames={1}`) and
 * uses it as the scene's envMap. Passing a named `preset` instead would fetch
 * six PNGs from raw.githack.com — a third-party CDN request on every homepage
 * view, and a broken-looking scene the moment that host is unreachable. Baking
 * our own costs one extra frame at mount and never touches the network.
 */
export function Rig({
  quality,
  rgb = true,
  pointerRef = null,
  floorY = -2.4,
  shadowScale = 11,
  contactShadows = true,
  interior = [],
  children,
}: RigProps) {
  const materials = React.useMemo(() => createMaterials(quality), [quality]);

  React.useEffect(
    () => () => {
      for (const value of Object.values(materials)) {
        if (Array.isArray(value)) value.forEach((m) => m.dispose());
        else value.dispose();
      }
    },
    [materials],
  );

  const lightsRef = React.useRef<THREE.Group>(null);
  const rgbLights = React.useRef<THREE.PointLight[]>([]);
  const scratch = React.useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const px = pointerRef?.current?.x ?? 0;
    const py = pointerRef?.current?.y ?? 0;

    // Hue drifts slowly on its own and is *nudged* by the pointer, so the rig
    // feels responsive without the colour snapping around under the cursor.
    const base = rgb ? (t * 0.04 + px * 0.14 + 1) % 1 : 0.5;
    const lift = 1 + py * 0.18;

    for (let i = 0; i < materials.rgb.length; i++) {
      const zone = materials.rgb[i];
      if (rgb) {
        scratch.setHSL((base + i * HUE_SPREAD) % 1, 0.88, 0.56);
      } else {
        scratch.setHex(0x22d3ee);
      }
      zone.emissive.lerp(scratch, 1 - Math.exp(-6 * dt));
      zone.emissiveIntensity = damp(
        zone.emissiveIntensity,
        2.2 * lift,
        4,
        dt,
      );
    }

    for (let i = 0; i < rgbLights.current.length; i++) {
      const light = rgbLights.current[i];
      if (!light) continue;
      const zone = materials.rgb[i % materials.rgb.length];
      // The strips themselves stay fully saturated, but their spill is pulled
      // a third of the way to white. Fully saturated bounce turns every metal
      // surface inside the case pink or lime, and the brief is that neon is an
      // accent, not a wash.
      light.color.copy(zone.emissive).lerp(WHITE, 0.34);
      light.intensity = damp(light.intensity, (rgb ? 7.5 : 6) * lift, 4, dt);
    }

    // The whole light group leans a few degrees with the pointer, which moves
    // the specular highlights across the metal instead of the light itself.
    if (lightsRef.current) {
      lightsRef.current.rotation.y = damp(
        lightsRef.current.rotation.y,
        px * 0.22,
        2.5,
        dt,
      );
      lightsRef.current.rotation.x = damp(
        lightsRef.current.rotation.x,
        -py * 0.1,
        2.5,
        dt,
      );
    }
  });

  const envResolution = detail(quality, 128, 64);

  return (
    <QualityContext.Provider value={quality}>
      <MaterialsContext.Provider value={materials}>
        <group ref={lightsRef}>
          <ambientLight intensity={1.1} color="#8091ad" />
          {/* Key: cool, high and to the glass side. */}
          <directionalLight
            position={[-7, 9, 6]}
            intensity={3.4}
            color="#e2ecff"
          />
          {/* Fill from the tray side keeps the far edge from going black.
              Nothing casts shadows here, so the fill reaches the interior
              through the chassis walls — which is exactly what is wanted: a
              closed box lit only by its own RGB reads as a black rectangle. */}
          <directionalLight
            position={[8, 2.5, -4]}
            intensity={1.3}
            color="#5a6d94"
          />
          {/* Low front bounce: without it the underside of the graphics card
              and the floor of the chassis fall away to nothing. */}
          <directionalLight
            position={[-2, -5, 7]}
            intensity={0.7}
            color="#3b5170"
          />
          {/* Rim accents. These are the "coloured point lights instead of
              bloom" the design calls for: cheap, and they separate the chassis
              silhouette from a dark page background. */}
          <pointLight
            position={[-6, 1.4, -3.4]}
            intensity={26}
            distance={18}
            decay={2}
            color="#22d3ee"
          />
          <pointLight
            position={[5.5, 3.2, 3]}
            intensity={16}
            distance={16}
            decay={2}
            color="#a855f7"
          />
        </group>

        {interior.map((position, i) => (
          <pointLight
            key={i}
            ref={(node) => {
              if (node) rgbLights.current[i] = node;
            }}
            position={position}
            intensity={12}
            distance={6}
            decay={2}
          />
        ))}

        <Environment resolution={envResolution} frames={1}>
          <color attach="background" args={["#05070c"]} />
          {/* Broad soft box overhead — the main source of the brushed sheen. */}
          <Lightformer
            form="rect"
            intensity={6}
            color="#e8f0ff"
            scale={[9, 4, 1]}
            position={[0, 6, 1]}
            rotation={[Math.PI / 2, 0, 0]}
            toneMapped={false}
          />
          {/* Vertical strips either side give metal a long directional streak. */}
          <Lightformer
            form="rect"
            intensity={3.6}
            color="#9fd7ff"
            scale={[1, 7, 1]}
            position={[-7, 1, 2]}
            rotation={[0, Math.PI / 2, 0]}
            toneMapped={false}
          />
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#b98cff"
            scale={[1, 6, 1]}
            position={[7, 1.5, -1]}
            rotation={[0, -Math.PI / 2, 0]}
            toneMapped={false}
          />
          <Lightformer
            form="circle"
            intensity={2.4}
            color="#ffd9b0"
            scale={2.4}
            position={[2, -3, -6]}
            rotation={[0, Math.PI, 0]}
            toneMapped={false}
          />
        </Environment>

        {contactShadows && quality === "full" && (
          <ContactShadows
            position={[0, floorY, 0]}
            scale={shadowScale}
            resolution={256}
            blur={2.8}
            opacity={0.62}
            far={4.5}
            color="#000610"
          />
        )}

        {children}
      </MaterialsContext.Provider>
    </QualityContext.Provider>
  );
}
