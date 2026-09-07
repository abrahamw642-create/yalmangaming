"use client";

/**
 * Yalman Gaming — custom build state.
 *
 * One reducer holds the entire configuration; every derived figure
 * (compatibility, power, totals) is computed from it rather than stored, so the
 * two can never disagree. The same `checkCompatibility` runs again on the
 * server before anything is persisted — this store is for feedback, not truth.
 *
 * Persistence is deliberately one-way on mount: read `localStorage` inside an
 * effect, never during render, so the server and the first client paint agree
 * and React does not warn about a hydration mismatch.
 */

import * as React from "react";
import {
  BUDGET_BANDS,
  EMPTY_BUILD,
  KIND_META,
  type BudgetBand,
  type BuildGoal,
  type BuildSelection,
  type BuildState,
  type BuilderPart,
  type CompatibilityReport,
  type ComponentKind,
  type TargetFps,
  type TargetResolution,
} from "./types";
import { checkCompatibility, partPrice } from "./compatibility";
import {
  defaultServiceIds,
  sanitizeBuildState,
  servicesSubtotal,
} from "./build-serialize";

export const BUILD_STORAGE_KEY = "yalman:build:v1";

/* -------------------------------------------------------------------------- */
/* Reducer                                                                    */
/* -------------------------------------------------------------------------- */

type Action =
  | { type: "hydrate"; state: BuildState }
  | { type: "load"; state: BuildState }
  | { type: "reset" }
  | { type: "set-part"; kind: ComponentKind; part: BuilderPart | null }
  | { type: "add-part"; kind: ComponentKind; part: BuilderPart }
  | { type: "remove-part"; kind: ComponentKind; partId: string }
  | { type: "clear-kind"; kind: ComponentKind }
  | { type: "set-goal"; goal: BuildGoal | null }
  | { type: "set-budget"; band: BudgetBand | null }
  | { type: "set-resolution"; resolution: TargetResolution | null }
  | { type: "set-target-fps"; fps: TargetFps | null }
  | { type: "set-games"; games: string[] }
  | { type: "set-name"; name: string }
  | { type: "toggle-service"; id: string }
  | { type: "set-assemble"; on: boolean };

/** A fresh build with its own array/object instances — never share EMPTY_BUILD. */
function emptyBuild(): BuildState {
  return { ...EMPTY_BUILD, games: [], selection: {}, services: [] };
}

/**
 * Any structural edit invalidates the saved copy: the share code still points
 * at the snapshot the customer sent, and silently re-pointing it at newer parts
 * would rewrite what someone else already opened.
 */
function edited(state: BuildState): BuildState {
  return state.shareCode === null && state.id === null
    ? state
    : { ...state, id: null, shareCode: null };
}

function withSelection(
  state: BuildState,
  kind: ComponentKind,
  parts: BuilderPart[],
): BuildState {
  const selection: BuildSelection = { ...state.selection };
  if (parts.length === 0) delete selection[kind];
  else selection[kind] = parts;
  return edited({ ...state, selection });
}

