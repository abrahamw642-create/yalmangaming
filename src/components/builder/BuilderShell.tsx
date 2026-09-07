"use client";

/**
 * The builder.
 *
 * Three columns on desktop — the step index, the step itself, and a summary
 * that never leaves the screen. On a phone the index becomes a horizontal rail,
 * the step takes the full width, and the summary moves into the sticky bar at
 * the bottom.
 *
 * The flow is Goal → Budget → each component kind → Assembly → Review, but the
 * rail is live at every point: this is a configurator, not a wizard, and a
 * customer who wants to change the graphics card after choosing a case gets to
 * do it in one tap.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Boxes, Eye, Sparkles, Sun } from "lucide-react";
import { goalLabel, selectionRows } from "@/lib/build-serialize";
import { useBuild } from "@/lib/build-store";
import { partPrice } from "@/lib/compatibility";
import {
  KIND_META,
  type BuilderPart,
  type ComponentKind,
} from "@/lib/types";
import { cn, formatPKR } from "@/lib/utils";
import { SamplePricingNote } from "@/components/ui";
import { AssemblyServices } from "./AssemblyServices";
import { BudgetStep } from "./BudgetStep";
import { BuildActions } from "./BuildActions";
import { BuildSummary } from "./BuildSummary";
import { CompatibilityAlert } from "./CompatibilityAlert";
import { ComponentStep } from "./ComponentStep";
import { GoalStep } from "./GoalStep";
import { MobileSummaryBar } from "./MobileSummaryBar";
import { PowerPanel } from "./PowerPanel";
import {
  BUILDER_STEPS,
  StepNav,
  stepIndex,
  type BuilderStep,
  type StepId,
  type StepStatus,
} from "./StepNav";

/**
 * The 3D visualiser is a separate area and a heavy one: WebGL, three and drei.
 * It loads client-side only and never blocks the builder from becoming usable.
 */
const BuilderScene = dynamic(() => import("@/components/three/BuilderScene"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-2xl" />,
});

export type BuilderCatalog = Partial<Record<ComponentKind, BuilderPart[]>>;

