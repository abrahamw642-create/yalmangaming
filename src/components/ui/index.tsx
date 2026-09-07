/**
 * Yalman Gaming — shared UI primitives.
 *
 * Every feature area imports from `@/components/ui`. Keep these presentational
 * and dependency-light: no data fetching, no store access. Anything that needs
 * state lives in its own client component elsewhere.
 */

import * as React from "react";
import Link from "next/link";
import { cn, formatPKR, discountPercent, effectivePrice } from "@/lib/utils";
import { stockState } from "@/lib/types";

/* ========================================================================== */
/* Button                                                                     */
/* ========================================================================== */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "success"
  | "whatsapp";
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const BUTTON_BASE =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold " +
  "transition-all duration-200 select-none whitespace-nowrap " +
  "disabled:pointer-events-none disabled:opacity-45";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // The site's primary action — BUILD YOUR PC — is deliberately the only
  // element with this much luminance.
  primary:
    "bg-gradient-to-b from-cyan to-sky text-void shadow-glow-sm " +
    "hover:shadow-glow hover:brightness-110 active:brightness-95",
  secondary:
    "metal text-chrome hover:border-line-strong hover:text-white " +
    "hover:shadow-glow-xs",
  ghost: "text-silver hover:bg-white/5 hover:text-chrome",
  outline:
    "border border-line-strong bg-transparent text-chrome " +
    "hover:border-cyan/60 hover:bg-cyan/5 hover:text-white",
  danger:
    "bg-rose/90 text-white hover:bg-rose " +
    "shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]",
  success:
    "bg-emerald/90 text-void hover:bg-emerald " +
    "shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]",
  whatsapp:
    "bg-[#25D366] text-[#04250f] hover:brightness-110 " +
    "shadow-[0_0_24px_-6px_rgba(37,211,102,0.6)]",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs tracking-wide",
  md: "h-11 px-5 text-sm tracking-wide",
  lg: "h-13 px-7 text-[0.9375rem] tracking-wide",
  xl: "h-15 px-9 text-base tracking-wide",
  icon: "h-10 w-10 p-0",
};

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export type ButtonProps = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export type ButtonLinkProps = ButtonBaseProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">;

/** Same visual language as `Button`, rendered as a Next link. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ========================================================================== */
/* Badge                                                                      */
/* ========================================================================== */

export type BadgeTone =
  | "neutral"
  | "cyan"
  | "violet"
  | "ember"
  | "emerald"
  | "rose"
  | "lime";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-white/5 text-silver",
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
  violet: "border-violet/30 bg-violet/10 text-violet",
  ember: "border-ember/30 bg-ember/10 text-ember",
  emerald: "border-emerald/30 bg-emerald/10 text-emerald",
  rose: "border-rose/30 bg-rose/10 text-rose",
  lime: "border-lime/30 bg-lime/10 text-lime",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5",
        "font-mono text-[0.6875rem] font-medium uppercase tracking-wider",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ========================================================================== */
/* Price                                                                      */
/* ========================================================================== */

/**
 * Renders a price, its struck-through original when discounted, and — when the
 * figure is still seeded sample data — a marker so nobody mistakes it for a
 * confirmed Yalman Gaming price.
 */
export function Price({
  price,
  salePrice,
  samplePrice = false,
  size = "md",
  className,
  showSampleNote = true,
}: {
  price: number;
  salePrice?: number | null;
  samplePrice?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSampleNote?: boolean;
}) {
  const paying = effectivePrice({ price, salePrice });
  const off = discountPercent({ price, salePrice });

  const sizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  } as const;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "tnum font-display font-semibold text-chrome",
          sizes[size],
        )}
      >
        {formatPKR(paying)}
      </span>
      {off !== null && (
        <>
          <span className="tnum text-sm text-ash line-through">
            {formatPKR(price)}
          </span>
          <Badge tone="rose">−{off}%</Badge>
        </>
      )}
      {samplePrice && showSampleNote && (
        <span
          className="font-mono text-[0.625rem] uppercase tracking-wider text-ash"
          title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
        >
          sample
        </span>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Rating                                                                     */
/* ========================================================================== */

export function Rating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  value: number;
  count?: number | null;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}) {
  const px = { sm: 12, md: 15, lg: 20 }[size];
  const label =
    count != null
      ? `Rated ${value} out of 5 from ${count} reviews`
      : `Rated ${value} out of 5`;

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={label}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          // Fraction of this star that should be filled, 0–1.
          const fill = Math.max(0, Math.min(1, value - i));
          return <Star key={i} size={px} fill={fill} />;
        })}
      </div>
      {showValue && (
        <span className="tnum text-xs font-medium text-silver">
          {value.toFixed(1)}
        </span>
      )}
      {count != null && (
        <span className="tnum text-xs text-ash">({count})</span>
      )}
    </div>
  );
}

