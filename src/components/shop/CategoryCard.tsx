/**
 * Category tiles for the shop landing and the home page browse rail.
 *
 * Environment-agnostic on purpose: no hooks, no data access, only lucide and a
 * link. That lets the client-side `ProductCard` reuse `KindGlyph` for its image
 * fallback without dragging a server module into the browser bundle.
 */

import Link from "next/link";
import {
  Armchair,
  Box,
  CircuitBoard,
  Cpu,
  Fan,
  Gamepad2,
  Gpu,
  HardDrive,
  Headphones,
  Keyboard,
  MemoryStick,
  Mic,
  Monitor,
  MonitorCog,
  Mouse,
  Package,
  PcCase,
  PlugZap,
  Speaker,
  Square,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { CategoryNode } from "@/lib/catalog";
import { KIND_META, isComponentKind, type ComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Kind glyphs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Explicit map rather than a lookup by `KIND_META.icon` string: a missing icon
 * name would fail silently at runtime, whereas a wrong import fails the build.
 */
const KIND_ICONS: Record<ComponentKind, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  gpu: Gpu,
  ram: MemoryStick,
  storage: HardDrive,
  psu: PlugZap,
  cooler: Fan,
  case: Box,
  fan: Wind,
  os: MonitorCog,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headphones,
  microphone: Mic,
  webcam: Video,
  chair: Armchair,
  controller: Gamepad2,
  mousepad: Square,
  speaker: Speaker,
  prebuilt: PcCase,
};

export function KindGlyph({
  kind,
  className,
}: {
  kind: string | null | undefined;
  className?: string;
}) {
  const Icon = kind && isComponentKind(kind) ? KIND_ICONS[kind] : Package;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.5} />;
}

/* -------------------------------------------------------------------------- */
/* Accents                                                                    */
/* -------------------------------------------------------------------------- */

/** Category rows carry an optional accent name; anything unknown falls back. */
const ACCENTS: Record<string, { glow: string; icon: string; edge: string }> = {
  cyan: { glow: "from-cyan/20", icon: "text-cyan", edge: "group-hover:border-cyan/40" },
  violet: {
    glow: "from-violet/20",
    icon: "text-violet",
    edge: "group-hover:border-violet/40",
  },
  ember: { glow: "from-ember/20", icon: "text-ember", edge: "group-hover:border-ember/40" },
  emerald: {
    glow: "from-emerald/20",
    icon: "text-emerald",
    edge: "group-hover:border-emerald/40",
  },
  rose: { glow: "from-rose/20", icon: "text-rose", edge: "group-hover:border-rose/40" },
  lime: { glow: "from-lime/20", icon: "text-lime", edge: "group-hover:border-lime/40" },
  sky: { glow: "from-sky/20", icon: "text-sky", edge: "group-hover:border-sky/40" },
};

function accentOf(name: string | null | undefined) {
  return (name && ACCENTS[name]) || ACCENTS.cyan;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export type CategoryCardData = {
  name: string;
  href: string;
  description?: string | null;
  kind?: string | null;
  accent?: string | null;
  productCount?: number;
};

export function CategoryCard({
  category,
  compact = false,
  className,
}: {
  category: CategoryCardData | CategoryNode;
  compact?: boolean;
  className?: string;
}) {
  const accent = accentOf(category.accent);
  const count = category.productCount ?? 0;

  return (
    <Link
      href={category.href}
      className={cn(
        "metal group relative isolate flex flex-col overflow-hidden rounded-2xl",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        accent.edge,
        compact ? "gap-2 p-4" : "gap-3 p-5",
        className,
      )}
    >
      {/* Corner wash — the only colour on the tile until it is hovered. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 -z-10 h-28 w-28 rounded-full",
          "bg-gradient-to-br to-transparent opacity-60 blur-2xl transition-opacity duration-300",
          "group-hover:opacity-100",
          accent.glow,
        )}
      />

      <KindGlyph
        kind={category.kind}
        className={cn(compact ? "h-6 w-6" : "h-8 w-8", accent.icon)}
      />

      <div className="min-w-0">
        <h3
          className={cn(
            "font-display font-semibold leading-tight text-chrome",
            compact ? "text-sm" : "text-base",
          )}
        >
          {category.name}
        </h3>
        {!compact && category.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ash">
            {category.description}
          </p>
        )}
      </div>

      {count > 0 && (
        <p className="tnum mt-auto pt-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ash">
          {count} {count === 1 ? "product" : "products"}
        </p>
      )}
    </Link>
  );
}
