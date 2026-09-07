"use client";

/**
 * One selectable part.
 *
 * Two variants share this file because they must stay visually identical: the
 * row a customer taps in the picker and the row that then appears in the build
 * summary are the same object, and a mismatch between them reads as a bug.
 */

import * as React from "react";
import { Check, Minus, Plus, TriangleAlert, X } from "lucide-react";
import type { CandidateVerdict } from "@/lib/compatibility";
import { partPrice } from "@/lib/compatibility";
import type { BuilderPart, ComponentKind } from "@/lib/types";
import { KIND_META } from "@/lib/types";
import { cn, formatPKR, pluralize } from "@/lib/utils";
import { KindGlyph } from "./StepNav";

/* -------------------------------------------------------------------------- */
/* Spec chips                                                                 */
/* -------------------------------------------------------------------------- */

const STORAGE_LABELS: Record<string, string> = {
  "nvme-gen5": "NVMe Gen5",
  "nvme-gen4": "NVMe Gen4",
  sata: "SATA SSD",
  hdd: "Hard Drive",
};

/**
 * The two or three numbers that actually decide a purchase for this kind.
 * Only fields the part really carries are shown — a missing spec is left out
 * rather than rendered as a dash, so nothing reads as a fabricated figure.
 */
export function partSpecChips(part: BuilderPart): string[] {
  const chips: string[] = [];
  const push = (value: string | null | undefined) => {
    if (value) chips.push(value);
  };

  switch (part.kind) {
    case "cpu":
      push(part.socket);
      push(part.tdp ? `${part.tdp}W TDP` : null);
      push(part.integratedGraphics ? "Integrated graphics" : null);
      break;
    case "motherboard":
      push(part.socket);
      push(part.chipset);
      push(part.formFactor);
      push(part.memoryType);
      push(part.m2Slots ? `${part.m2Slots}× M.2` : null);
      break;
    case "gpu":
      push(part.vramGb ? `${part.vramGb}GB VRAM` : null);
      push(part.tdp ? `${part.tdp}W` : null);
      push(part.gpuLengthMm ? `${part.gpuLengthMm}mm` : null);
      break;
    case "ram":
      push(part.capacityGb ? `${part.capacityGb}GB` : null);
      push(part.memoryType);
      push(part.memorySpeed ? `${part.memorySpeed} MT/s` : null);
      push(part.moduleCount ? `${part.moduleCount} sticks` : null);
      break;
    case "storage":
      push(part.capacityGb ? `${part.capacityGb}GB` : null);
      push(
        part.storageInterface
          ? (STORAGE_LABELS[part.storageInterface] ?? part.storageInterface)
          : null,
      );
      break;
    case "psu":
      push(part.wattage ? `${part.wattage}W` : null);
      push(part.efficiency);
      push(part.psuFormFactor);
      break;
    case "cooler":
      push(part.coolerType === "aio" ? "Liquid AIO" : "Air cooler");
      push(part.radiatorSizeMm ? `${part.radiatorSizeMm}mm radiator` : null);
      push(part.coolerHeightMm ? `${part.coolerHeightMm}mm tall` : null);
      push(part.coolingCapacityW ? `${part.coolingCapacityW}W rated` : null);
      break;
    case "case":
      push(part.caseStyle);
      push(part.supportedFormFactors?.join(" / ") ?? null);
      push(part.maxGpuLengthMm ? `GPU to ${part.maxGpuLengthMm}mm` : null);
      push(part.includedFans ? `${part.includedFans} ${pluralize(part.includedFans, "fan")} included` : null);
      break;
    case "fan":
      push(part.rgb ? "RGB" : null);
      break;
    default:
      break;
  }

  if (part.rgb && part.kind !== "fan") push("RGB");
  return chips.slice(0, 4);
}

/* -------------------------------------------------------------------------- */
/* Thumbnail                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Plain `<img>` rather than `next/image`: product photography can come from any
 * host and `next.config.ts` deliberately allows no remote patterns yet. On a
 * broken or missing URL the kind glyph stands in, so a row never collapses.
 */
