"use client";

/**
 * Client boundary for `/builder`.
 *
 * The page itself stays a Server Component and does the catalogue query; this
 * wrapper owns the provider, the optional "open a shared build" bootstrap, and
 * nothing else.
 */

import * as React from "react";
import { X } from "lucide-react";
import { sanitizeBuildState } from "@/lib/build-serialize";
import { BuildProvider, useBuild } from "@/lib/build-store";
import { cn } from "@/lib/utils";
import { BuilderShell, type BuilderCatalog } from "@/components/builder/BuilderShell";
import { isStepId, type StepId } from "@/components/builder/StepNav";

export default function BuilderClient({
  catalog,
  loadShareCode,
  step,
}: {
  catalog: BuilderCatalog;
  /** `/builder?load=AB12CD` — pull a saved configuration into the builder. */
  loadShareCode?: string | null;
  /** `/builder?step=gpu` — deep-link straight to one step. */
  step?: string | null;
}) {
  const initialStep: StepId | undefined =
    step && isStepId(step) ? step : undefined;

  return (
    <BuildProvider>
      {loadShareCode && <SharedBuildLoader code={loadShareCode} />}
      <BuilderShell catalog={catalog} initialStep={initialStep} />
    </BuildProvider>
  );
}

/**
 * Fetches a saved build and drops it into the store.
 *
 * `loadBuild` is recreated whenever the build changes, so it is held in a ref
 * rather than listed as a dependency — otherwise loading the build would
 * change the identity of the function that loaded it and the effect would run
 * forever.
 */
function SharedBuildLoader({ code }: { code: string }) {
  const { loadBuild } = useBuild();
  const load = React.useRef(loadBuild);
  load.current = loadBuild;

  const [state, setState] = React.useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    // Deliberately no "already requested" ref here. Under reactStrictMode the
    // effect mounts, cleans up, then mounts again. A ref keyed on `code` would
    // still equal `code` on that second pass, so it would bail out — while the
    // first pass's response had already been thrown away by its own cleanup.
    // The banner then sat on "Opening build…" forever and /builder?load= never
    // delivered anything. `cancelled` alone is enough to drop a stale response;
    // the only cost is one extra GET in development.
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/builds/${encodeURIComponent(code)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error("not found");
        const data: unknown = await response.json();
        const build = sanitizeBuildState(
          (data as { build?: unknown } | null)?.build,
        );
        if (cancelled) return;
        if (!build) {
          setState("failed");
          return;
        }
        load.current(build);
        setState("loaded");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        "container-page pt-4",
        state === "loading" && "animate-pulse",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs",
          state === "failed"
            ? "border-rose/30 bg-rose/[0.07] text-rose"
            : "border-cyan/25 bg-cyan/[0.06] text-cyan",
        )}
      >
        <span className="flex-1">
          {state === "loading"
            ? `Opening build ${code}…`
            : state === "loaded"
              ? `Build ${code} loaded. Any change starts a new saved copy.`
              : `Build ${code} could not be found. It may have been removed.`}
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
