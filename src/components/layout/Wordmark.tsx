/**
 * Yalman Gaming — the wordmark.
 *
 * There is no logo asset, so the mark is entirely typographic and drawn in
 * code: `YALMAN` set heavy in the display face with a chrome gradient, and
 * `GAMING` set in the mono face with wide tracking underneath or beside it.
 * The pairing is the identity — a display weight against a technical monospace
 * is the same contrast the rest of the site uses for headings against specs.
 *
 * Everything is sized in `em`, so a caller only ever sets one font size (or
 * passes a `size` preset) and the two halves plus the glyph scale together.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type WordmarkSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<WordmarkSize, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

/**
 * The glyph: a `Y` cut as three strokes inside a bevelled tile. Drawn rather
 * than imported so it inherits the accent gradient and never 404s.
 */
export function WordmarkGlyph({ className }: { className?: string }) {
  const gradientId = React.useId();

  return (
    <span
      className={cn(
        "relative grid aspect-square h-[1.5em] shrink-0 place-items-center",
        "rounded-[0.34em] border border-line-strong",
        "bg-gradient-to-br from-white/[0.09] to-white/[0.01]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[0.92em] w-[0.92em]"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-cyan)" />
            <stop offset="55%" stopColor="var(--color-sky)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
        </defs>
        {/* The Y itself: two shoulders meeting a stem. The stem is deliberately
            long relative to the shoulders — at 16px in a header the short-stem
            version reads as a chevron rather than a letter. */}
        <path
          d="M4.5 5 L12 12 L19.5 5"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.8"
        />
        <path d="M12 12 V19.5" stroke={`url(#${gradientId})`} strokeWidth="2.8" />
      </svg>
    </span>
  );
}

export function Wordmark({
  size = "md",
  className,
  glyph = true,
  stacked = false,
}: {
  size?: WordmarkSize;
  className?: string;
  /** Show the bevelled `Y` tile before the type. */
  glyph?: boolean;
  /** Set `GAMING` under `YALMAN` instead of beside it. */
  stacked?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-[0.5em] leading-none",
        SIZES[size],
        className,
      )}
    >
      {glyph && <WordmarkGlyph />}

      <span
        className={cn(
          "inline-flex leading-none",
          stacked
            ? "flex-col items-start gap-[0.34em]"
            : "flex-row items-baseline gap-[0.46em]",
        )}
      >
        <span className="font-display font-bold tracking-[-0.035em] text-chrome-gradient">
          YALMAN
        </span>
        {/* Negative end margin absorbs the trailing space that letter-spacing
            adds after the final glyph, so the lockup stays optically centred. */}
        <span className="mr-[-0.34em] font-mono text-[0.46em] font-medium uppercase tracking-[0.34em] text-cyan">
          Gaming
        </span>
      </span>
    </span>
  );
}

export default Wordmark;
