"use client";

/**
 * The cinematic hero: one machine, one continuous scroll.
 *
 * The section is a tall "track". Inside it a single viewport-height stage is
 * pinned with `position: sticky`, so scrolling the track moves the sequence
 * rather than the picture. Scroll position drives `HeroScene`'s
 * `scrollProgress`, the machine comes apart in the order defined by
 * `EXPLODE_PHASES`, and the hero copy cross-fades into a caption rail naming
 * the part that is currently separating. Past the track it resolves into the
 * full-bleed BUILD YOUR DREAM PC panel.
 *
 * Three decisions worth explaining:
 *
 * 1. The whole cinematic layer is gated on `mounted`. Server and first client
 *    render both produce the *static* hero — a normal-flow viewport with the
 *    copy and the drawn fallback — so there is no hydration mismatch and no
 *    WebGL chunk on the critical path. The track only grows afterwards, and it
 *    grows *below* the fold, so nothing visible moves.
 *
 * 2. Reduced motion and the `off` power tier both fall out of the same gate:
 *    no track, no pin, no canvas. The phases become a plain stacked list of
 *    what is inside a machine — the same information, no scroll hijack.
 *
 * 3. Scroll drives MotionValues, not React state. Only two leaves subscribe:
 *    `SceneLayer` (which needs a number for the scene, quantised so a pixel of
 *    scroll cannot re-render it) and `CaptionRail` (which re-renders roughly
 *    seven times over the entire sequence — once per phase).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowDown, Sparkles } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ButtonLink } from "@/components/ui";
import {
  EXPLODE_PHASES,
  SceneFallback,
  phaseAt,
} from "@/components/three/SceneFallback";
import { useLowPower } from "@/components/three/useLowPower";
import { cn } from "@/lib/utils";

/**
 * `ssr: false` is mandatory — the module imports three.js and drei at module
 * scope. The loading state is the same drawn machine the reduced-motion path
 * uses, so the stage never flashes empty.
 */
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => <SceneFallback />,
});

/**
 * Scroll window that maps onto the explode. The head gives the assembled
 * machine a beat before anything moves; the tail holds it fully apart before
 * the track releases.
 */
const EXPLODE_WINDOW: [number, number] = [0.1, 0.9];

export function ScrollExplode({ children }: { children: React.ReactNode }) {
  const track = React.useRef<HTMLDivElement | null>(null);
  const power = useLowPower();
  const reduceMotion = useReducedMotion();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const cinematic =
    mounted && !reduceMotion && power.ready && power.tier !== "off";

  /**
   * The track is short on the first client render — the pin only exists once
   * `cinematic` is known — and grows to several viewports tall a tick later.
   * That is safe: framer re-measures the target's scroll window inside every
   * scroll event rather than caching the one it took when the hook attached.
   */
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
  });

  // 0..1 across the explode itself, independent of how tall the track is.
  const explode = useTransform(scrollYProgress, EXPLODE_WINDOW, [0, 1], {
    clamp: true,
  });

  const copyOpacity = useTransform(scrollYProgress, [0, 0.09], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.09], [0, -40]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0]);

  // One boolean, flipped once: keeps the faded-out CTAs out of the tab order
  // instead of leaving invisible links focusable halfway down the sequence.
  const [copyHidden, setCopyHidden] = React.useState(false);
  useMotionValueEvent(copyOpacity, "change", (value) => {
    setCopyHidden(value < 0.05);
  });

  const hidden = cinematic && copyHidden;

  return (
    <>
      <section
        ref={track}
        aria-label="Yalman Gaming — build the machine you actually want"
        className={cn(
          "relative",
          // The pin only exists once we know the device will enjoy it.
          cinematic && "h-[280vh] md:h-[360vh] lg:h-[420vh]",
        )}
      >
        <div
          className={cn(
            "relative isolate flex w-full items-center overflow-hidden",
            "min-h-[100svh]",
            cinematic && "sticky top-0 h-[100svh]",
          )}
        >
          {/* --- Backdrop ------------------------------------------------ */}
          <div className="grid-bg pointer-events-none absolute inset-0 -z-20 opacity-70" />
          <div className="vignette pointer-events-none absolute inset-0 -z-20" />

          {/* --- The machine --------------------------------------------- */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 -z-10",
              // Beside the type on a wide screen, behind it on a narrow one.
              "lg:left-auto lg:right-[-3%] lg:w-[58%]",
            )}
          >
            <div className="h-full w-full opacity-45 sm:opacity-60 lg:opacity-100">
              {cinematic ? (
                <SceneLayer progress={explode} />
              ) : (
                <SceneFallback />
              )}
            </div>
            {/* Keeps the type legible where the machine sits under it. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-void via-void/70 to-transparent lg:hidden"
            />
          </div>

          {/* --- Type and captions --------------------------------------- */}
          <div className="container-page relative z-10 w-full py-24 sm:py-28">
            <div className="grid w-full lg:w-[54%]">
              <motion.div
                className="col-start-1 row-start-1"
                style={cinematic ? { opacity: copyOpacity, y: copyY } : undefined}
                inert={hidden || undefined}
              >
                {children}
              </motion.div>

              {cinematic && (
                <CaptionRail
                  progress={explode}
                  className="col-start-1 row-start-1"
                />
              )}
            </div>
          </div>

          {/* --- Scroll cue ---------------------------------------------- */}
          {cinematic && (
            <motion.div
              aria-hidden="true"
              style={{ opacity: cueOpacity }}
              className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-2"
            >
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.32em] text-ash">
                Scroll to take it apart
              </span>
              <ArrowDown className="h-4 w-4 animate-bounce text-cyan" />
            </motion.div>
          )}
        </div>

        {/* The same information, stacked, whenever the sequence is off. */}
        {!cinematic && <StackedPhases />}
      </section>

      <ExplodeCta />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Owns the only React state that changes while scrolling. Quantised to three
 * decimals: the scene damps towards its target anyway, so finer resolution
 * would buy nothing but re-renders.
 */
