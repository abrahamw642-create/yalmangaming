"use client";

/**
 * Yalman Gaming admin — benchmark figures.
 *
 * The storefront prints `source` and `cpuContext` next to every number it
 * shows, because a frame rate without a rig and an origin is not evidence.
 * That is why `source` is required here and cannot be saved blank: an
 * unattributed benchmark is indistinguishable from an invented one, and this
 * site does not publish invented numbers.
 *
 * Products with no rows render "No verified data yet" on the storefront. That
 * is the correct outcome — do not fill a gap with a guess.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
import {
  BENCHMARK_PRESETS,
  BENCHMARK_RESOLUTIONS,
  DEFAULT_BENCHMARK_SOURCE,
  IN_STORE_BENCHMARK_SOURCE,
} from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import {
  Field,
  FormGrid,
  Input,
  Note,
  Panel,
  Select,
  Textarea,
} from "@/components/admin/ui";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type BenchmarkTargetOption = {
  id: string;
  name: string;
  label: string;
  benchmarkCount: number;
};

export type BenchmarkRow = {
  id: string;
  productId: string;
  productName: string;
  game: string;
  resolution: string;
  preset: string;
  avgFps: number;
  onePercentLow: number | null;
  source: string;
  cpuContext: string | null;
  notes: string | null;
};

type FormState = {
  productId: string;
  game: string;
  resolution: string;
  preset: string;
  avgFps: string;
  onePercentLow: string;
  source: string;
  cpuContext: string;
  notes: string;
};

function emptyForm(productId = ""): FormState {
  return {
    productId,
    game: "",
    resolution: "1440p",
    preset: "High",
    avgFps: "",
    onePercentLow: "",
    source: "",
    cpuContext: "",
    notes: "",
  };
}

function formFrom(row: BenchmarkRow): FormState {
  return {
    productId: row.productId,
    game: row.game,
    resolution: row.resolution,
    preset: row.preset,
    avgFps: String(row.avgFps),
    onePercentLow: row.onePercentLow === null ? "" : String(row.onePercentLow),
    source: row.source,
    cpuContext: row.cpuContext ?? "",
    notes: row.notes ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    productId: form.productId,
    game: form.game,
    resolution: form.resolution,
    preset: form.preset,
    avgFps: Number.parseInt(form.avgFps || "0", 10) || 0,
    onePercentLow: form.onePercentLow
      ? Number.parseInt(form.onePercentLow, 10)
      : null,
    source: form.source,
    cpuContext: form.cpuContext || null,
    notes: form.notes || null,
  };
}

/* ========================================================================== */
/* Field set                                                                  */
/* ========================================================================== */

function BenchmarkFields({
  form,
  setForm,
  errors,
  targets,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  targets: BenchmarkTargetOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormGrid columns={3}>
        <Field
          label="Product"
          error={errors.productId}
          required
          className="sm:col-span-2"
        >
          <Select
            value={form.productId}
            invalid={Boolean(errors.productId)}
            onChange={(event) =>
              setForm((current) => ({ ...current, productId: event.target.value }))
            }
          >
            <option value="">Choose a product…</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} — {target.label} ({target.benchmarkCount})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Game" error={errors.game} required>
          <Input
            value={form.game}
            invalid={Boolean(errors.game)}
            onChange={(event) =>
              setForm((current) => ({ ...current, game: event.target.value }))
            }
            placeholder="Cyberpunk 2077"
          />
        </Field>

        <Field label="Resolution" error={errors.resolution} required>
          <Select
            value={form.resolution}
            onChange={(event) =>
              setForm((current) => ({ ...current, resolution: event.target.value }))
            }
          >
            {BENCHMARK_RESOLUTIONS.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Preset" error={errors.preset} required>
          <Select
            value={form.preset}
            onChange={(event) =>
              setForm((current) => ({ ...current, preset: event.target.value }))
            }
          >
            {BENCHMARK_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Average FPS" error={errors.avgFps} required>
          <Input
            value={form.avgFps}
            inputMode="numeric"
            invalid={Boolean(errors.avgFps)}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                avgFps: event.target.value.replace(/[^\d]/g, ""),
              }))
            }
            className="tnum font-mono"
          />
        </Field>

        <Field
          label="1% low FPS"
          error={errors.onePercentLow}
          hint="Optional. Leave blank rather than estimating it."
        >
          <Input
            value={form.onePercentLow}
            inputMode="numeric"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                onePercentLow: event.target.value.replace(/[^\d]/g, ""),
              }))
            }
            className="tnum font-mono"
          />
        </Field>

        <Field
          label="Test CPU"
          error={errors.cpuContext}
          hint="A GPU figure means nothing without the CPU that produced it."
        >
          <Input
            value={form.cpuContext}
            onChange={(event) =>
              setForm((current) => ({ ...current, cpuContext: event.target.value }))
            }
            placeholder="Ryzen 7 9800X3D"
          />
        </Field>
      </FormGrid>

      <Field
        label="Source"
        error={errors.source}
        required
        hint="Printed next to the number on the storefront. Required — every figure this site publishes says where it came from."
      >
        <Input
          value={form.source}
          invalid={Boolean(errors.source)}
          onChange={(event) =>
            setForm((current) => ({ ...current, source: event.target.value }))
          }
          placeholder="Yalman Gaming in-store test"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <SourceChip
          onClick={() => setForm((current) => ({ ...current, source: IN_STORE_BENCHMARK_SOURCE }))}
        >
          {IN_STORE_BENCHMARK_SOURCE}
        </SourceChip>
        <SourceChip
          onClick={() => setForm((current) => ({ ...current, source: DEFAULT_BENCHMARK_SOURCE }))}
        >
          Manufacturer / press aggregate
        </SourceChip>
      </div>

      <Field label="Notes" error={errors.notes} hint="Settings, upscaling, driver version — anything that changes the number.">
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </Field>
    </div>
  );
}

function SourceChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--color-line-strong)] px-2.5 py-1 text-xs text-silver transition-colors hover:border-cyan/50 hover:text-cyan"
    >
      Use: {children}
    </button>
  );
}

/* ========================================================================== */
/* Manager                                                                    */
/* ========================================================================== */

export function BenchmarkManager({
  rows,
  targets,
  presetProductId,
}: {
  rows: BenchmarkRow[];
  targets: BenchmarkTargetOption[];
  presetProductId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => emptyForm(presetProductId));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPost<{ ok: true; id: string }>(
      "/api/admin/benchmarks",
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }

    toast.success("Benchmark row saved.");
    // Keep the product and source so a run of figures for one card is quick.
    setForm((current) => ({
      ...emptyForm(current.productId),
      source: current.source,
      cpuContext: current.cpuContext,
      resolution: current.resolution,
      preset: current.preset,
    }));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <Panel title="Add a benchmark figure">
          <form onSubmit={create} className="flex flex-col gap-4" noValidate>
            <BenchmarkFields
              form={form}
              setForm={setForm}
              errors={errors}
              targets={targets}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" loading={saving}>
                Save figure
              </Button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setErrors({});
                }}
                className="text-sm text-silver hover:text-chrome"
              >
                Done
              </button>
            </div>
            <Note>
              The form keeps the product, source and test CPU after saving, so a run
              of figures for one card takes a few seconds each.
            </Note>
          </form>
        </Panel>
      ) : (
        <div>
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add a benchmark figure
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-4 py-10 text-center text-sm text-ash">
          No benchmark rows in this view. Products without figures show &ldquo;No
          verified data yet&rdquo; on the storefront, which is the honest answer until
          somebody measures one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <BenchmarkCard
              key={row.id}
              row={row}
              targets={targets}
              open={openId === row.id}
              onToggle={() =>
                setOpenId((current) => (current === row.id ? null : row.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BenchmarkCard({
  row,
  targets,
  open,
  onToggle,
}: {
  row: BenchmarkRow;
  targets: BenchmarkTargetOption[];
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>(() => formFrom(row));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setForm(formFrom(row)), [row]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPatch<{ ok: true }>(
      `/api/admin/benchmarks/${row.id}`,
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }
    toast.success("Benchmark row saved.");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/benchmarks/${row.id}`);
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Benchmark row deleted.");
    router.refresh();
  }

  return (
    <li className="metal rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ash transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-chrome">
            {row.productName}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ash">
            {row.game} · {row.resolution} {row.preset} ·{" "}
            <span className="tnum font-mono text-silver">{row.avgFps} FPS</span>
            {row.onePercentLow !== null && (
              <span className="tnum font-mono"> ({row.onePercentLow} low)</span>
            )}
            {row.cpuContext ? ` · with ${row.cpuContext}` : ""}
          </span>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-ash/80">
            Source: {row.source}
          </span>
        </span>
      </button>

      {open && (
        <form
          onSubmit={save}
          className="flex flex-col gap-4 border-t border-[var(--color-line)] p-4"
          noValidate
        >
          <BenchmarkFields
            form={form}
            setForm={setForm}
            errors={errors}
            targets={targets}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" loading={saving}>
              Save
            </Button>
            <Link
              href={`/admin/products/${row.productId}`}
              className="text-xs text-cyan hover:text-white"
            >
              Open the product
            </Link>
            {confirming ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  loading={deleting}
                  onClick={remove}
                >
                  Delete permanently
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-xs text-silver hover:text-chrome"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs text-ash transition-colors hover:text-rose"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}
