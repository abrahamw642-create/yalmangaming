/**
 * Yalman Gaming admin — dense UI primitives.
 *
 * The storefront primitives in `@/components/ui` are tuned for a showroom:
 * generous padding, large type, glow. The back office is a working tool used
 * for hours at a time, so these wrap the same design tokens at a much tighter
 * rhythm — small type, tabular numerals, real table semantics.
 *
 * No `"use client"`. Everything here is presentational, so it compiles into
 * whichever boundary imports it: a server page renders it on the server, a
 * client editor renders it in the browser.
 */

import * as React from "react";
import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui";
import { cn, formatPKR } from "@/lib/utils";
import { statusOption, type StatusOption } from "@/components/admin/schema";

/* ========================================================================== */
/* Page furniture                                                             */
/* ========================================================================== */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--color-line)] pb-5",
        "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-chrome">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-silver">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("metal overflow-hidden rounded-xl", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-sm font-semibold text-chrome">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-ash">{description}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A short explanatory strip — used where the data itself needs a caveat. */
export function Note({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "warn" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-[var(--color-line-strong)] bg-white/[0.03] text-silver",
    warn: "border-ember/25 bg-ember/[0.07] text-ember/90",
    info: "border-cyan/25 bg-cyan/[0.06] text-cyan/90",
  } as const;

  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ========================================================================== */
/* Statistics                                                                 */
/* ========================================================================== */

const STAT_TONES = {
  neutral: "text-chrome",
  cyan: "text-cyan",
  ember: "text-ember",
  emerald: "text-emerald",
  rose: "text-rose",
  violet: "text-violet",
} as const;

export type StatTone = keyof typeof STAT_TONES;

/**
 * One figure and what it means. Wrapped in a link when there is somewhere to
 * act on it — a count with no next step is decoration, not a dashboard.
 */
export function StatCard({
  label,
  value,
  caption,
  href,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  href?: string;
  tone?: StatTone;
  className?: string;
}) {
  const body = (
    <>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ash">
        {label}
      </p>
      <p
        className={cn(
          "tnum mt-1.5 font-display text-2xl font-bold leading-none",
          STAT_TONES[tone],
        )}
      >
        {value}
      </p>
      {caption && (
        <p className="mt-1.5 text-xs leading-relaxed text-ash">{caption}</p>
      )}
    </>
  );

  const shell = cn(
    "metal block rounded-xl px-4 py-3.5 transition-colors",
    href && "hover:border-cyan/40",
    className,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/* ========================================================================== */
/* Tables                                                                     */
/* ========================================================================== */

/**
 * Wraps a table in its own horizontal scroller. Admin tables are wide by
 * nature; the *page* must never scroll sideways, so the overflow is contained
 * here and the table is given an explicit minimum width instead.
 */
export function TableShell({
  children,
  minWidth = "56rem",
  className,
}: {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
  scope = "col",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "whitespace-nowrap border-b border-[var(--color-line-strong)] bg-carbon/60 px-3 py-2",
        "font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-ash",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-[var(--color-line)] px-3 py-2.5 align-middle text-chrome",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-white/[0.025]", className)}>
      {children}
    </tr>
  );
}

/** A full-width "nothing here" row inside a table body. */
export function EmptyRow({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-14 text-center">
        <p className="font-display text-sm font-semibold text-chrome">{title}</p>
        {description && (
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ash">
            {description}
          </p>
        )}
      </td>
    </tr>
  );
}

/* ========================================================================== */
/* Values                                                                     */
/* ========================================================================== */

/**
 * A price in the admin. `sample` is not decoration — it is the marker that a
 * figure is still seeded placeholder data rather than a Yalman Gaming price.
 */
export function Money({
  amount,
  sample = false,
  className,
  muted = false,
}: {
  amount: number | null | undefined;
  sample?: boolean;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "tnum font-mono text-sm",
          muted ? "text-ash" : "text-chrome",
        )}
      >
        {formatPKR(amount)}
      </span>
      {sample && (
        <span
          className="font-mono text-[0.625rem] uppercase tracking-wider text-ember/80"
          title="Seeded sample pricing — replace with the confirmed Yalman Gaming price."
        >
          sample
        </span>
      )}
    </span>
  );
}