function Thumb({
  part,
  size = "md",
}: {
  part: BuilderPart;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = React.useState(false);
  const box = size === "sm" ? "h-10 w-10" : "h-14 w-14";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg",
        "border border-line bg-carbon",
        box,
      )}
    >
      {part.imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={part.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <KindGlyph
          kind={part.kind}
          className={cn("text-ash", size === "sm" ? "h-4 w-4" : "h-5 w-5")}
        />
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Status pill                                                                */
/* -------------------------------------------------------------------------- */

function VerdictPill({ verdict }: { verdict: CandidateVerdict }) {
  if (verdict.blocker) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose/35 bg-rose/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-rose">
        <X className="h-3 w-3" aria-hidden="true" />
        Not compatible
      </span>
    );
  }
  if (verdict.warnings.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ember/35 bg-ember/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-ember">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-emerald">
      <Check className="h-3 w-3" aria-hidden="true" />
      OK
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Picker row                                                                 */
/* -------------------------------------------------------------------------- */

export function PartPickRow({
  part,
  verdict,
  selected = false,
  onSelect,
  className,
}: {
  part: BuilderPart;
  verdict: CandidateVerdict;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const blocked = !verdict.compatible;
  const price = partPrice(part);
  const chips = partSpecChips(part);
  const reasonId = React.useId();

  return (
    <button
      type="button"
      // `aria-disabled` rather than `disabled`: a blocked option must stay
      // focusable so a screen-reader user can reach the explanation of why it
      // is blocked. The click is refused here instead.
      onClick={() => {
        if (!blocked) onSelect();
      }}
      aria-disabled={blocked || undefined}
      aria-pressed={selected}
      aria-describedby={verdict.blocker ? reasonId : undefined}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border p-3 text-left",
        "transition-[border-color,background-color,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        blocked
          ? "cursor-not-allowed border-rose/20 bg-rose/[0.03] opacity-65"
          : selected
            ? "border-cyan/45 bg-cyan/[0.07]"
            : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.05] active:scale-[0.995]",
        className,
      )}
    >
      <Thumb part={part} />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="min-w-0">
            {part.brandName && (
              <span className="block font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                {part.brandName}
              </span>
            )}
            <span className="block text-sm font-semibold leading-snug text-chrome">
              {part.name}
            </span>
          </span>

          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="tnum font-display text-sm font-semibold text-chrome">
              {formatPKR(price)}
            </span>
            {part.samplePrice && (
              <span
                className="font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
                title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
              >
                sample
              </span>
            )}
          </span>
        </span>

        {chips.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="tnum rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[0.625rem] text-silver"
              >
                {chip}
              </span>
            ))}
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-2">
          <VerdictPill verdict={verdict} />
          {part.stock <= 0 && (
            <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
              out of stock — ask us
            </span>
          )}
          {selected && !blocked && (
            <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-cyan">
              <Check className="h-3 w-3" aria-hidden="true" />
              In your build
            </span>
          )}
        </span>

        {/* The reason an option is greyed out is stated in the row itself, not
            hidden behind a hover tooltip a touch device can never reach. */}
        {verdict.blocker && (
          <span id={reasonId} className="mt-2 block rounded-lg bg-rose/[0.07] p-2">
            <span className="block text-xs font-semibold text-rose">
              {verdict.blocker.title}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-silver">
              {verdict.blocker.detail}
            </span>
          </span>
        )}

        {!verdict.blocker && verdict.warnings.length > 0 && (
          <span className="mt-2 block text-xs leading-relaxed text-ember/90">
            {verdict.warnings[0].title}
          </span>
        )}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary row                                                                */
/* -------------------------------------------------------------------------- */

export function PartSummaryRow({
  part,
  kind,
  quantity = 1,
  onRemove,
  onIncrement,
  onDecrement,
  onEdit,
  flagged = false,
  className,
}: {
  part: BuilderPart;
  kind: ComponentKind;
  quantity?: number;
  onRemove?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onEdit?: () => void;
  /** A compatibility issue names this kind — outline the row in rose. */
  flagged?: boolean;
  className?: string;
}) {
  const price = partPrice(part) * quantity;
  const multiple = KIND_META[kind].multiple;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-2.5",
        flagged
          ? "border-rose/35 bg-rose/[0.05]"
          : "border-line bg-white/[0.02]",
        className,
      )}
    >
      <Thumb part={part} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.5625rem] uppercase tracking-wider text-ash">
          {KIND_META[kind].label}
        </p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="block max-w-full truncate text-left text-sm font-medium text-chrome hover:text-cyan"
          >
            {part.name}
          </button>
        ) : (
          <p className="truncate text-sm font-medium text-chrome">{part.name}</p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <span className="tnum font-mono text-xs text-silver">
            {formatPKR(price)}
          </span>
          {part.samplePrice && (
            <span
              className="font-mono text-[0.5625rem] uppercase tracking-wider text-ash"
              title="Sample pricing seeded for development."
            >
              sample
            </span>
          )}
          {quantity > 1 && (
            <span className="tnum font-mono text-[0.625rem] text-ash">
              ×{quantity}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {multiple && onDecrement && onIncrement && (
          <div className="flex items-center gap-0.5 rounded-lg border border-line">
            <button
              type="button"
              onClick={onDecrement}
              className="flex h-7 w-7 items-center justify-center rounded-l-lg text-ash hover:bg-white/5 hover:text-chrome"
              aria-label={`Remove one ${part.name}`}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="tnum w-5 text-center font-mono text-xs text-chrome">
              {quantity}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              className="flex h-7 w-7 items-center justify-center rounded-r-lg text-ash hover:bg-white/5 hover:text-chrome"
              aria-label={`Add another ${part.name}`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:bg-rose/10 hover:text-rose"
            aria-label={`Remove ${part.name} from the build`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
