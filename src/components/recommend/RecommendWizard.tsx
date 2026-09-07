"use client";

/**
 * The guided recommendation flow.
 *
 * Purpose → budget → games → resolution → frame rate → build. Five questions,
 * one per screen, because this exists for the customer who does not want to
 * pick parts: someone who already knows what they want goes to `/builder`.
 *
 * The wizard collects answers and nothing else. Every decision — which parts,
 * whether they fit together, what it costs — happens server-side in
 * `/api/recommend`, so the browser never holds a price or a compatibility
 * verdict it could be wrong about.
 */

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  BrainCircuit,
  Briefcase,
  Check,
  Clapperboard,
  Crosshair,
  Gamepad2,
  Plus,
  Radio,
  SlidersHorizontal,
  Tv,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { RecommendationResult } from "./RecommendationResult";
import type { PerformanceReport } from "@/lib/benchmarks";
import type { Recommendation } from "@/lib/recommend";
import {
  BUDGET_BANDS,
  BUILD_GOALS,
  FPS_TARGETS,
  POPULAR_GAMES,
  RESOLUTIONS,
  type BuildGoal,
  type TargetFps,
  type TargetResolution,
} from "@/lib/types";
import { cn, formatPKR, formatShortPKR } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Step model                                                                 */
/* -------------------------------------------------------------------------- */

type StepId = "goal" | "budget" | "games" | "resolution" | "fps" | "result";

const QUESTION_STEPS: { id: Exclude<StepId, "result">; label: string }[] = [
  { id: "goal", label: "Purpose" },
  { id: "budget", label: "Budget" },
  { id: "games", label: "Games" },
  { id: "resolution", label: "Resolution" },
  { id: "fps", label: "Frame rate" },
];

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

/** Nothing in the catalogue adds up to a working PC below this. */
const MIN_BUDGET_PKR = 60_000;
const MAX_BUDGET_PKR = 5_000_000;
const MAX_GAMES = 12;

/**
 * A typed figure is a ceiling, not a target. Treating it as a narrow band means
 * the engine spends most of it rather than handing back a machine and change.
 */
const CUSTOM_BUDGET_FLOOR_RATIO = 0.9;

type Answers = {
  goal: BuildGoal | null;
  /** A `BUDGET_BANDS` id, or `"custom"` when a figure was typed. */
  budgetId: string | null;
  budgetMin: number | null;
  /** `null` is a real answer — it is how the open-ended band arrives. */
  budgetMax: number | null;
  games: string[];
  resolution: TargetResolution | null;
  targetFps: TargetFps | null;
};

const EMPTY_ANSWERS: Answers = {
  goal: null,
  budgetId: null,
  budgetMin: null,
  budgetMax: null,
  games: [],
  resolution: null,
  targetFps: null,
};

function isAnswered(step: Exclude<StepId, "result">, answers: Answers): boolean {
  switch (step) {
    case "goal":
      return answers.goal !== null;
    case "budget":
      return answers.budgetId !== null;
    case "games":
      // Optional: a customer who plays everything should not be blocked here.
      return true;
    case "resolution":
      return answers.resolution !== null;
    case "fps":
      return answers.targetFps !== null;
  }
}

/* -------------------------------------------------------------------------- */
/* Wizard                                                                     */
/* -------------------------------------------------------------------------- */

type ApiResponse = {
  recommendation: Recommendation;
  performance: PerformanceReport;
};

