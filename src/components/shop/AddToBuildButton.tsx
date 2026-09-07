"use client";

/**
 * "Add to build" — the bridge from the catalogue into the PC builder.
 *
 * The builder only has steps for the kinds in `BUILDER_STEP_KINDS`; for a
 * mousepad or a chair there is nothing to add it to, so the button becomes the
 * site's primary call to action instead of silently doing nothing.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { useBuild } from "@/lib/build-store";
import {
  BUILDER_STEP_KINDS,
  KIND_META,
  type BuilderPart,
  type ComponentKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = {
  md: "h-11 text-sm",
  lg: "h-13 text-[0.9375rem]",
} as const;

export function AddToBuildButton({
  part,
  size = "lg",
  className,
}: {
  part: BuilderPart;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const router = useRouter();
  const build = useBuild();
  const [busy, setBusy] = React.useState(false);

  const kind = part.kind as ComponentKind;
  const isBuilderStep = BUILDER_STEP_KINDS.includes(kind);
  const meta = KIND_META[kind];

  const base = cn(
    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-6",
    "font-semibold tracking-wide transition-all duration-200",
    "border border-line-strong text-chrome",
    "hover:border-cyan/60 hover:bg-cyan/5 hover:text-white",
    "disabled:pointer-events-none disabled:opacity-45",
    SIZES[size],
    className,
  );

  if (!isBuilderStep) {
    return (
      <Link href="/builder" className={base}>
        <Wrench className="h-4 w-4" aria-hidden="true" />
        BUILD YOUR PC
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        // Storage and fans stack; everything else replaces the current pick.
        if (meta?.multiple) build.addPart(kind, part);
        else build.setPart(kind, part);
        router.push("/builder");
      }}
      className={base}
    >
      <Wrench className="h-4 w-4" aria-hidden="true" />
      ADD TO BUILD
    </button>
  );
}
