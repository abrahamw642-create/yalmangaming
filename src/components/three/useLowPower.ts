"use client";

/**
 * Decides how much 3D this device and this visitor should be given.
 *
 * WebGL is the most expensive thing on the site, so it is opt-out by capability
 * rather than opt-in by hope. Three tiers:
 *
 *   full     — the whole rig: bevelled geometry, baked environment, contact
 *              shadows, animated particles, dpr up to 2.
 *   reduced  — same scene, cheaper: dpr pinned to 1, no ground shadows, coarser
 *              geometry, a fraction of the particles, on-demand rendering.
 *   off      — no canvas at all. `SceneFallback` renders instead.
 *
 * Nothing here is a guess about "is this a nice phone". It reads declared
 * capability and stated preference only.
 */

import * as React from "react";

export type PowerTier = "full" | "reduced" | "off";

export type PowerProfile = {
  tier: PowerTier;
  /** True once the browser has actually been measured (false during SSR). */
  ready: boolean;
  prefersReducedMotion: boolean;
  saveData: boolean;
  lowCores: boolean;
  smallCoarsePointer: boolean;
  slowNetwork: boolean;
  webgl: boolean;
  /** Human-readable list of what pushed the tier down. Useful in dev. */
  reasons: string[];
};

/* -------------------------------------------------------------------------- */
/* Capability probes                                                          */
/* -------------------------------------------------------------------------- */

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function connection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  return nav.connection ?? null;
}

/**
 * Creating a WebGL context is not free, and creating one per mount on a page
 * with several scenes would be wasteful, so the answer is cached for the life
 * of the document. The probe context is explicitly thrown away — browsers cap
 * the number of live contexts and a leaked probe can starve the real canvas.
 */
let webglSupport: boolean | null = null;

function detectWebgl(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (gl) {
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    }
    webglSupport = Boolean(gl);
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const SSR_PROFILE: PowerProfile = {
  // Server-side we claim "off". The scenes are dynamically imported with
  // ssr:false so this branch should never render, but if one ever is imported
  // eagerly the safe answer is the static illustration, not a canvas.
  tier: "off",
  ready: false,
  prefersReducedMotion: false,
  saveData: false,
  lowCores: false,
  smallCoarsePointer: false,
  slowNetwork: false,
  webgl: false,
  reasons: ["server render"],
};

function measure(): PowerProfile {
  if (typeof window === "undefined") return SSR_PROFILE;

  const reasons: string[] = [];

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.matchMedia("(max-width: 767px)").matches;
  const smallCoarsePointer = coarse && small;

  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;
  const lowCores = cores <= 4;

  const net = connection();
  const saveData = net?.saveData === true;
  const slowNetwork =
    net?.effectiveType === "slow-2g" || net?.effectiveType === "2g";

  const webgl = detectWebgl();

  if (prefersReducedMotion) reasons.push("prefers-reduced-motion");
  if (!webgl) reasons.push("no WebGL");
  if (saveData) reasons.push("data saver");
  if (lowCores) reasons.push(`${cores} logical cores`);
  if (smallCoarsePointer) reasons.push("small touch viewport");
  if (slowNetwork) reasons.push(`network ${net?.effectiveType}`);

  // Hard stops. A stated motion preference is a request, not a hint, and a
  // device with no WebGL cannot render at any tier.
  if (prefersReducedMotion || !webgl) {
    return {
      tier: "off",
      ready: true,
      prefersReducedMotion,
      saveData,
      lowCores,
      smallCoarsePointer,
      slowNetwork,
      webgl,
      reasons,
    };
  }

  // Otherwise degrade by weight of evidence: one or two signals means "cheaper
  // scene", three means the device is almost certainly not going to enjoy this.
  const signals =
    (saveData ? 1 : 0) +
    (lowCores ? 1 : 0) +
    (smallCoarsePointer ? 1 : 0) +
    (slowNetwork ? 1 : 0);

  const tier: PowerTier = signals >= 3 ? "off" : signals >= 1 ? "reduced" : "full";

  return {
    tier,
    ready: true,
    prefersReducedMotion,
    saveData,
    lowCores,
    smallCoarsePointer,
    slowNetwork,
    webgl,
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

const QUERIES = [
  "(prefers-reduced-motion: reduce)",
  "(pointer: coarse)",
  "(max-width: 767px)",
];

/**
 * Measures once during the first client render — the scenes are `ssr: false`
 * so there is no server HTML to mismatch — and then re-measures whenever the
 * visitor changes their motion preference, rotates the device across the
 * breakpoint, or the connection changes.
 */
export function useLowPower(): PowerProfile {
  const [profile, setProfile] = React.useState<PowerProfile>(measure);

  React.useEffect(() => {
    let frame = 0;
    const remeasure = () => {
      // Coalesce: an orientation change fires several of these at once.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setProfile(measure()));
    };

    // The very first client render may have happened before hydration settled;
    // measure again so `ready` is always true after mount.
    remeasure();

    const lists = QUERIES.map((query) => window.matchMedia(query));
    for (const list of lists) list.addEventListener("change", remeasure);

    const net = connection();
    net?.addEventListener?.("change", remeasure);

    return () => {
      cancelAnimationFrame(frame);
      for (const list of lists) list.removeEventListener("change", remeasure);
      net?.removeEventListener?.("change", remeasure);
    };
  }, []);

  return profile;
}

/* -------------------------------------------------------------------------- */
/* Visibility                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * True while `ref` intersects the viewport *and* the tab is foregrounded.
 *
 * Every canvas on this site is gated on it: a hero scene that keeps rendering
 * while the visitor is three sections down the page is pure heat. Callers turn
 * this into `frameloop="never"`, which parks the render loop entirely rather
 * than merely rendering a hidden canvas.
 */
export function useOnScreen(
  ref: React.RefObject<HTMLElement | null>,
  rootMargin = "200px",
): boolean {
  const [onScreen, setOnScreen] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let intersecting = false;
    let documentVisible =
      typeof document === "undefined" || document.visibilityState !== "hidden";

    const publish = () => setOnScreen(intersecting && documentVisible);

    if (typeof IntersectionObserver === "undefined") {
      // Without the observer, assume visible rather than never rendering.
      intersecting = true;
      publish();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting);
        publish();
      },
      { rootMargin, threshold: 0 },
    );
    observer.observe(node);

    const onVisibility = () => {
      documentVisible = document.visibilityState !== "hidden";
      publish();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref, rootMargin]);

  return onScreen;
}