export function StatusBadge<T extends string>({
  options,
  id,
  className,
}: {
  options: readonly StatusOption<T>[];
  id: string | null | undefined;
  className?: string;
}) {
  const option = statusOption(options, id);
  return (
    <Badge tone={option.tone} className={className}>
      {option.label}
    </Badge>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return <Badge tone={tone}>{children}</Badge>;
}

/** Small dim caption used under a primary cell value. */
export function SubText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("block text-xs text-ash", className)}>{children}</span>;
}

export function DateText({ value }: { value: Date | string }) {
  const date = typeof value === "string" ? new Date(value) : value;
  const iso = date.toISOString();
  return (
    <time dateTime={iso} className="tnum font-mono text-xs text-ash">
      {new Intl.DateTimeFormat("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)}
    </time>
  );
}

/* ========================================================================== */
/* Form controls                                                              */
/* ========================================================================== */

const CONTROL_BASE =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-carbon/80 px-3 py-2 " +
  "text-sm text-chrome placeholder:text-ash/70 " +
  "transition-colors focus:border-cyan/60 focus:outline-none focus:ring-1 focus:ring-cyan/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium tracking-wide text-silver"
      >
        {label}
        {required && <span className="ml-1 text-rose">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ash">{hint}</p>
      ) : null}
    </div>
  );
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(CONTROL_BASE, invalid && "border-rose/60", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/** Right-aligned tabular input for money, stock and other counts. */
export function NumberInput({ className, ...props }: InputProps) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      className={cn("tnum font-mono", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL_BASE, "min-h-24 resize-y", invalid && "border-rose/60", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(CONTROL_BASE, "appearance-none pr-8", invalid && "border-rose/60", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  id,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const generated = React.useId();
  const inputId = id ?? generated;

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-line-strong)] bg-carbon accent-[var(--color-cyan)]"
        {...props}
      />
      <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-chrome">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ash">{hint}</span>}
      </label>
    </div>
  );
}

/** Grid used by every editor form. Two columns from `md` up. */
export function FormGrid({
  children,
  className,
  columns = 2,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ========================================================================== */
/* Navigation between pages of results                                        */
/* ========================================================================== */

/**
 * Link-based paging. Rendered by server pages only, so `hrefFor` is a plain
 * function rather than a serialised prop.
 */
export function Pagination({
  page,
  pages,
  total,
  perPage,
  hrefFor,
  label = "results",
}: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  const linkClass =
    "inline-flex h-8 items-center rounded-lg border border-[var(--color-line-strong)] px-3 " +
    "font-mono text-xs text-chrome transition-colors hover:border-cyan/50 hover:text-white";

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-4 py-3"
      aria-label="Pagination"
    >
      <p className="tnum font-mono text-xs text-ash">
        {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={cn(linkClass, "cursor-not-allowed opacity-40")} aria-disabled>
            Previous
          </span>
        )}
        <span className="tnum font-mono text-xs text-silver">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
            Next
          </Link>
        ) : (
          <span className={cn(linkClass, "cursor-not-allowed opacity-40")} aria-disabled>
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

/* ========================================================================== */
/* Filter chips                                                               */
/* ========================================================================== */

export function ChipLink({
  href,
  active,
  children,
  count,
  tone,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  count?: number;
  tone?: BadgeTone;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-cyan/50 bg-cyan/10 text-cyan"
          : "border-[var(--color-line-strong)] text-silver hover:border-line-strong hover:text-chrome",
        !active && tone === "ember" && "text-ember/90",
        !active && tone === "rose" && "text-rose/90",
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className="tnum font-mono text-[0.6875rem] text-ash">{count}</span>
      )}
    </Link>
  );
}

export function ChipRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}