export function BuilderShell({
  catalog,
  initialStep,
}: {
  catalog: BuilderCatalog;
  initialStep?: StepId;
}) {
  const { build, report, hydrated } = useBuild();
  const reduceMotion = useReducedMotion();

  const [current, setCurrent] = React.useState<StepId>(initialStep ?? "goal");
  const [glass, setGlass] = React.useState(true);
  const [rgb, setRgb] = React.useState(true);
  const [exploded, setExploded] = React.useState(false);

  const topRef = React.useRef<HTMLDivElement | null>(null);
  const firstRender = React.useRef(true);

  // Bring the new step into view on navigation. `scroll-padding-top` in
  // globals.css keeps the sticky header from covering it.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [current, reduceMotion]);

  const index = stepIndex(current);
  const step = BUILDER_STEPS[index];
  const previous = index > 0 ? BUILDER_STEPS[index - 1] : null;
  const next = index < BUILDER_STEPS.length - 1 ? BUILDER_STEPS[index + 1] : null;

  /* --- Step state ------------------------------------------------------- */

  const statusOf = React.useCallback(
    (item: BuilderStep): StepStatus => {
      if (item.kind) {
        const chosen = build.selection[item.kind] ?? [];
        if (chosen.length === 0) return item.optional ? "skipped" : "todo";
        const issues = report.issues.filter(
          (issue) => issue.kinds.includes(item.kind!) && issue.severity !== "info",
        );
        if (issues.some((i) => i.severity === "error")) return "error";
        if (issues.length > 0) return "warning";
        return "done";
      }
      switch (item.id) {
        case "goal":
          return build.goal ? "done" : "skipped";
        case "budget":
          return build.budgetId || build.budgetMin !== null ? "done" : "skipped";
        case "services":
          return build.services.length > 0 ? "done" : "skipped";
        case "review":
          return report.complete ? "done" : "todo";
        default:
          return "todo";
      }
    },
    [build, report],
  );

  const detailOf = React.useCallback(
    (item: BuilderStep): string | null => {
      if (item.kind) {
        const chosen = build.selection[item.kind] ?? [];
        if (chosen.length === 0) return null;
        const extra = chosen.length > 1 ? ` +${chosen.length - 1}` : "";
        return `${chosen[0].name}${extra}`;
      }
      switch (item.id) {
        case "goal":
          return goalLabel(build.goal);
        case "budget":
          return build.budgetMax !== null
            ? formatPKR(build.budgetMax)
            : build.budgetMin !== null
              ? `${formatPKR(build.budgetMin)}+`
              : null;
        case "services":
          return build.services.length > 0
            ? `${build.services.length} selected`
            : null;
        case "review":
          return report.complete ? "Ready" : `${report.missing.length} missing`;
        default:
          return null;
      }
    },
    [build, report],
  );

  const requiredSteps = BUILDER_STEPS.filter((s) => s.kind && !s.optional);
  const requiredDone = requiredSteps.filter(
    (s) => (build.selection[s.kind!] ?? []).length > 0,
  ).length;
  const progress = Math.round((requiredDone / requiredSteps.length) * 100);

  const goTo = React.useCallback((id: StepId) => setCurrent(id), []);

  return (
    <div className="relative">
      {/* --- Header --------------------------------------------------------- */}
      <div className="border-b border-line bg-carbon/60">
        <div className="container-page py-8 md:py-12">
          <p className="eyebrow mb-3">Custom PC Builder</p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-chrome-gradient sm:text-5xl md:text-6xl">
            Build the machine
            <br className="hidden sm:block" /> you actually want.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-silver">
            Every part is checked against every other part as you go — sockets,
            clearances, memory, wattage. Nothing incompatible can end up in the
            build.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-[12rem] flex-1 sm:max-w-xs">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                  Required parts
                </span>
                <span className="tnum font-mono text-[0.6875rem] text-silver">
                  {requiredDone} / {requiredSteps.length}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan to-sky"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
              {report.power.estimatedWatts > 0
                ? `${report.power.estimatedWatts}W estimated · ${report.power.recommendedPsuW}W PSU`
                : "Wattage appears as you add parts"}
            </p>
          </div>
        </div>
      </div>

      {/* --- Body ----------------------------------------------------------- */}
      <div className="container-page py-6 lg:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_23rem] xl:gap-8">
          <StepNav
            current={current}
            onSelect={goTo}
            statusOf={statusOf}
            detailOf={detailOf}
            className="lg:col-start-1"
          />

          {/* A plain region, not <main>: the store layout already owns the
              page's single <main> landmark. */}
          <div className="min-w-0" role="region" aria-label="Current step">
            <div ref={topRef} className="scroll-mt-28" />

            <Visualiser
              glass={glass}
              rgb={rgb}
              exploded={exploded}
              onGlass={setGlass}
              onRgb={setRgb}
              onExploded={setExploded}
            />

            <div className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step.kind ? (
                    <ComponentStep
                      // Keyed by kind so each step gets its own picker state.
                      key={step.kind}
                      kind={step.kind}
                      parts={catalog[step.kind] ?? []}
                      onFocusKind={goTo}
                    />
                  ) : step.id === "goal" ? (
                    <GoalStep onNext={() => goTo("cpu")} />
                  ) : step.id === "budget" ? (
                    <BudgetStep />
                  ) : step.id === "services" ? (
                    <AssemblyServices />
                  ) : (
                    <ReviewStep onFocusStep={goTo} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* --- Step footer ---------------------------------------------- */}
            <nav
              aria-label="Step navigation"
              className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6"
            >
              {previous ? (
                <button
                  type="button"
                  onClick={() => goTo(previous.id)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-silver transition-colors hover:bg-white/5 hover:text-chrome"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{previous.label}</span>
                  <span className="sm:hidden">Back</span>
                </button>
              ) : (
                <span />
              )}

              {next && (
                <button
                  type="button"
                  onClick={() => goTo(next.id)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-semibold",
                    "border-line-strong text-chrome transition-colors",
                    "hover:border-cyan/60 hover:bg-cyan/[0.06] hover:text-cyan",
                  )}
                >
                  <span className="hidden sm:inline">Next · {next.label}</span>
                  <span className="sm:hidden">Next</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </nav>

            {/* Space for the mobile summary bar so it never covers content.
                Matches the bar's own breakpoint: the sticky sidebar only
                appears at xl, so the bar has to stay until then. */}
            <div className="h-24 xl:hidden" aria-hidden="true" />
          </div>

          {/* --- Sticky summary (desktop) ---------------------------------- */}
          <aside className="hidden xl:block">
            <div
              className={cn(
                "glass sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto",
                "rounded-2xl p-4",
                !hydrated && "opacity-70",
              )}
            >
              <BuildSummary onFocusStep={goTo} />
            </div>
          </aside>
        </div>
      </div>

      <MobileSummaryBar onFocusStep={goTo} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Visualiser                                                                 */
/* -------------------------------------------------------------------------- */

function Visualiser({
  glass,
  rgb,
  exploded,
  onGlass,
  onRgb,
  onExploded,
}: {
  glass: boolean;
  rgb: boolean;
  exploded: boolean;
  onGlass: (on: boolean) => void;
  onRgb: (on: boolean) => void;
  onExploded: (on: boolean) => void;
}) {
  const { build } = useBuild();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = React.useState(false);

  // Do not mount WebGL until the panel has actually been on screen once. After
  // that it stays mounted — tearing a scene down and rebuilding it on every
  // scroll costs far more than leaving it alive.
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return (
    <section aria-label="Build preview" className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border border-line bg-carbon sm:aspect-[16/9]"
      >
        <div className="grid-bg absolute inset-0 opacity-40" aria-hidden="true" />
        {seen ? (
          // The scene owns its own canvas sizing; this wrapper guarantees it
          // fills the framed panel whatever it renders internally.
          <div className="absolute inset-0">
            <BuilderScene
              selection={build.selection}
              exploded={exploded}
              glass={glass}
              rgb={rgb}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
              Preview loading
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <SceneToggle
          label="Glass panel"
          icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
          on={glass}
          onChange={onGlass}
        />
        <SceneToggle
          label="RGB"
          icon={<Sun className="h-3.5 w-3.5" aria-hidden="true" />}
          on={rgb}
          onChange={onRgb}
        />
        <SceneToggle
          label="Exploded view"
          icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
          on={exploded}
          onChange={onExploded}
        />
      </div>
    </section>
  );
}

function SceneToggle({
  label,
  icon,
  on,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5",
        "font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
        on
          ? "border-cyan/40 bg-cyan/10 text-cyan"
          : "border-line bg-white/[0.02] text-ash hover:border-line-strong hover:text-silver",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Review                                                                     */
/* -------------------------------------------------------------------------- */

function ReviewStep({ onFocusStep }: { onFocusStep: (step: StepId) => void }) {
  const { build, report, total, componentsSubtotal, servicesSubtotal } =
    useBuild();
  const rows = selectionRows(build.selection);
  const anySample = Object.values(build.selection)
    .flat()
    .some((p) => p.samplePrice);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="eyebrow mb-3">Review</p>
        <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-chrome-gradient sm:text-4xl">
          {report.complete
            ? "This machine is ready to build."
            : "Nearly there."}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-silver">
          {report.complete
            ? "Every required part is chosen and every rule passes. Add it to your cart, save the link, or send it to us and we will confirm pricing and availability."
            : "Fill the remaining required parts and clear any errors below, then this build is ready to send to the bench."}
        </p>
      </header>

      <CompatibilityAlert report={report} onFocusKind={onFocusStep} />

      {/* --- Spec sheet ------------------------------------------------------ */}
      {rows.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">The machine</h3>
          <div className="metal overflow-hidden rounded-2xl">
            <table className="w-full text-left">
              <caption className="sr-only">
                Components selected for {build.name}
              </caption>
              <tbody>
                {rows.map(({ kind, groups }) =>
                  groups.map(({ part, quantity }) => (
                    <tr
                      key={`${kind}-${part.id}`}
                      className="border-b border-line last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="w-[8.5rem] px-4 py-3 align-top font-mono text-[0.625rem] font-medium uppercase tracking-wider text-ash"
                      >
                        {KIND_META[kind].label}
                      </th>
                      <td className="px-1 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => onFocusStep(kind)}
                          className="text-left text-sm font-medium text-chrome hover:text-cyan"
                        >
                          {part.name}
                          {quantity > 1 && (
                            <span className="tnum ml-1.5 font-mono text-xs text-ash">
                              ×{quantity}
                            </span>
                          )}
                        </button>
                        {part.brandName && (
                          <p className="mt-0.5 text-[0.6875rem] text-ash">
                            {part.brandName}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                        <span className="tnum font-mono text-sm text-chrome">
                          {formatPKR(partPrice(part) * quantity)}
                        </span>
                        {part.samplePrice && (
                          <span
                            className="ml-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
                            title="Sample pricing seeded for development."
                          >
                            sample
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <td colSpan={2} className="px-4 py-2.5 text-xs text-ash">
                    Components
                  </td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-sm text-silver">
                    {formatPKR(componentsSubtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-xs text-ash">
                    Assembly services
                  </td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-sm text-silver">
                    {formatPKR(servicesSubtotal)}
                  </td>
                </tr>
                <tr className="border-t border-line">
                  <td
                    colSpan={2}
                    className="px-4 py-3 font-display text-sm font-semibold text-chrome"
                  >
                    Total
                  </td>
                  <td className="tnum px-4 py-3 text-right font-display text-xl font-bold text-chrome">
                    {formatPKR(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* --- Power ------------------------------------------------------------ */}
      <section>
        <h3 className="eyebrow mb-3">Power</h3>
        <PowerPanel power={report.power} />
      </section>

      {/* --- Act --------------------------------------------------------------- */}
      <section className="xl:max-w-sm">
        <h3 className="eyebrow mb-3">Next</h3>
        <BuildActions />
      </section>

      {anySample && <SamplePricingNote />}

      <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Built and tested at Hafeez Centre, Gulberg III
      </p>
    </div>
  );
}

