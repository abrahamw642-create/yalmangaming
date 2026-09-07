"use client";

/**
 * Yalman Gaming admin — "Built by Yalman" showcase machines.
 *
 * These are real builds the shop has assembled, not configurable products, so
 * the component list is a plain snapshot of what went into that machine rather
 * than a link into the catalogue. Prices carry the same sample marker as
 * products: until the store confirms one, the showcase page labels it.
 */

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
import { ACCENTS, KIND_OPTIONS, SHOWCASE_TIERS } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import {
  Checkbox,
  Field,
  FormGrid,
  Input,
  Money,
  Panel,
  Pill,
  Select,
  Textarea,
} from "@/components/admin/ui";
import { Button } from "@/components/ui";
import { cn, slugify } from "@/lib/utils";

export type ShowcaseComponentRow = { kind: string; name: string };

export type ShowcaseRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: string | null;
  target: string | null;
  price: number | null;
  samplePrice: boolean;
  imageUrl: string | null;
  accent: string | null;
  featured: boolean;
  sortOrder: number;
  componentRows: ShowcaseComponentRow[];
};

type FormState = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  tier: string;
  target: string;
  price: string;
  samplePrice: boolean;
  imageUrl: string;
  accent: string;
  featured: boolean;
  sortOrder: string;
  components: ShowcaseComponentRow[];
};

function emptyForm(): FormState {
  return {
    slug: "",
    name: "",
    tagline: "",
    description: "",
    tier: "",
    target: "",
    price: "",
    samplePrice: false,
    imageUrl: "",
    accent: "",
    featured: false,
    sortOrder: "0",
    components: [],
  };
}

function formFrom(build: ShowcaseRow): FormState {
  return {
    slug: build.slug,
    name: build.name,
    tagline: build.tagline ?? "",
    description: build.description ?? "",
    tier: build.tier ?? "",
    target: build.target ?? "",
    price: build.price === null ? "" : String(build.price),
    samplePrice: build.samplePrice,
    imageUrl: build.imageUrl ?? "",
    accent: build.accent ?? "",
    featured: build.featured,
    sortOrder: String(build.sortOrder),
    components: build.componentRows.map((row) => ({ ...row })),
  };
}

function toPayload(form: FormState) {
  return {
    slug: form.slug,
    name: form.name,
    tagline: form.tagline || null,
    description: form.description || null,
    tier: form.tier || null,
    target: form.target || null,
    price: form.price ? Number.parseInt(form.price, 10) : null,
    samplePrice: form.samplePrice,
    imageUrl: form.imageUrl || null,
    accent: form.accent || null,
    featured: form.featured,
    sortOrder: Number.parseInt(form.sortOrder || "0", 10) || 0,
    components: form.components
      .filter((row) => row.name.trim().length > 0)
      .map((row) => ({ kind: row.kind, name: row.name.trim() })),
  };
}

/* ========================================================================== */
/* Field set                                                                  */
/* ========================================================================== */

