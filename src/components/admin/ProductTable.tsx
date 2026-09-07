"use client";

/**
 * Yalman Gaming admin — the product table.
 *
 * Everything a shopkeeper changes ten times a day — price, sale price, stock,
 * status, the merchandising flags and the sample-pricing marker — is editable
 * in place. Anything structural (kind, compatibility specs, images, the spec
 * sheet) opens the full editor, because those changes need the per-kind field
 * set to be on screen.
 *
 * Each inline control PATCHes a single field and then calls `router.refresh()`
 * so the derived figures on the page (counts, filters, the sidebar chips)
 * re-read from the database rather than drifting out of step with it.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2 } from "lucide-react";

import { adminDelete, adminPatch } from "@/components/admin/api";
import { PRODUCT_STATUSES } from "@/components/admin/schema";
import type { ProductQuickPatch } from "@/components/admin/payloads";
import { useToast } from "@/components/admin/Toast";
import {
  EmptyRow,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { Spinner } from "@/components/ui";
import type { AdminProductRow } from "@/lib/admin-queries";
import { KIND_META, isComponentKind } from "@/lib/types";
import { cn, formatAmount } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Saving one field                                                           */
/* -------------------------------------------------------------------------- */

function useProductPatch(id: string) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);

  const patch = React.useCallback(
    async (changes: ProductQuickPatch, message = "Saved") => {
      setSaving(true);
      const result = await adminPatch<{ ok: true }>(`/api/admin/products/${id}`, {
        mode: "quick",
        patch: changes,
      });
      setSaving(false);

      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      toast.success(message);
      router.refresh();
      return true;
    },
    [id, router, toast],
  );

  return { patch, saving };
}

/* -------------------------------------------------------------------------- */
/* Inline number cell                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Commits on Enter or blur, and only when the value actually changed. Escape
 * reverts — an admin who starts typing in the wrong row needs a way out that
 * does not write anything.
 */
function InlineNumber({
  value,
  onCommit,
  label,
  nullable = false,
  disabled = false,
  className,
  placeholder = "—",
}: {
  value: number | null;
  onCommit: (next: number | null) => Promise<boolean>;
  label: string;
  nullable?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState(value === null ? "" : String(value));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  async function commit() {
    const trimmed = draft.trim();

    if (trimmed === "") {
      if (!nullable) {
        setDraft(value === null ? "" : String(value));
        return;
      }
      if (value === null) return;
      setBusy(true);
      const ok = await onCommit(null);
      setBusy(false);
      if (!ok) setDraft(value === null ? "" : String(value));
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed === value) {
      setDraft(value === null ? "" : String(value));
      return;
    }

    setBusy(true);
    const ok = await onCommit(parsed);
    setBusy(false);
    if (!ok) setDraft(value === null ? "" : String(value));
  }

  return (
    <span className="relative inline-flex items-center">
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft}
        disabled={disabled || busy}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(value === null ? "" : String(value));
            event.currentTarget.blur();
          }
        }}
        className={cn(
          "tnum w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-sm text-chrome",
          "hover:border-[var(--color-line-strong)] focus:border-cyan/60 focus:bg-carbon focus:outline-none",
          "disabled:opacity-50",
          className,
        )}
      />
      {busy && <Spinner className="pointer-events-none absolute -left-4 h-3 w-3 text-cyan" />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Flag toggle                                                                */
/* -------------------------------------------------------------------------- */

function FlagToggle({
  on,
  label,
  short,
  tone,
  onToggle,
}: {
  on: boolean;
  label: string;
  short: string;
  tone: "cyan" | "violet" | "rose";
  onToggle: (next: boolean) => void;
}) {
  const tones = {
    cyan: "border-cyan/50 bg-cyan/15 text-cyan",
    violet: "border-violet/50 bg-violet/15 text-violet",
    rose: "border-rose/50 bg-rose/15 text-rose",
  } as const;

  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      aria-pressed={on}
      title={`${label}: ${on ? "on" : "off"}`}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-[0.625rem] font-semibold uppercase transition-colors",
        on
          ? tones[tone]
          : "border-[var(--color-line)] text-ash hover:border-[var(--color-line-strong)] hover:text-silver",
      )}
    >
      {short}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                        */
/* -------------------------------------------------------------------------- */

