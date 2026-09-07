"use client";

/**
 * The dust field behind the hero machine.
 *
 * Client-only, like everything in this folder: import it from a scene that is
 * itself brought in with `dynamic(..., { ssr: false })`, never from a Server
 * Component.
 *
 * One `THREE.Points` draw call for the whole field. The per-particle drift,
 * parallax and twinkle all happen in the vertex shader, so the render loop
 * touches exactly two uniforms per frame and never walks the buffer — a JS loop
 * over a few hundred particles is affordable but it is the kind of cost that
 * silently becomes the frame budget once a page has two canvases on it.
 *
 * Parallax is depth-weighted: the particles nearest the camera swing furthest
 * with the pointer. That is what turns a flat sprinkle of dots into a field the
 * machine appears to sit inside.
 */

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { type PointerRef, damp, useDisposable } from "./Rig";

export type ParticlesProps = {
  count?: number;
  pointerRef?: PointerRef | null;
  /** Half-extents of the field on X and Y, scene units. */
  spread?: [number, number];
  /** Near and far Z. Both negative: the field lives behind the machine. */
  depth?: [near: number, far: number];
  /** Two accent colours the field mixes between. */
  colors?: [string, string];
  /** World-space diameter of the largest particle. */
  size?: number;
  /**
   * 1 = drift and twinkle, 0 = a still field that only parallaxes. The reduced
   * power tier passes 0 so a `frameloop="demand"` canvas is not forced to
   * render continuously just to move dust.
   */
  motion?: number;
  opacity?: number;
};

const VERTEX = /* glsl */ `
  attribute float aScale;
  attribute float aSeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uSize;
  uniform float uMotion;
  uniform float uScale;
  uniform vec2 uPointer;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float phase = aSeed * 6.2831853;

    p.y += sin(uTime * 0.33 + phase) * 0.42 * uMotion;
    p.x += cos(uTime * 0.21 + phase * 1.7) * 0.34 * uMotion;

    // 0 at the back of the field, 1 at the front. Drives both the parallax
    // amount and how bright a particle reads, so depth is legible.
    float near = clamp((p.z - uFar) / max(0.001, uNear - uFar), 0.0, 1.0);

    p.x += uPointer.x * (0.30 + near * 1.25);
    p.y += uPointer.y * (0.18 + near * 0.72);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * aScale * (uScale / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;

    vColor = aColor;
    float twinkle = mix(1.0, 0.55 + 0.45 * sin(uTime * 0.72 + phase * 3.0), uMotion);
    vAlpha = (0.16 + 0.66 * near) * twinkle;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Round the square point sprite off without paying for a texture.
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;

    float a = vAlpha * uOpacity * smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(vColor, a);

    // ShaderMaterial does not get the colour-space conversion for free the way
    // a built-in material does; without this the accents come out washed.
    #include <colorspace_fragment>
  }
`;

export function Particles({
  count = 420,
  pointerRef = null,
  spread = [9, 5.2],
  depth = [-2.5, -15],
  colors = ["#22d3ee", "#a855f7"],
  size = 0.075,
  motion = 1,
  opacity = 1,
}: ParticlesProps) {
  const [near, far] = depth;
  const [spreadX, spreadY] = spread;
  const smoothed = React.useMemo(() => new THREE.Vector2(), []);
  const invalidate = useThree((state) => state.invalidate);

  const geometry = useDisposable(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);
    const tint = new Float32Array(count * 3);

    // `THREE.Color` from a hex string is already in the renderer's linear
    // working space, so these values can go straight into the attribute.
    const a = new THREE.Color(colors[0]);
    const b = new THREE.Color(colors[1]);
    const mixed = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Biased toward the back of the field so the near particles stay sparse
      // and never crowd the machine.
      const t = Math.random() ** 0.55;
      const z = near + (far - near) * t;

      positions[i * 3] = (Math.random() * 2 - 1) * spreadX;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * spreadY;
      positions[i * 3 + 2] = z;

      scales[i] = 0.35 + Math.random() ** 2 * 1.35;
      seeds[i] = Math.random();

      mixed.copy(a).lerp(b, Math.random() ** 1.6);
      tint[i * 3] = mixed.r;
      tint[i * 3 + 1] = mixed.g;
      tint[i * 3 + 2] = mixed.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(tint, 3));
    // The field never moves as a whole, so a fixed sphere spares the renderer
    // recomputing bounds and stops frustum culling popping it in and out.
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, (near + far) / 2),
      Math.hypot(spreadX, spreadY, (near - far) / 2) + 2,
    );
    return geo;
  }, [count, spreadX, spreadY, near, far, colors[0], colors[1]]);

  const material = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        // `uNear`/`uFar` are compile-time constants rather than uniforms: the
        // field's depth never changes at runtime, and folding them in lets the
        // GPU constant-fold the parallax weight.
        vertexShader: `const float uNear = ${near.toFixed(4)};\nconst float uFar = ${far.toFixed(4)};\n${VERTEX}`,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: size },
          uMotion: { value: motion },
          uOpacity: { value: opacity },
          uScale: { value: 500 },
          uPointer: { value: new THREE.Vector2() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [near, far],
  );

  // Sizes, colours and motion can change without rebuilding the program.
  React.useEffect(() => {
    material.uniforms.uSize.value = size;
    material.uniforms.uMotion.value = motion;
    material.uniforms.uOpacity.value = opacity;
    invalidate();
  }, [material, size, motion, opacity, invalidate]);

  useFrame((state, dt) => {
    const uniforms = material.uniforms;

    // `gl_PointSize` is in device pixels, so the world-to-pixel factor has to
    // track the actual drawing buffer — not the CSS size, and not a constant.
    uniforms.uScale.value = state.gl.domElement.height * 0.5;

    if (motion > 0) uniforms.uTime.value = state.clock.elapsedTime;

    const target = pointerRef?.current;
    if (target) {
      const before = smoothed.x;
      smoothed.x = damp(smoothed.x, target.x, 2.4, dt);
      smoothed.y = damp(smoothed.y, target.y, 2.4, dt);
      uniforms.uPointer.value.copy(smoothed);
      // Keep a demand-driven canvas alive while the field is still settling.
      if (Math.abs(smoothed.x - before) > 1e-4) invalidate();
    }
  });

  return (
    <points geometry={geometry}>
      <primitive object={material} attach="material" />
    </points>
  );
}

export default Particles;
