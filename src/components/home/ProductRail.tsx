"use client";

/**
 * Horizontal product rail for the home page.
 *
 * The shop has its own rail in `@/components/shop/ProductGrid`, but that one is
 * a bare scroller meant to sit inside an already-dense listing. The home page
 * needs the same tiles with real controls: a pair of arrow buttons that page
 * through the rail on a desktop, and edge fades so it is obvious there is more
 * to the right. Everything degrades to a plain scroll container — the buttons
 * are an addition to native scrolling, never a replacement for it, so touch and
 * keyboard users are unaffected if the script never runs.
 *
 * Cheap by construction: scroll position is read in a passive listener and only
 * ever flips two booleans, so a fast flick does not re-render the tiles.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductCardData } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** Slack in pixels before an edge counts as "reached" — subpixel scroll math. */
const EDGE_EPSILON = 4;

export function ProductRail({
  products,
  label,
  className,
  priorityCount = 2,
}: {
  products: ProductCardData[];
  /** Accessible name for the scroll region, e.g. "Featured products". */
  label: string;
  className?: string;
  /** Tiles whose image loads eagerly — the ones visible without scrolling. */
  priorityCount?: number;
}) {
  const scroller = React.useRef<HTMLUListElement | null>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });

  const sync = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges((current) => {
      const next = {
        start: el.scrollLeft > EDGE_EPSILON,
        end: el.scrollLeft < max - EDGE_EPSILON,
      };
      return current.start === next.start && current.end === next.end
        ? current
        : next;
    });
  }, []);

  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    // Measured after mount rather than guessed during render: whether the rail
    // overflows depends on the viewport, so there is no correct SSR answer.
    sync();

    el.addEventListener("scroll", sync, { passive: true });

    // A resize changes how many tiles fit, which changes both answers.
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [sync]);

  const page = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    // Just under a full viewport keeps one tile on screen as an anchor.
    el.scrollBy({ left: direction * el.clientWidth * 0.86, behavior: "smooth" });
  };

  if (!products.length) return null;

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={scroller}
        // A scrollable region needs to be focusable and named, otherwise a
        // keyboard user can reach the cards but never scroll between them.
        tabIndex={0}
        role="list"
        aria-label={label}
        className={cn(
          "no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 sm:gap-5",
          "scroll-smooth",
        )}
      >
        {products.map((product, index) => (
          <li
            key={product.id}
            className="w-[15.5rem] shrink-0 snap-start sm:w-[17rem] lg:w-[18.5rem]"
          >
            <ProductCard product={product} priority={index < priorityCount} />
          </li>
        ))}
      </ul>

      {/* Edge fades. Decorative, and only drawn on the side that has more. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-void to-transparent",
          "transition-opacity duration-300",
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-void to-transparent",
          "transition-opacity duration-300",
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Controls sit in normal flow rather than floating over the tiles: the
          cards carry their own hover actions and an overlaid arrow would land
          on top of them. Hidden from assistive tech because they duplicate the
          scrolling the labelled region above already exposes. */}
      {(edges.start || edges.end) && (
        <div className="mt-4 hidden justify-end gap-2 md:flex" aria-hidden="true">
          <RailButton
            direction="prev"
            disabled={!edges.start}
            onClick={() => page(-1)}
          />
          <RailButton
            direction="next"
            disabled={!edges.end}
            onClick={() => page(1)}
          />
        </div>
      )}
    </div>
  );
}

function RailButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl",
        "metal text-silver transition-all duration-200",
        "hover:border-line-strong hover:text-chrome",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default ProductRail;