function ProductRow({ product }: { product: AdminProductRow }) {
  const { patch, saving } = useProductPatch(product.id);
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // The confirm state must not linger — an armed delete button sitting in a
  // table is an accident waiting to happen.
  React.useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/products/${product.id}`);
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${product.name} deleted.`);
    router.refresh();
  }

  const image = product.images[0];
  const kindLabel = isComponentKind(product.kind)
    ? KIND_META[product.kind].label
    : product.kind;

  return (
    <Tr className={saving ? "opacity-70" : undefined}>
      <Td className="min-w-64">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-12 shrink-0 place-items-center rounded border border-[var(--color-line)] bg-carbon p-1">
            {image ? (
              <Image
                src={image.url}
                alt=""
                width={40}
                height={30}
                // Line-art placeholders sit on a transparent ground: contain
                // them with padding rather than cropping like a photograph.
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="font-mono text-[0.5rem] uppercase text-ash">none</span>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/products/${product.id}`}
              className="block truncate text-sm text-chrome hover:text-cyan"
            >
              {product.name}
            </Link>
            <SubText className="truncate font-mono">
              {product.sku}
              {product.brand ? ` · ${product.brand.name}` : ""}
            </SubText>
          </div>
        </div>
      </Td>

      <Td>
        <span className="text-xs text-silver">{kindLabel}</span>
        {product.category && <SubText className="truncate">{product.category.name}</SubText>}
      </Td>

      <Td>
        <select
          value={product.status}
          aria-label={`Status of ${product.name}`}
          onChange={(event) =>
            patch(
              { status: event.target.value as ProductQuickPatch["status"] },
              `${product.name} is now ${event.target.value}.`,
            )
          }
          className="rounded border border-[var(--color-line-strong)] bg-carbon px-1.5 py-1 text-xs text-chrome focus:border-cyan/60 focus:outline-none"
        >
          {PRODUCT_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </Td>

      <Td align="right">
        <InlineNumber
          value={product.price}
          label={`Price of ${product.name} in rupees`}
          onCommit={(next) =>
            next === null ? Promise.resolve(false) : patch({ price: next }, "Price updated.")
          }
        />
        {product.samplePrice ? (
          <button
            type="button"
            onClick={() =>
              patch(
                { samplePrice: false },
                `${product.name} is now marked as a confirmed price.`,
              )
            }
            title="Clear the sample marker once this is the real Yalman Gaming price"
            className="mt-0.5 inline-flex items-center gap-1 rounded border border-ember/40 bg-ember/10 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-ember transition-colors hover:bg-ember/20"
          >
            <Check className="h-2.5 w-2.5" />
            sample — confirm
          </button>
        ) : (
          <SubText className="font-mono text-[0.5625rem] uppercase tracking-wider text-emerald/70">
            confirmed
          </SubText>
        )}
      </Td>

      <Td align="right">
        <InlineNumber
          value={product.salePrice}
          nullable
          label={`Sale price of ${product.name} in rupees`}
          onCommit={(next) => patch({ salePrice: next }, "Sale price updated.")}
        />
      </Td>

      <Td align="right">
        <InlineNumber
          value={product.stock}
          label={`Stock of ${product.name}`}
          onCommit={(next) =>
            next === null ? Promise.resolve(false) : patch({ stock: next }, "Stock updated.")
          }
          className={cn(
            product.stock <= 0 && "text-rose",
            product.stock > 0 && product.stock <= product.lowStockAt && "text-ember",
          )}
        />
        <SubText className="font-mono">low at {product.lowStockAt}</SubText>
      </Td>

      <Td>
        <div className="flex items-center gap-1">
          <FlagToggle
            on={product.featured}
            label="Featured"
            short="F"
            tone="cyan"
            onToggle={(next) => patch({ featured: next }, next ? "Featured." : "Unfeatured.")}
          />
          <FlagToggle
            on={product.isNew}
            label="New arrival"
            short="N"
            tone="violet"
            onToggle={(next) => patch({ isNew: next })}
          />
          <FlagToggle
            on={product.onDeal}
            label="On deal"
            short="D"
            tone="rose"
            onToggle={(next) => patch({ onDeal: next })}
          />
        </div>
      </Td>

      <Td align="right">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/products/${product.id}`}
            aria-label={`Edit ${product.name}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line-strong)] text-silver transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>

          {confirming ? (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="inline-flex h-7 items-center gap-1 rounded border border-rose/60 bg-rose/15 px-2 font-mono text-[0.625rem] uppercase text-rose disabled:opacity-50"
            >
              {deleting ? <Spinner className="h-3 w-3" /> : null}
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${product.name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--color-line-strong)] text-silver transition-colors hover:border-rose/50 hover:text-rose"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Td>
    </Tr>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export function ProductTable({
  products,
  total,
}: {
  products: AdminProductRow[];
  total: number;
}) {
  return (
    <>
      <TableShell minWidth="72rem">
        <caption className="sr-only">
          {formatAmount(total)} products. Price, sale price, stock, status and the
          merchandising flags are editable in this table.
        </caption>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th align="right">Price</Th>
            <Th align="right">Sale</Th>
            <Th align="right">Stock</Th>
            <Th>Flags</Th>
            <Th align="right">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <EmptyRow
              colSpan={8}
              title="No products match this view"
              description="Clear the filters, or add a product. Nothing has been deleted — this is only what the current filter selects."
            />
          ) : (
            products.map((product) => <ProductRow key={product.id} product={product} />)
          )}
        </tbody>
      </TableShell>

      <p className="border-t border-[var(--color-line)] px-4 py-2 text-[0.6875rem] leading-relaxed text-ash">
        <span className="font-mono uppercase tracking-wider">F</span> featured ·{" "}
        <span className="font-mono uppercase tracking-wider">N</span> new arrival ·{" "}
        <span className="font-mono uppercase tracking-wider">D</span> on deal. Prices
        are whole rupees. Press Enter to save a cell, Escape to discard it.
      </p>
    </>
  );
}
