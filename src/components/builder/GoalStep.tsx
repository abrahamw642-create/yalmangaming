"use client";

/**
 * Step 1 — what the machine is for.
 *
 * Nothing here is mandatory. It shapes the guidance elsewhere in the builder
 * (budget framing, the target line in the summary, the WhatsApp message) but a
 * customer who knows exactly what they want can skip straight to the parts.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Box,
  BrainCircuit,
  Briefcase,
  Check,
  Clapperboard,
  Crosshair,
  Gamepad2,
  Radio,
  SlidersHorizontal,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { useBuild } from "@/lib/build-store";
import {
  BUILD_GOALS,
  FPS_TARGETS,
  POPULAR_GAMES,
  RESOLUTIONS,
  type BuildGoal,
  type TargetFps,
  type TargetResolution,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const GOAL_ICONS: Record<BuildGoal, LucideIcon> = {
  gaming: Gamepad2,
  competitive: Crosshair,
  streaming: Radio,
  "gaming-streaming": Tv,
  editing: Clapperboard,
  rendering: Box,
  ai: BrainCircuit,
  office: Briefcase,
  custom: SlidersHorizontal,
};

const RESOLUTION_NOTE: Record<TargetResolution, string> = {
  "1080p": "1920 × 1080 — easiest to drive, highest frame rates",
  "1440p": "2560 × 1440 — the sweet spot for most gaming builds",
  "4K": "3840 × 2160 — sharpest image, needs the most GPU",
};

export function GoalStep({ onNext }: { onNext?: () => void }) {
  const {
    build,
    setGoal,
    setResolution,
    setTargetFps,
    setGames,
    setName,
  } = useBuild();
  const reduceMotion = useReducedMotion();

  const toggleGame = (game: string) => {
    setGames(
      build.games.includes(game)
        ? build.games.filter((g) => g !== game)
        : [...build.games, game],
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="eyebrow mb-3">Step 01 · Purpose</p>
        <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-chrome-gradient sm:text-4xl">
          What is this machine for?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">
          This shapes the guidance you get as you pick parts. You can change it
          at any point, or skip it entirely and go straight to the components.
        </p>
      </header>

      {/* --- Goal ----------------------------------------------------------- */}
      <section aria-labelledby="goal-heading">
        <h3 id="goal-heading" className="sr-only">
          Primary use
        </h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {BUILD_GOALS.map((goal) => {
            const Icon = GOAL_ICONS[goal.id];
            const active = build.goal === goal.id;
            return (
              <motion.button
                key={goal.id}
                type="button"
                onClick={() => setGoal(active ? null : goal.id)}
                aria-pressed={active}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                className={cn(
                  "group relative flex items-start gap-3 rounded-2xl border p-4 text-left",
                  "transition-colors duration-200",
                  active
                    ? "border-cyan/45 bg-cyan/[0.07]"
                    : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    active
                      ? "border-cyan/40 bg-cyan/15 text-cyan"
                      : "border-line bg-white/[0.03] text-ash group-hover:text-silver",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-chrome">
                      {goal.label}
                    </span>
                    {active && (
                      <Check className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-silver">
                    {goal.description}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* --- Resolution ----------------------------------------------------- */}
      <section aria-labelledby="resolution-heading">
        <h3
          id="resolution-heading"
          className="font-display text-lg font-semibold text-chrome"
        >
          Target resolution
        </h3>
        <p className="mt-1 text-sm text-silver">
          The resolution you will actually play at decides how much graphics
          card the build needs.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {RESOLUTIONS.map((res) => {
            const active = build.resolution === res;
            return (
              <button
                key={res}
                type="button"
                onClick={() => setResolution(active ? null : res)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors",
                  active
                    ? "border-cyan/45 bg-cyan/[0.07]"
                    : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <span
                  className={cn(
                    "font-display text-lg font-bold tracking-tight",
                    active ? "text-cyan" : "text-chrome",
                  )}
                >
                  {res}
                </span>
                <span className="text-xs leading-relaxed text-ash">
                  {RESOLUTION_NOTE[res]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Frame rate ------------------------------------------------------ */}
      <section aria-labelledby="fps-heading">
        <h3
          id="fps-heading"
          className="font-display text-lg font-semibold text-chrome"
        >
          Frame rate you are aiming for
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {FPS_TARGETS.map((target) => {
            const active = build.targetFps === target.value;
            return (
              <button
                key={target.value}
                type="button"
                onClick={() =>
                  setTargetFps(active ? null : (target.value as TargetFps))
                }
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border p-3.5 text-left transition-colors",
                  active
                    ? "border-cyan/45 bg-cyan/[0.07]"
                    : "border-line bg-white/[0.02] hover:border-line-strong",
                )}
              >
                <span
                  className={cn(
                    "tnum font-display text-base font-bold",
                    active ? "text-cyan" : "text-chrome",
                  )}
                >
                  {target.label}
                </span>
                <span className="text-[0.6875rem] leading-snug text-ash">
                  {target.note}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Games ----------------------------------------------------------- */}
      <section aria-labelledby="games-heading">
        <h3
          id="games-heading"
          className="font-display text-lg font-semibold text-chrome"
        >
          What will you play?
        </h3>
        <p className="mt-1 text-sm text-silver">
          Optional. We pass this along with your configuration so our bench
          knows what the machine has to handle.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {POPULAR_GAMES.map((game) => {
            const active = build.games.includes(game);
            return (
              <button
                key={game}
                type="button"
                onClick={() => toggleGame(game)}
                aria-pressed={active}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-xs font-medium transition-colors",
                  active
                    ? "border-violet/45 bg-violet/12 text-violet"
                    : "border-line bg-white/[0.02] text-silver hover:border-line-strong hover:text-chrome",
                )}
              >
                {game}
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Name ------------------------------------------------------------ */}
      <section>
        <label
          htmlFor="build-name"
          className="font-display text-lg font-semibold text-chrome"
        >
          Name this build
        </label>
        <p className="mt-1 text-sm text-silver">
          So you recognise it when you share the link or come into the shop.
        </p>
        <input
          id="build-name"
          type="text"
          value={build.name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            // The placeholder name is scaffolding, not a choice — clear it the
            // moment someone actually wants to name their machine.
            if (e.target.value === "Untitled Build") setName("");
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) setName("Untitled Build");
          }}
          placeholder="e.g. 1440p Warzone Rig"
          className={cn(
            "mt-4 h-12 w-full max-w-md rounded-xl border border-line bg-carbon px-4",
            "font-display text-base text-chrome placeholder:text-ash",
            "focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40",
          )}
        />
      </section>

      {onNext && (
        <div>
          <button
            type="button"
            onClick={onNext}
            className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash transition-colors hover:text-cyan"
          >
            Skip — I know what I want →
          </button>
        </div>
      )}
    </div>
  );
}