function SceneLayer({ progress }: { progress: MotionValue<number> }) {
  const [value, setValue] = React.useState(0);

  useMotionValueEvent(progress, "change", (next) => {
    const quantised = Math.round(next * 1000) / 1000;
    setValue((current) => (current === quantised ? current : quantised));
  });

  return <HeroScene scrollProgress={value} className="h-full w-full" />;
}

/* -------------------------------------------------------------------------- */
/* Captions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Names the part currently separating. Subscribes to the same MotionValue but
 * only re-renders when the *phase* changes — seven times across the whole
 * sequence rather than once per frame.
 */
function CaptionRail({
  progress,
  className,
}: {
  progress: MotionValue<number>;
  className?: string;
}) {
  const [index, setIndex] = React.useState(-1);

  useMotionValueEvent(progress, "change", (value) => {
    // Below the first threshold nothing has moved yet, so nothing is named.
    const next =
      value <= 0.01 ? -1 : EXPLODE_PHASES.indexOf(phaseAt(value));
    setIndex((current) => (current === next ? current : next));
  });

  const active = index >= 0 ? EXPLODE_PHASES[index] : null;

  return (
    <div
      className={cn("pointer-events-none self-center", className)}
      aria-hidden="true"
    >
      <motion.div
        // Explicit `initial` rather than letting framer infer it from `animate`:
        // the inferred version is applied on the first animation frame, and if
        // that frame is late (a slow first paint, a backgrounded tab) the
        // caption flashes at full opacity across the headline it is supposed to
        // replace. Stated here, it is hidden in the very first paint.
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 16 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-lg"
      >
        <p className="eyebrow">Inside the machine</p>

        <p className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight text-chrome sm:text-5xl">
          {active?.label ?? EXPLODE_PHASES[0].label}
        </p>
        <p className="mt-3 text-base leading-relaxed text-silver sm:text-lg">
          {active?.caption ?? EXPLODE_PHASES[0].caption}
        </p>

        {/* Step ticks — position in the sequence, not a loading bar. */}
        <ol className="mt-7 flex flex-wrap items-center gap-1.5">
          {EXPLODE_PHASES.map((phase, i) => (
            <li
              key={phase.id}
              className={cn(
                "h-1 w-8 rounded-full transition-colors duration-300",
                i < index && "bg-cyan/35",
                i === index && "bg-cyan",
                i > index && "bg-white/10",
              )}
            />
          ))}
        </ol>

        <p className="tnum mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ash">
          {String(Math.max(index, 0) + 1).padStart(2, "0")} /{" "}
          {String(EXPLODE_PHASES.length).padStart(2, "0")}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * The reduced-motion / low-power path. No pin, no canvas, no transform — the
 * phases simply become a list of what is inside the machine we would have
 * taken apart.
 */
function StackedPhases() {
  return (
    <div className="container-page pb-20 md:pb-28">
      <div className="rule-fade mb-12" />
      <p className="eyebrow">Inside the machine</p>
      <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold leading-tight tracking-tight text-chrome sm:text-3xl">
        Every part we fit, chosen for a reason.
      </h2>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPLODE_PHASES.map((phase, i) => (
          <li key={phase.id} className="metal rounded-2xl p-5">
            <p className="tnum font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-cyan">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-2 font-display text-base font-semibold text-chrome">
              {phase.label}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ash">
              {phase.caption}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/** Full-bleed panel the sequence resolves into. */
function ExplodeCta() {
  return (
    <section className="relative isolate overflow-hidden border-y border-[var(--color-line)] bg-carbon">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.28), rgba(168,85,247,0.16) 55%, transparent 72%)",
        }}
      />

      <div className="container-page flex flex-col items-center py-24 text-center md:py-32">
        <p className="eyebrow flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Your parts, your call
        </p>
        <h2 className="mt-5 max-w-4xl font-display text-[clamp(2rem,7vw,4.5rem)] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-chrome-gradient">
          Build your dream PC
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-silver sm:text-lg">
          Pick every component yourself and watch the wattage, the clearances
          and the socket compatibility resolve as you go. We assemble it, test
          it, and hand it over ready to play.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/builder" size="xl" className="w-full sm:w-auto">
            START BUILDING
          </ButtonLink>
          <ButtonLink
            href="/builder/recommend"
            variant="secondary"
            size="xl"
            className="w-full sm:w-auto"
          >
            HELP ME CHOOSE
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export default ScrollExplode;