export function RecommendWizard({ className }: { className?: string }) {
  const [step, setStep] = React.useState<StepId>("goal");
  const [answers, setAnswers] = React.useState<Answers>(EMPTY_ANSWERS);
  const [result, setResult] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Bumped by "Try again" so the effect re-runs on unchanged answers. */
  const [retryToken, setRetryToken] = React.useState(0);

  const headingRef = React.useRef<HTMLDivElement | null>(null);
  const hasMoved = React.useRef(false);

  const update = React.useCallback((patch: Partial<Answers>) => {
    // Any change invalidates the answer we were given for the old one.
    setResult(null);
    setAnswers((previous) => ({ ...previous, ...patch }));
  }, []);

  // Move focus to the new question so a keyboard or screen-reader user is not
  // left at the bottom of the page after pressing Next.
  React.useEffect(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const requestKey = React.useMemo(
    () =>
      JSON.stringify({
        goal: answers.goal,
        budgetMin: answers.budgetMin,
        budgetMax: answers.budgetMax,
        resolution: answers.resolution,
        targetFps: answers.targetFps,
        games: answers.games,
      }),
    [answers],
  );

  const fetchedKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (step !== "result") return;
    if (fetchedKey.current === requestKey && result) return;
    if (!answers.goal || !answers.resolution || !answers.targetFps) return;

    const controller = new AbortController();
    fetchedKey.current = requestKey;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            goal: answers.goal,
            budgetMin: answers.budgetMin ?? 0,
            budgetMax: answers.budgetMax,
            resolution: answers.resolution,
            targetFps: answers.targetFps,
            games: answers.games,
          }),
        });
        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? String((data as { error: unknown }).error)
              : "Could not put a build together just now.";
          fetchedKey.current = null;
          setError(message);
          return;
        }

        setResult(data as ApiResponse);
      } catch {
        if (controller.signal.aborted) return;
        fetchedKey.current = null;
        setError("Network error. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [step, requestKey, answers, result, retryToken]);

  const index = QUESTION_STEPS.findIndex((s) => s.id === step);
  // Kept as the step object rather than a boolean so `question.id` narrows to
  // the question steps and cannot be `"result"`.
  const question = index === -1 ? null : QUESTION_STEPS[index];

  const goNext = () => {
    if (!question) return;
    const next = QUESTION_STEPS[index + 1];
    setStep(next ? next.id : "result");
  };

  const goBack = () => {
    if (step === "result") {
      setStep(QUESTION_STEPS[QUESTION_STEPS.length - 1].id);
      return;
    }
    const previous = QUESTION_STEPS[index - 1];
    if (previous) setStep(previous.id);
  };

  const restart = () => {
    setAnswers(EMPTY_ANSWERS);
    setResult(null);
    setError(null);
    fetchedKey.current = null;
    setStep("goal");
  };

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <StepRail
        current={step}
        answers={answers}
        onSelect={(id) => setStep(id)}
      />

      <div
        ref={headingRef}
        tabIndex={-1}
        className="outline-none focus-visible:ring-1 focus-visible:ring-cyan/40"
      >
        {step === "goal" && (
          <GoalQuestion value={answers.goal} onChange={(goal) => update({ goal })} />
        )}

        {step === "budget" && (
          <BudgetQuestion answers={answers} onChange={update} />
        )}

        {step === "games" && (
          <GamesQuestion
            value={answers.games}
            onChange={(games) => update({ games })}
          />
        )}

        {step === "resolution" && (
          <ResolutionQuestion
            value={answers.resolution}
            onChange={(resolution) => update({ resolution })}
          />
        )}

        {step === "fps" && (
          <FpsQuestion
            value={answers.targetFps}
            resolution={answers.resolution}
            onChange={(targetFps) => update({ targetFps })}
          />
        )}

        {step === "result" && (
          <ResultPane
            loading={loading}
            error={error}
            result={result}
            onRetry={() => {
              fetchedKey.current = null;
              setError(null);
              setResult(null);
              setRetryToken((token) => token + 1);
            }}
            onEdit={goBack}
            onRestart={restart}
          />
        )}
      </div>

      {question && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button
            variant="ghost"
            size="md"
            onClick={goBack}
            disabled={index === 0}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={goNext}
            disabled={!isAnswered(question.id, answers)}
            className="ml-auto"
          >
            {index === QUESTION_STEPS.length - 1 ? "Build my machine" : "Next"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress rail                                                              */
/* -------------------------------------------------------------------------- */

function StepRail({
  current,
  answers,
  onSelect,
}: {
  current: StepId;
  answers: Answers;
  onSelect: (id: StepId) => void;
}) {
  const currentIndex =
    current === "result"
      ? QUESTION_STEPS.length
      : QUESTION_STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Recommendation steps">
      <ol className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-8 md:px-8">
        {QUESTION_STEPS.map((step, i) => {
          const active = step.id === current;
          const done = isAnswered(step.id, answers) && i < currentIndex;
          // Only steps already reached are navigable — jumping ahead to a
          // question that depends on an earlier answer helps nobody.
          const reachable = i <= currentIndex;

          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => reachable && onSelect(step.id)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5",
                  "text-xs font-medium transition-colors",
                  active
                    ? "border-cyan/45 bg-cyan/12 text-chrome"
                    : done
                      ? "border-emerald/30 bg-emerald/[0.07] text-emerald"
                      : reachable
                        ? "border-line bg-white/[0.03] text-silver hover:border-line-strong"
                        : "border-line bg-white/[0.02] text-ash",
                )}
              >
                <span className="tnum font-mono text-[0.625rem]">
                  {done ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
        <li className="shrink-0">
          <span
            aria-current={current === "result" ? "step" : undefined}
            className={cn(
              "flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium",
              current === "result"
                ? "border-cyan/45 bg-cyan/12 text-chrome"
                : "border-line bg-white/[0.02] text-ash",
            )}
          >
            <span className="tnum font-mono text-[0.625rem]">06</span>
            Your build
          </span>
        </li>
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

function QuestionHeader({
  step,
  title,
  lede,
}: {
  step: number;
  title: string;
  lede: string;
}) {
  return (
    <header className="mb-8">
      <p className="eyebrow mb-3">
        Step {String(step).padStart(2, "0")} of 05
      </p>
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-chrome-gradient sm:text-3xl md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">{lede}</p>
    </header>
  );
}

function GoalQuestion({
  value,
  onChange,
}: {
  value: BuildGoal | null;
  onChange: (goal: BuildGoal) => void;
}) {
  return (
    <section>
      <QuestionHeader
        step={1}
        title="What is this machine for?"
        lede="This decides how the budget is split. A competitive build spends on the processor; a 4K build spends on the graphics card."
      />
      <div
        role="radiogroup"
        aria-label="Primary use"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {BUILD_GOALS.filter((goal) => goal.id !== "custom").map((goal) => {
          const Icon = GOAL_ICONS[goal.id];
          const active = value === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(goal.id)}
              className={cn(
                "group flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
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
                  {active && <Check className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-silver">
                  {goal.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ash">
        Want to choose every part yourself instead? The{" "}
        <a href="/builder" className="text-cyan underline-offset-2 hover:underline">
          custom PC builder
        </a>{" "}
        is the other way in.
      </p>
    </section>
  );
}

function BudgetQuestion({
  answers,
  onChange,
}: {
  answers: Answers;
  onChange: (patch: Partial<Answers>) => void;
}) {
  const [amount, setAmount] = React.useState(
    answers.budgetId === "custom" && answers.budgetMax ? String(answers.budgetMax) : "",
  );
  const inputId = React.useId();

  const parsed = Number(amount.replace(/[^\d]/g, ""));
  const valid = Number.isFinite(parsed) && parsed >= MIN_BUDGET_PKR && parsed <= MAX_BUDGET_PKR;

  const applyCustom = (raw: string) => {
    setAmount(raw);
    const digits = Number(raw.replace(/[^\d]/g, ""));
    if (!Number.isFinite(digits) || digits < MIN_BUDGET_PKR || digits > MAX_BUDGET_PKR) {
      if (answers.budgetId === "custom") {
        onChange({ budgetId: null, budgetMin: null, budgetMax: null });
      }
      return;
    }
    onChange({
      budgetId: "custom",
      budgetMin: Math.round(digits * CUSTOM_BUDGET_FLOOR_RATIO),
      budgetMax: digits,
    });
  };

  return (
    <section>
      <QuestionHeader
        step={2}
        title="What are you looking to spend?"
        lede="Pick a band, or type the figure you have in mind. We stay under it wherever the catalogue lets us, and say so plainly when it does not."
      />

      <div
        role="radiogroup"
        aria-label="Budget band"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {BUDGET_BANDS.map((band) => {
          const active = answers.budgetId === band.id;
          return (
            <button
              key={band.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setAmount("");
                onChange({
                  budgetId: band.id,
                  budgetMin: band.min,
                  budgetMax: band.max,
                });
              }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
                active
                  ? "border-cyan/45 bg-cyan/[0.07]"
                  : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.05]",
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "tnum font-display text-lg font-bold tracking-tight",
                    active ? "text-cyan" : "text-chrome",
                  )}
                >
                  {band.max === null
                    ? `${formatShortPKR(band.min)}+`
                    : band.min === 0
                      ? `Up to ${formatShortPKR(band.max)}`
                      : `${formatShortPKR(band.min)} – ${formatShortPKR(band.max)}`}
                </span>
                {active && (
                  <Check className="mt-1 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                )}
              </span>
              <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                {band.label}
              </span>
              <span className="text-xs leading-relaxed text-silver">{band.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white/[0.02] p-4">
        <label
          htmlFor={inputId}
          className="flex items-center gap-2 font-display text-sm font-semibold text-chrome"
        >
          <Wallet className="h-4 w-4 text-cyan" aria-hidden="true" />
          Or give us an exact figure
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center rounded-xl border border-line bg-carbon px-3">
            <span className="font-mono text-xs text-ash">PKR</span>
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => applyCustom(event.target.value)}
              placeholder="300000"
              aria-describedby={`${inputId}-hint`}
              className="tnum ml-2 w-36 bg-transparent font-display text-base text-chrome placeholder:text-ash focus:outline-none"
            />
          </div>
          {valid && (
            <p className="tnum text-xs text-silver">
              We will aim for {formatPKR(Math.round(parsed * CUSTOM_BUDGET_FLOOR_RATIO))} –{" "}
              {formatPKR(parsed)}.
            </p>
          )}
        </div>
        <p id={`${inputId}-hint`} className="mt-2 text-xs leading-relaxed text-ash">
          Minimum {formatPKR(MIN_BUDGET_PKR)} — below that nothing in our
          catalogue adds up to a complete machine.
        </p>
      </div>
    </section>
  );
}

function GamesQuestion({
  value,
  onChange,
}: {
  value: string[];
  onChange: (games: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const inputId = React.useId();

  const toggle = (game: string) => {
    onChange(
      value.includes(game)
        ? value.filter((g) => g !== game)
        : value.length >= MAX_GAMES
          ? value
          : [...value, game],
    );
  };

  const addCustom = () => {
    const game = draft.trim().slice(0, 64);
    if (!game || value.length >= MAX_GAMES) return;
    if (value.some((g) => g.toLowerCase() === game.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, game]);
    setDraft("");
  };

  const custom = value.filter(
    (game) => !(POPULAR_GAMES as readonly string[]).includes(game),
  );

  return (
    <section>
      <QuestionHeader
        step={3}
        title="What will you be playing?"
        lede="Optional, and it changes nothing about the parts we pick. It decides which of our recorded frame-rate figures we can show you — and tells you honestly where we have none."
      />

      <div className="flex flex-wrap gap-2">
        {POPULAR_GAMES.map((game) => {
          const active = value.includes(game);
          return (
            <button
              key={game}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(game)}
              className={cn(
                "h-10 rounded-full border px-4 text-xs font-medium transition-colors",
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

      {custom.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {custom.map((game) => (
            <li key={game}>
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-4 text-xs font-medium text-cyan">
                {game}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((g) => g !== game))}
                  aria-label={`Remove ${game}`}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-white/[0.02] p-4">
        <label htmlFor={inputId} className="block text-xs font-medium text-silver">
          Something else? Add it here.
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id={inputId}
            type="text"
            value={draft}
            maxLength={64}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="e.g. Escape from Tarkov"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-carbon px-3 text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40"
          />
          <Button
            variant="secondary"
            size="md"
            onClick={addCustom}
            disabled={!draft.trim() || value.length >= MAX_GAMES}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
        <p className="mt-2 text-xs text-ash">
          {value.length} of {MAX_GAMES} selected. Skip this if you would rather
          not say.
        </p>
      </div>
    </section>
  );
}

function ResolutionQuestion({
  value,
  onChange,
}: {
  value: TargetResolution | null;
  onChange: (resolution: TargetResolution) => void;
}) {
  return (
    <section>
      <QuestionHeader
        step={4}
        title="What resolution will you play at?"
        lede="The single biggest lever on where the money goes. At 4K the graphics card is doing nearly all the work; at 1080p the processor is usually the wall."
      />
      <div
        role="radiogroup"
        aria-label="Target resolution"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        {RESOLUTIONS.map((resolution) => {
          const active = value === resolution;
          return (
            <button
              key={resolution}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(resolution)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors",
                active
                  ? "border-cyan/45 bg-cyan/[0.07]"
                  : "border-line bg-white/[0.02] hover:border-line-strong",
              )}
            >
              <span
                className={cn(
                  "font-display text-xl font-bold tracking-tight",
                  active ? "text-cyan" : "text-chrome",
                )}
              >
                {resolution}
              </span>
              <span className="text-xs leading-relaxed text-ash">
                {RESOLUTION_NOTE[resolution]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FpsQuestion({
  value,
  resolution,
  onChange,
}: {
  value: TargetFps | null;
  resolution: TargetResolution | null;
  onChange: (fps: TargetFps) => void;
}) {
  return (
    <section>
      <QuestionHeader
        step={5}
        title="How many frames per second are you aiming for?"
        lede="A high target is a processor problem long before it is a graphics card one, so this shifts the split again."
      />
      <div
        role="radiogroup"
        aria-label="Frame rate target"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        {FPS_TARGETS.map((target) => {
          const active = value === target.value;
          return (
            <button
              key={target.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(target.value)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-2xl border p-4 text-left transition-colors",
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

      {resolution === "4K" && value === 240 && (
        <p className="mt-4 max-w-xl text-xs leading-relaxed text-ember">
          Nothing in our records runs a modern title at 4K and 240 FPS. We will
          still spec the fastest machine your budget reaches, and show you
          exactly which figures we hold and which we do not.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */

function ResultPane({
  loading,
  error,
  result,
  onRetry,
  onEdit,
  onRestart,
}: {
  loading: boolean;
  error: string | null;
  result: ApiResponse | null;
  onRetry: () => void;
  onEdit: () => void;
  onRestart: () => void;
}) {
  if (loading || (!result && !error)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center"
      >
        <Spinner className="h-6 w-6 text-cyan" />
        <div>
          <p className="font-display text-lg font-semibold text-chrome">
            Putting a machine together
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-silver">
            Splitting the budget, picking parts, then running every combination
            through the same compatibility engine the builder uses.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-rose/30 bg-rose/[0.05] px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold text-rose">
          That did not work
        </p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-silver">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="md" onClick={onRetry}>
            Try again
          </Button>
          <Button variant="ghost" size="md" onClick={onEdit}>
            Change my answers
          </Button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <RecommendationResult
      recommendation={result.recommendation}
      performance={result.performance}
      onEdit={onEdit}
      onRestart={onRestart}
    />
  );
}
