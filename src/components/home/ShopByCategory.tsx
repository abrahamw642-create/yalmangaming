"use client";

/**
 * Section 4 — Shop by category.
 *
 * A client component only because of the pointer response: each tile carries a
 * highlight that tracks the cursor across its face. That is done the cheap way
 * — one pointer handler per tile writing two CSS custom properties inside a
 * single `requestAnimationFrame`, no React state and therefore no re-render, so
 * a grid of a dozen tiles costs nothing to move a mouse across. The effect is
 * skipped outright on coarse pointers and under `prefers-reduced-motion`, where
 * the tiles are plain links with a hover border.
 *
 * The data is fetched on the server by the page and passed in already flattened
 * — this file never touches Prisma or the catalog.
 *
 * `KindGlyph` is imported from `@/components/shop/CategoryCard`, which is
 * deliberately hook-free and data-free so both server and client surfaces can
 * use it.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircuitBoard,
  Keyboard,
  Monitor,
  PcCase,
  type LucideIcon,
} from "lucide-react";
import { KindGlyph } from "@/components/shop/CategoryCard";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { isComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/** The flat, serialisable shape the page hands over. */
export type HomeCategory = {
  id: string;
  name: string;
  href: string;
  description: string | null;
  kind: string | null;
  /** lucide icon name from the Category row — used for grouping nodes. */
  icon: string | null;
  accent: string | null;
  productCount: number;
  /** Names of a few things inside, shown as a hint on the large tiles. */
  highlights?: string[];
};

/* -------------------------------------------------------------------------- */
/* Glyphs                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A grouping category — "Components", "Accessories" — has no `kind`, so
 * `KindGlyph` would fall back to a generic parcel for the two biggest tiles on
 * the section. Those rows do carry an icon *name*, so a small explicit map
 * covers them. Explicit rather than a lookup across the whole lucide barrel:
 * a wrong name here fails the build instead of rendering nothing at runtime.
 */
const GROUP_ICONS: Record<string, LucideIcon> = {
  "circuit-board": CircuitBoard,
  keyboard: Keyboard,
  "pc-case": PcCase,
  monitor: Monitor,
};

function CategoryGlyph({
  category,
  className,
}: {
  category: HomeCategory;
  className?: string;
}) {
  if (category.kind && isComponentKind(category.kind)) {
    return <KindGlyph kind={category.kind} className={className} />;
  }

  const Icon = category.icon ? GROUP_ICONS[category.icon] : undefined;
  if (Icon) {
    return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
  }

  return <KindGlyph kind={category.kind} className={className} />;
}

/* -------------------------------------------------------------------------- */
/* Accents                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Category rows carry a free-text accent name. Anything unrecognised falls
 * back to cyan rather than rendering an empty class string.
 */
const ACCENTS: Record<
  string,
  { icon: string; edge: string; wash: string; glow: string }
> = {
  cyan: {
    icon: "text-cyan",
    edge: "hover:border-cyan/40",
    wash: "from-cyan/15",
    glow: "rgba(34,211,238,0.14)",
  },
  violet: {
    icon: "text-violet",
    edge: "hover:border-violet/40",
    wash: "from-violet/15",
    glow: "rgba(168,85,247,0.14)",
  },
  ember: {
    icon: "text-ember",
    edge: "hover:border-ember/40",
    wash: "from-ember/15",
    glow: "rgba(245,158,11,0.13)",
  },
  emerald: {
    icon: "text-emerald",
    edge: "hover:border-emerald/40",
    wash: "from-emerald/15",
    glow: "rgba(16,185,129,0.13)",
  },
  rose: {
    icon: "text-rose",
    edge: "hover:border-rose/40",
    wash: "from-rose/15",
    glow: "rgba(244,63,94,0.13)",
  },
  lime: {
    icon: "text-lime",
    edge: "hover:border-lime/40",
    wash: "from-lime/15",
    glow: "rgba(132,204,22,0.13)",
  },
  sky: {
    icon: "text-sky",
    edge: "hover:border-sky/40",
    wash: "from-sky/15",
    glow: "rgba(56,189,248,0.14)",
  },
};

function accentOf(name: string | null | undefined) {
  return (name && ACCENTS[name]) || ACCENTS.cyan;
}

/* -------------------------------------------------------------------------- */
/* Pointer response                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Resolved once per document, lazily. A pointer that cannot hover has nothing
 * to track, and a stated motion preference outranks the effect entirely.
 */
let pointerEffectAllowed: boolean | null = null;

