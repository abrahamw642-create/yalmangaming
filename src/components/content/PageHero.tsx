import * as React from "react";
import { Breadcrumbs, type Crumb } from "@/components/shop/Breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * The masthead every content page opens with.
 *
 * Deliberately a Server Component with no motion: these pages are read, not
 * played with, and the one animated element on the site should stay the
 * primary CTA. The faint grid and the top-edge glow are the only decoration.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
  actions,
  aside,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  /** Optional right-hand block — a facts panel, a rating, a small card. */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden border-b border-line", className)}>
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-72 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(34,211,238,0.14),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="container-page relative py-10 md:py-16">
        {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} className="mb-6" />}

        <div
          className={cn(
            "flex flex-col gap-8",
            aside && "lg:flex-row lg:items-end lg:justify-between",
          )}
        >
          <div className="max-w-3xl">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-chrome-gradient sm:text-5xl md:text-6xl">
              {title}
            </h1>
            {lede && (
              <div className="mt-5 max-w-2xl text-base leading-relaxed text-silver md:text-lg">
                {lede}
              </div>
            )}
            {actions && (
              <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
            )}
          </div>

          {aside && <div className="lg:w-80 lg:shrink-0">{aside}</div>}
        </div>
      </div>
    </header>
  );
}

/**
 * A prose column at a comfortable measure. Content pages set their own
 * headings rather than relying on a typography plugin, so this only handles
 * width and vertical rhythm.
 */
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl space-y-4 text-[0.9375rem] leading-relaxed text-silver",
        className,
      )}
    >
      {children}
    </div>
  );
}