function ShowcaseFields({
  form,
  setForm,
  errors,
  autoSlug,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  autoSlug: boolean;
}) {
  function moveComponent(index: number, delta: number) {
    setForm((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.components.length) return current;
      const components = [...current.components];
      [components[index], components[target]] = [components[target], components[index]];
      return { ...current, components };
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <FormGrid columns={3}>
        <Field label="Machine name" error={errors.name} required>
          <Input
            value={form.name}
            invalid={Boolean(errors.name)}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                slug: autoSlug ? slugify(event.target.value) : current.slug,
              }))
            }
            placeholder="The Hafeez Centre Special"
          />
        </Field>

        <Field label="Slug" error={errors.slug} required hint="/showcase/<slug>">
          <Input
            value={form.slug}
            invalid={Boolean(errors.slug)}
            onChange={(event) =>
              setForm((current) => ({ ...current, slug: event.target.value }))
            }
            className="font-mono text-xs"
          />
        </Field>

        <Field label="Tier" error={errors.tier}>
          <Select
            value={form.tier}
            onChange={(event) =>
              setForm((current) => ({ ...current, tier: event.target.value }))
            }
          >
            <option value="">No tier</option>
            {SHOWCASE_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Target"
          error={errors.target}
          hint="What this machine was built to do, e.g. 1440p 144FPS."
        >
          <Input
            value={form.target}
            onChange={(event) =>
              setForm((current) => ({ ...current, target: event.target.value }))
            }
            placeholder="1440p 144FPS"
          />
        </Field>

        <Field label="Price (PKR)" error={errors.price} hint="Leave blank to show no price.">
          <Input
            value={form.price}
            inputMode="numeric"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                price: event.target.value.replace(/[^\d]/g, ""),
              }))
            }
            className="tnum font-mono"
          />
        </Field>

        <Field label="Sort order" error={errors.sortOrder} hint="Lower comes first.">
          <Input
            value={form.sortOrder}
            inputMode="numeric"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sortOrder: event.target.value.replace(/[^\d]/g, ""),
              }))
            }
            className="tnum font-mono"
          />
        </Field>

        <Field
          label="Image path"
          error={errors.imageUrl}
          hint="Under public/, e.g. /images/placeholder/prebuilt.svg. No remote images."
          className="sm:col-span-2"
        >
          <Input
            value={form.imageUrl}
            invalid={Boolean(errors.imageUrl)}
            onChange={(event) =>
              setForm((current) => ({ ...current, imageUrl: event.target.value }))
            }
            className="font-mono text-xs"
          />
        </Field>

        <Field label="Accent colour" error={errors.accent}>
          <Select
            value={form.accent}
            onChange={(event) =>
              setForm((current) => ({ ...current, accent: event.target.value }))
            }
          >
            <option value="">Default</option>
            {ACCENTS.map((accent) => (
              <option key={accent} value={accent}>
                {accent}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tagline" error={errors.tagline} className="sm:col-span-2 lg:col-span-3">
          <Input
            value={form.tagline}
            onChange={(event) =>
              setForm((current) => ({ ...current, tagline: event.target.value }))
            }
            placeholder="One line about what makes this machine worth looking at."
          />
        </Field>

        <Field
          label="Description"
          error={errors.description}
          className="sm:col-span-2 lg:col-span-3"
        >
          <Textarea
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </Field>
      </FormGrid>

      <div className="flex flex-wrap gap-4">
        <Checkbox
          checked={form.featured}
          onChange={(event) =>
            setForm((current) => ({ ...current, featured: event.target.checked }))
          }
          label="Featured on the home page"
        />
        <Checkbox
          checked={form.samplePrice}
          onChange={(event) =>
            setForm((current) => ({ ...current, samplePrice: event.target.checked }))
          }
          label="Price is still sample data"
          hint="Shows the sample marker beside the figure on the showcase page."
        />
      </div>

      {/* ---- Component snapshot ------------------------------------------ */}
      <div className="border-t border-[var(--color-line)] pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-cyan">
              Components
            </p>
            <p className="mt-0.5 text-xs text-ash">
              What actually went into this machine. Free text — a showcase build is a
              record, not a configurator.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                components: [...current.components, { kind: "", name: "" }],
              }))
            }
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--color-line-strong)] px-2.5 text-xs text-silver transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            <Plus className="h-3 w-3" /> Add part
          </button>
        </div>

        {form.components.length === 0 ? (
          <p className="text-xs text-ash">No parts listed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {form.components.map((component, index) => (
              <li key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                <Select
                  value={component.kind}
                  aria-label={`Part type ${index + 1}`}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      components: current.components.map((row, i) =>
                        i === index ? { ...row, kind: event.target.value } : row,
                      ),
                    }))
                  }
                >
                  <option value="">Type…</option>
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Input
                  value={component.name}
                  aria-label={`Part name ${index + 1}`}
                  placeholder="AMD Ryzen 7 9800X3D"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      components: current.components.map((row, i) =>
                        i === index ? { ...row, name: event.target.value } : row,
                      ),
                    }))
                  }
                />

                <div className="flex items-center gap-1">
                  <IconButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => moveComponent(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === form.components.length - 1}
                    onClick={() => moveComponent(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Remove part"
                    danger
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        components: current.components.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] text-silver transition-colors",
        danger ? "hover:border-rose/50 hover:text-rose" : "hover:border-cyan/50 hover:text-cyan",
        "disabled:cursor-not-allowed disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}

/* ========================================================================== */
/* Manager                                                                    */
/* ========================================================================== */

export function ShowcaseManager({ builds }: { builds: ShowcaseRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPost<{ ok: true; id: string }>(
      "/api/admin/showcase",
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }

    toast.success("Showcase build created.");
    setForm(emptyForm());
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <Panel title="New showcase build">
          <form onSubmit={create} className="flex flex-col gap-4" noValidate>
            <ShowcaseFields form={form} setForm={setForm} errors={errors} autoSlug />
            <div className="flex items-center gap-2">
              <Button type="submit" loading={saving}>
                Create
              </Button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setErrors({});
                }}
                className="text-sm text-silver hover:text-chrome"
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      ) : (
        <div>
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New showcase build
          </Button>
        </div>
      )}

      {builds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-4 py-10 text-center text-sm text-ash">
          No showcase builds yet. These are machines Yalman Gaming has actually
          built — add one once you have photographed a finished PC.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {builds.map((build) => (
            <ShowcaseCard
              key={build.id}
              build={build}
              open={openId === build.id}
              onToggle={() =>
                setOpenId((current) => (current === build.id ? null : build.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShowcaseCard({
  build,
  open,
  onToggle,
}: {
  build: ShowcaseRow;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>(() => formFrom(build));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setForm(formFrom(build)), [build]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPatch<{ ok: true }>(
      `/api/admin/showcase/${build.id}`,
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }
    toast.success("Showcase build saved.");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/showcase/${build.id}`);
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Showcase build deleted.");
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

        <span className="grid h-10 w-12 shrink-0 place-items-center rounded border border-[var(--color-line)] bg-carbon p-1">
          {build.imageUrl?.startsWith("/") ? (
            <Image
              src={build.imageUrl}
              alt=""
              width={40}
              height={30}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="font-mono text-[0.5rem] uppercase text-ash">none</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-chrome">{build.name}</span>
            {build.tier && <Pill tone="cyan">{build.tier}</Pill>}
            {build.featured && <Pill tone="violet">Featured</Pill>}
          </span>
          <span className="mt-0.5 block text-xs text-ash">
            {build.target ?? "No target stated"} · {build.componentRows.length} parts
            listed · sort {build.sortOrder}
          </span>
        </span>

        <span className="shrink-0">
          {build.price === null ? (
            <span className="text-xs text-ash">No price</span>
          ) : (
            <Money amount={build.price} sample={build.samplePrice} />
          )}
        </span>
      </button>

      {open && (
        <form
          onSubmit={save}
          className="flex flex-col gap-4 border-t border-[var(--color-line)] p-4"
          noValidate
        >
          <ShowcaseFields
            form={form}
            setForm={setForm}
            errors={errors}
            autoSlug={false}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" loading={saving}>
              Save
            </Button>
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