function canTrackPointer(): boolean {
  if (pointerEffectAllowed !== null) return pointerEffectAllowed;
  pointerEffectAllowed =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return pointerEffectAllowed;
}

/** Shared pointer plumbing: writes `--px` / `--py` on the hovered tile. */
function usePointerHighlight() {
  const frame = React.useRef(0);

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!canTrackPointer()) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.setProperty("--px", `${x.toFixed(1)}%`);
        el.style.setProperty("--py", `${y.toFixed(1)}%`);
      });
    },
    [],
  );

  return onPointerMove;
}

/* -------------------------------------------------------------------------- */
/* Section                                                                    */
/* -------------------------------------------------------------------------- */

export function ShopByCategory({
  primary,
  secondary,
}: {
  /** Top-level departments, rendered large. */
  primary: HomeCategory[];
  /** Popular sub-categories, rendered as a compact grid. */
  secondary: HomeCategory[];
}) {
  const onPointerMove = usePointerHighlight();

  if (!primary.length && !secondary.length) return null;

  return (
    <section
      id="categories"
      aria-labelledby="categories-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Browse"
            title={<span id="categories-heading">Shop by category</span>}
            description="Everything we stock, sorted the way you would ask for it across the counter."
            action={
              <ButtonLink href="/shop" variant="outline" size="md">
                ALL PRODUCTS
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
        </Reveal>

        {primary.length > 0 && (
          <Reveal delay={0.05} className="mt-10">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {primary.map((category) => (
                <li key={category.id}>
                  <PrimaryTile
                    category={category}
                    onPointerMove={onPointerMove}
                  />
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {secondary.length > 0 && (
          <Reveal delay={0.08} className="mt-4">
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {secondary.map((category) => (
                <li key={category.id}>
                  <CompactTile
                    category={category}
                    onPointerMove={onPointerMove}
                  />
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

type TileProps = {
  category: HomeCategory;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
};

function PrimaryTile({ category, onPointerMove }: TileProps) {
  const accent = accentOf(category.accent);

  return (
    <Link
      href={category.href}
      onPointerMove={onPointerMove}
      className={cn(
        "metal group relative isolate flex h-full flex-col overflow-hidden rounded-2xl p-6",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        accent.edge,
      )}
    >
      <PointerWash glow={accent.glow} />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 -z-10 h-32 w-32 rounded-full",
          "bg-gradient-to-br to-transparent opacity-70 blur-2xl",
          accent.wash,
        )}
      />

      <CategoryGlyph
        category={category}
        className={cn("h-9 w-9 shrink-0", accent.icon)}
      />

      <h3 className="mt-5 font-display text-lg font-semibold leading-tight text-chrome">
        {category.name}
      </h3>

      {category.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ash">
          {category.description}
        </p>
      )}

      {category.highlights && category.highlights.length > 0 && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-silver/70">
          {category.highlights.join(" · ")}
        </p>
      )}

      <span className="mt-auto flex items-center justify-between pt-5">
        {category.productCount > 0 ? (
          <span className="tnum font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
            {category.productCount} products
          </span>
        ) : (
          <span />
        )}
        <ArrowRight
          className="h-4 w-4 text-ash transition-transform duration-300 group-hover:translate-x-1 group-hover:text-chrome"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function CompactTile({ category, onPointerMove }: TileProps) {
  const accent = accentOf(category.accent);

  return (
    <Link
      href={category.href}
      onPointerMove={onPointerMove}
      className={cn(
        "metal group relative isolate flex h-full flex-col gap-2.5 overflow-hidden rounded-2xl p-4",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        accent.edge,
      )}
    >
      <PointerWash glow={accent.glow} />

      <CategoryGlyph
        category={category}
        className={cn("h-6 w-6 shrink-0", accent.icon)}
      />

      <h3 className="font-display text-sm font-semibold leading-tight text-chrome">
        {category.name}
      </h3>

      {category.productCount > 0 && (
        <span className="tnum mt-auto font-mono text-[0.625rem] uppercase tracking-wider text-ash">
          {category.productCount} products
        </span>
      )}
    </Link>
  );
}

/**
 * The cursor-following highlight. Sits behind the content and only fades in on
 * hover, so on a touch device — where `--px`/`--py` are never written — it is
 * simply never visible.
 */
function PointerWash({ glow }: { glow: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-2xl",
        "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
      )}
      style={{
        background: `radial-gradient(220px circle at var(--px, 50%) var(--py, 50%), ${glow}, transparent 72%)`,
      }}
    />
  );
}

export default ShopByCategory;