function Star({ size, fill }: { size: number; fill: number }) {
  // A unique id per instance keeps multiple ratings on one page from sharing
  // (and therefore clobbering) each other's gradient definitions.
  const id = React.useId();
  const path =
    "M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45l-5.81 3.05 1.11-6.47L2.6 9.45l6.5-.95z";

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fill * 100}%`} stopColor="var(--color-ember)" />
          <stop offset={`${fill * 100}%`} stopColor="rgba(148,163,200,0.22)" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${id})`} />
    </svg>
  );
}

/* ========================================================================== */
/* Stock                                                                      */
/* ========================================================================== */

export function StockIndicator({
  stock,
  lowStockAt = 3,
  className,
  showCount = false,
}: {
  stock: number;
  lowStockAt?: number;
  className?: string;
  showCount?: boolean;
}) {
  const state = stockState(stock, lowStockAt);

  const config = {
    "in-stock": { tone: "emerald", label: "In Stock", dot: "bg-emerald" },
    "low-stock": {
      tone: "ember",
      label: showCount ? `Only ${stock} left` : "Low Stock",
      dot: "bg-ember",
    },
    "out-of-stock": { tone: "rose", label: "Out of Stock", dot: "bg-rose" },
  }[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        state === "in-stock" && "text-emerald",
        state === "low-stock" && "text-ember",
        state === "out-of-stock" && "text-rose",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

/* ========================================================================== */
/* Layout blocks                                                              */
/* ========================================================================== */

export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative py-20 md:py-28", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        action && "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-4 text-base leading-relaxed text-silver">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  className,
  children,
  as,
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  // A bare `React.ElementType` is the union of every intrinsic element, so TS
  // intersects their props and collapses `children` to `never`. Narrowing to
  // the two props this actually forwards keeps `<Card as="section">` working.
  const Tag = (as ?? "div") as React.ElementType<{
    className?: string;
    children?: React.ReactNode;
  }>;

  return <Tag className={cn("metal rounded-2xl", className)}>{children}</Tag>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("rule-fade my-8", className)} />;
}

/* ========================================================================== */
/* Feedback                                                                   */
/* ========================================================================== */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed",
        "border-line-strong px-6 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="text-ash">{icon}</div>}
      <div>
        <p className="font-display text-lg font-semibold text-chrome">{title}</p>
        {description && (
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-silver">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="metal flex flex-col gap-3 rounded-2xl p-4">
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

/* ========================================================================== */
/* Data display                                                               */
/* ========================================================================== */

export function SpecList({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-[var(--color-line)]", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 py-2.5"
        >
          <dt className="text-sm text-ash">{row.label}</dt>
          <dd className="tnum text-right text-sm font-medium text-chrome">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal meter used for PSU load, budget usage and stock levels. */
export function Meter({
  value,
  max,
  label,
  tone = "cyan",
  caption,
  className,
}: {
  value: number;
  max: number;
  label?: string;
  tone?: "cyan" | "emerald" | "ember" | "rose" | "violet";
  caption?: React.ReactNode;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar = {
    cyan: "bg-gradient-to-r from-cyan to-sky",
    emerald: "bg-gradient-to-r from-emerald to-lime",
    ember: "bg-gradient-to-r from-ember to-[#fbbf24]",
    rose: "bg-gradient-to-r from-rose to-[#fb7185]",
    violet: "bg-gradient-to-r from-violet to-cyan",
  }[tone];

  return (
    <div className={className}>
      {(label || caption) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && <span className="text-xs text-ash">{label}</span>}
          {caption && (
            <span className="tnum text-xs font-medium text-silver">{caption}</span>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Misc                                                                       */
/* ========================================================================== */

/**
 * Small caution strip used wherever seeded sample pricing is on screen, so the
 * distinction between placeholder and confirmed figures is never ambiguous.
 */
export function SamplePricingNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-ember/25 bg-ember/[0.07] px-3 py-2",
        "text-xs leading-relaxed text-ember/90",
        className,
      )}
    >
      <strong className="font-semibold">Sample pricing.</strong> Figures marked
      &ldquo;sample&rdquo; are placeholders for development. Confirm current
      pricing and availability with Yalman Gaming before ordering.
    </p>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
