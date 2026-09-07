"use client";

/**
 * Builder step rail.
 *
 * Also the home of the builder's step model and its kind→icon mapping. Both
 * live here because this is the leaf of the builder's import graph — the rail,
 * the summary and every step panel need them, and none of them import each
 * other, so there is no cycle to trip over.
 */

import * as React from "react";
import {
  Armchair,
  Box,
  Check,
  CircuitBoard,
  ClipboardList,
  Cpu,
  Fan,
  Gamepad2,
  Gpu,
  HardDrive,
  Headphones,
  Keyboard,
  MemoryStick,
  Mic,
  Monitor,
  MonitorCog,
  Mouse,
  Package,
  PcCase,
  PlugZap,
  Speaker,
  Square,
  TriangleAlert,
  Video,
  Wallet,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BUILDER_STEP_KINDS, KIND_META, type ComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Step model                                                                 */
/* -------------------------------------------------------------------------- */

export type StepId = "goal" | "budget" | "services" | "review" | ComponentKind;

export type BuilderStep = {
  id: StepId;
  label: string;
  /** Component steps carry their kind; intent steps do not. */
  kind: ComponentKind | null;
  optional: boolean;
};

/**
 * Goal → Budget → one step per component kind → Services → Review.
 *
 * The order of the component steps is `BUILDER_STEP_KINDS`, which puts the
 * parts that constrain everything else (CPU, board) before the ones they
 * constrain (cooler, case) — but nothing forces a customer through in order.
 */
export const BUILDER_STEPS: BuilderStep[] = [
  { id: "goal", label: "Purpose", kind: null, optional: true },
  { id: "budget", label: "Budget", kind: null, optional: true },
  ...BUILDER_STEP_KINDS.map<BuilderStep>((kind) => ({
    id: kind,
    label: KIND_META[kind].label,
    kind,
    optional: !KIND_META[kind].required,
  })),
  { id: "services", label: "Assembly", kind: null, optional: true },
  { id: "review", label: "Review", kind: null, optional: false },
];

export function stepIndex(id: StepId): number {
  const index = BUILDER_STEPS.findIndex((s) => s.id === id);
  return index === -1 ? 0 : index;
}

export function isStepId(value: string): value is StepId {
  return BUILDER_STEPS.some((s) => s.id === value);
}

/** How a step reads in the rail. `error` means a rule fired on that kind. */
export type StepStatus = "done" | "error" | "warning" | "todo" | "skipped";

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

const KIND_ICONS: Record<ComponentKind, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  gpu: Gpu,
  ram: MemoryStick,
  storage: HardDrive,
  psu: PlugZap,
  cooler: Fan,
  case: Box,
  fan: Wind,
  os: MonitorCog,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headphones,
  microphone: Mic,
  webcam: Video,
  chair: Armchair,
  controller: Gamepad2,
  mousepad: Square,
  speaker: Speaker,
  prebuilt: PcCase,
};

export function KindGlyph({
  kind,
  className,
}: {
  kind: ComponentKind;
  className?: string;
}) {
  const Icon = KIND_ICONS[kind] ?? Package;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}

const STEP_ICONS: Partial<Record<StepId, LucideIcon>> = {
  goal: Gamepad2,
  budget: Wallet,
  services: Wrench,
  review: ClipboardList,
};

export function StepGlyph({
  step,
  className,
}: {
  step: BuilderStep;
  className?: string;
}) {
  if (step.kind) return <KindGlyph kind={step.kind} className={className} />;
  const Icon = STEP_ICONS[step.id] ?? Package;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Rail                                                                       */
/* -------------------------------------------------------------------------- */

const STATUS_DOT: Record<StepStatus, string> = {
  done: "bg-emerald",
  error: "bg-rose",
  warning: "bg-ember",
  todo: "bg-white/20",
  skipped: "bg-white/10",
};

export type StepNavProps = {
  current: StepId;
  onSelect: (id: StepId) => void;
  statusOf: (step: BuilderStep) => StepStatus;
  /** Short line under the label — usually the chosen part's name. */
  detailOf?: (step: BuilderStep) => string | null;
  steps?: BuilderStep[];
  className?: string;
};

export function StepNav({
  current,
  onSelect,
  statusOf,
  detailOf,
  steps = BUILDER_STEPS,
  className,
}: StepNavProps) {
  const done = steps.filter((s) => statusOf(s) === "done").length;

  return (
    <div className={className}>
      {/* Desktop: a vertical index of the whole configuration. */}
      <nav
        aria-label="Build steps"
        className="hidden lg:sticky lg:top-24 lg:block"
      >
        <p className="eyebrow mb-3">Configuration</p>
        <ol className="flex flex-col gap-0.5">
          {steps.map((step, i) => {
            const status = statusOf(step);
            const active = step.id === current;
            const detail = detailOf?.(step) ?? null;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                    "transition-colors duration-150",
                    active
                      ? "bg-cyan/10 text-chrome ring-1 ring-inset ring-cyan/30"
                      : "text-silver hover:bg-white/[0.04] hover:text-chrome",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      "border transition-colors",
                      active
                        ? "border-cyan/40 bg-cyan/15 text-cyan"
                        : status === "done"
                          ? "border-emerald/30 bg-emerald/10 text-emerald"
                          : status === "error"
                            ? "border-rose/40 bg-rose/10 text-rose"
                            : "border-line bg-white/[0.03] text-ash group-hover:text-silver",
                    )}
                  >
                    {status === "done" && !active ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : status === "error" ? (
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <StepGlyph step={step} className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">
                        {step.label}
                      </span>
                      {!step.optional && status !== "done" && (
                        <span
                          className="text-[0.625rem] text-ash"
                          title="Required for a complete build"
                        >
                          required
                        </span>
                      )}
                    </span>
                    {detail && (
                      <span className="mt-0.5 block truncate text-xs text-ash">
                        {detail}
                      </span>
                    )}
                  </span>

                  <span className="tnum shrink-0 font-mono text-[0.625rem] text-ash">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 px-3 font-mono text-[0.6875rem] tracking-wider text-ash">
          {done} / {steps.length} configured
        </p>
      </nav>

      {/* Mobile: a horizontal rail so the whole flow stays one thumb away. */}
      <MobileRail
        steps={steps}
        current={current}
        onSelect={onSelect}
        statusOf={statusOf}
      />
    </div>
  );
}

function MobileRail({
  steps,
  current,
  onSelect,
  statusOf,
}: {
  steps: BuilderStep[];
  current: StepId;
  onSelect: (id: StepId) => void;
  statusOf: (step: BuilderStep) => StepStatus;
}) {
  const activeRef = React.useRef<HTMLButtonElement | null>(null);

  // Keep the current chip in view when the step changes from the Next button
  // rather than from a tap on the rail itself.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [current]);

  return (
    <nav aria-label="Build steps" className="lg:hidden">
      {/* Bleeds into the page gutter so the rail scrolls edge to edge; the
          md values match `container-page`'s wider padding at that breakpoint. */}
      <ol className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
        {steps.map((step) => {
          const status = statusOf(step);
          const active = step.id === current;
          return (
            <li key={step.id} className="snap-start">
              <button
                type="button"
                ref={active ? activeRef : undefined}
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4",
                  "text-sm font-medium transition-colors",
                  active
                    ? "border-cyan/40 bg-cyan/12 text-chrome"
                    : "border-line bg-white/[0.03] text-silver",
                )}
              >
                <StepGlyph step={step} className="h-3.5 w-3.5" />
                {step.label}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    STATUS_DOT[status],
                  )}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