function reducer(state: BuildState, action: Action): BuildState {
  switch (action.type) {
    case "hydrate":
    case "load":
      return action.state;

    case "reset":
      return emptyBuild();

    case "set-part":
      return withSelection(state, action.kind, action.part ? [action.part] : []);

    case "add-part": {
      const current = state.selection[action.kind] ?? [];
      // Single-slot kinds replace; multi kinds append, so three identical fans
      // or a second NVMe drive both work without a separate code path.
      if (!KIND_META[action.kind].multiple) {
        return withSelection(state, action.kind, [action.part]);
      }
      return withSelection(state, action.kind, [...current, action.part]);
    }

    case "remove-part": {
      const current = state.selection[action.kind] ?? [];
      // Drop the last matching instance so a quantity stepper decrements
      // rather than clearing every copy of the part at once.
      const index = current.map((p) => p.id).lastIndexOf(action.partId);
      if (index === -1) return state;
      const next = [...current.slice(0, index), ...current.slice(index + 1)];
      return withSelection(state, action.kind, next);
    }

    case "clear-kind":
      return withSelection(state, action.kind, []);

    case "set-goal":
      return edited({ ...state, goal: action.goal });

    case "set-budget":
      return edited({
        ...state,
        budgetId: action.band?.id ?? null,
        budgetMin: action.band?.min ?? null,
        budgetMax: action.band?.max ?? null,
      });

    case "set-resolution":
      return edited({ ...state, resolution: action.resolution });

    case "set-target-fps":
      return edited({ ...state, targetFps: action.fps });

    case "set-games":
      return edited({ ...state, games: action.games.slice(0, 12) });

    case "set-name":
      return edited({ ...state, name: action.name });

    case "toggle-service": {
      const has = state.services.includes(action.id);
      const services = has
        ? state.services.filter((id) => id !== action.id)
        : [...state.services, action.id];
      return edited({
        ...state,
        services,
        // Un-ticking the last service is how a customer says "I will build it
        // myself"; the flag follows the list rather than living beside it.
        assembleForMe: services.length > 0,
      });
    }

    case "set-assemble":
      return edited({
        ...state,
        assembleForMe: action.on,
        services: action.on ? defaultServiceIds() : [],
      });

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

export type BuildContextValue = {
  build: BuildState;
  report: CompatibilityReport;
  total: number;
  componentsSubtotal: number;
  servicesSubtotal: number;
  /** False until localStorage has been read. Guards first-paint flicker. */
  hydrated: boolean;

  setPart(kind: ComponentKind, part: BuilderPart | null): void;
  addPart(kind: ComponentKind, part: BuilderPart): void;
  removePart(kind: ComponentKind, partId: string): void;
  clearKind(kind: ComponentKind): void;

  setGoal(goal: BuildGoal | null): void;
  setBudget(band: BudgetBand | null): void;
  setResolution(resolution: TargetResolution | null): void;
  setTargetFps(fps: TargetFps | null): void;
  setGames(games: string[]): void;
  setName(name: string): void;

  toggleService(id: string): void;
  setAssembleForMe(on: boolean): void;

  reset(): void;
  loadBuild(state: BuildState): void;
};

const BuildContext = React.createContext<BuildContextValue | null>(null);

export function BuildProvider({ children }: { children: React.ReactNode }) {
  const [build, dispatch] = React.useReducer(reducer, null, emptyBuild);
  const [hydrated, setHydrated] = React.useState(false);

  // Read persisted state after the first paint. Doing this during render would
  // make the server HTML and the client's first render disagree.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BUILD_STORAGE_KEY);
      const restored = raw ? sanitizeBuildState(JSON.parse(raw)) : null;
      if (restored) dispatch({ type: "hydrate", state: restored });
    } catch {
      // Private browsing, disabled storage or corrupt JSON — start clean.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(build));
    } catch {
      // Quota exceeded or storage blocked: the build still works this session.
    }
  }, [build, hydrated]);

  const report = React.useMemo(
    () => checkCompatibility(build.selection),
    [build.selection],
  );

  const componentsSubtotal = React.useMemo(
    () =>
      Object.values(build.selection)
        .flat()
        .reduce((sum, part) => sum + partPrice(part), 0),
    [build.selection],
  );

  const serviceTotal = React.useMemo(
    () => servicesSubtotal(build.services),
    [build.services],
  );

  const value = React.useMemo<BuildContextValue>(
    () => ({
      build,
      report,
      componentsSubtotal,
      servicesSubtotal: serviceTotal,
      total: componentsSubtotal + serviceTotal,
      hydrated,

      setPart: (kind, part) => dispatch({ type: "set-part", kind, part }),
      addPart: (kind, part) => dispatch({ type: "add-part", kind, part }),
      removePart: (kind, partId) =>
        dispatch({ type: "remove-part", kind, partId }),
      clearKind: (kind) => dispatch({ type: "clear-kind", kind }),

      setGoal: (goal) => dispatch({ type: "set-goal", goal }),
      setBudget: (band) => dispatch({ type: "set-budget", band }),
      setResolution: (resolution) =>
        dispatch({ type: "set-resolution", resolution }),
      setTargetFps: (fps) => dispatch({ type: "set-target-fps", fps }),
      setGames: (games) => dispatch({ type: "set-games", games }),
      setName: (name) => dispatch({ type: "set-name", name }),

      toggleService: (id) => dispatch({ type: "toggle-service", id }),
      setAssembleForMe: (on) => dispatch({ type: "set-assemble", on }),

      reset: () => dispatch({ type: "reset" }),
      loadBuild: (state) => dispatch({ type: "load", state }),
    }),
    [build, report, componentsSubtotal, serviceTotal, hydrated],
  );

  return (
    <BuildContext.Provider value={value}>{children}</BuildContext.Provider>
  );
}

export function useBuild(): BuildContextValue {
  const ctx = React.useContext(BuildContext);
  if (!ctx) {
    throw new Error("useBuild must be used inside <BuildProvider>.");
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Small selectors used across the builder UI                                 */
/* -------------------------------------------------------------------------- */

/** The band object behind `build.budgetId`, if the customer picked a preset. */
export function budgetBandOf(build: BuildState): BudgetBand | null {
  return BUDGET_BANDS.find((b) => b.id === build.budgetId) ?? null;
}

/** True when this exact part is already in the build under `kind`. */
export function isPartSelected(
  selection: BuildSelection,
  kind: ComponentKind,
  partId: string,
): boolean {
  return (selection[kind] ?? []).some((p) => p.id === partId);
}
