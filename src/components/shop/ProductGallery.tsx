"use client";

/**
 * Product image gallery.
 *
 * `ProductImage.placeholder` marks a generated visual rather than a photograph
 * of the actual item — when it is set, the gallery says so. A shopper should
 * never be left thinking a stand-in render is the product they will receive.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KindGlyph } from "./CategoryCard";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id?: string;
  url: string;
  alt?: string | null;
  placeholder?: boolean;
};

export function ProductGallery({
  images,
  name,
  kind,
  className,
}: {
  images: GalleryImage[];
  name: string;
  kind?: string | null;
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [broken, setBroken] = React.useState<Record<number, boolean>>({});

  const usable = images.filter((image) => !!image.url);
  const active = usable[index];
  const showFallback = !active || broken[index];

  const step = (delta: number) => {
    if (!usable.length) return;
    setIndex((current) => (current + delta + usable.length) % usable.length);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="metal group relative aspect-square overflow-hidden rounded-2xl"
        // Left/right arrows move through the set once the viewer has focus.
        tabIndex={usable.length > 1 ? 0 : -1}
        role={usable.length > 1 ? "group" : undefined}
        aria-label={usable.length > 1 ? `${name} — image ${index + 1} of ${usable.length}` : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
      >
        {showFallback ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-steel to-graphite">
            <KindGlyph kind={kind} className="h-1/3 w-1/3 text-iron" />
            <span className="sr-only">{name} — no image available</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={active.url}
            src={active.url}
            alt={active.alt || name}
            onError={() => setBroken((prev) => ({ ...prev, [index]: true }))}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}

        {/* Scan line — a nod to the showroom lighting, not a loading state. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:animate-scan group-hover:opacity-100"
        />

        {usable.length > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => step(-1)} />
            <GalleryArrow side="right" onClick={() => step(1)} />
          </>
        )}

        {active?.placeholder && (
          <p className="absolute inset-x-0 bottom-0 bg-void/75 px-3 py-2 text-center font-mono text-[0.625rem] uppercase tracking-wider text-ash backdrop-blur-sm">
            Illustrative image — not a photo of this unit
          </p>
        )}
      </div>

      {usable.length > 1 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {usable.map((image, i) => (
            <li key={image.id ?? image.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${usable.length}`}
                aria-current={i === index}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all duration-200",
                  i === index
                    ? "border-cyan/60 opacity-100"
                    : "border-[var(--color-line)] opacity-60 hover:opacity-100",
                )}
              >
                {broken[i] ? (
                  <span className="flex h-full w-full items-center justify-center bg-graphite">
                    <KindGlyph kind={kind} className="h-6 w-6 text-iron" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setBroken((prev) => ({ ...prev, [i]: true }))}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "glass absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg",
        "text-silver opacity-0 transition-all duration-200",
        "hover:text-chrome group-hover:opacity-100 focus-visible:opacity-100",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
