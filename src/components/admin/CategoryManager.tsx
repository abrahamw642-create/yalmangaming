"use client";

/**
 * Yalman Gaming admin — the browse tree.
 *
 * Categories drive `/shop/[category]`, the mega menu and the breadcrumb trail.
 * `kind` is the important field: `@/lib/catalog` matches products both by
 * `categoryId` *and* by the component kind a category declares, so a category
 * with the right kind still lists products that were never assigned to it.
 *
 * Depth is capped at two levels by the storefront navigation, so a child
 * cannot be given a child of its own here.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
import { ACCENTS, KIND_OPTIONS } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import {
  Checkbox,
  Field,
  FormGrid,
  Input,
  Note,
  Panel,
  Pill,
  Select,
  Textarea,
} from "@/components/admin/ui";
import { Button, Spinner } from "@/components/ui";
import type { AdminCategory } from "@/lib/admin-queries";
import { cn, slugify } from "@/lib/utils";

type FormState = {
  name: string;
  slug: string;
  description: string;
  kind: string;
  icon: string;
  accent: string;
  sortOrder: string;
  featured: boolean;
  parentId: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    description: "",
    kind: "",
    icon: "",
    accent: "",
    sortOrder: "0",
    featured: false,
    parentId: "",
  };
}

function formFrom(category: AdminCategory): FormState {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    kind: category.kind ?? "",
    icon: category.icon ?? "",
    accent: category.accent ?? "",
    sortOrder: String(category.sortOrder),
    featured: category.featured,
    parentId: category.parentId ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    kind: form.kind || null,
    icon: form.icon || null,
    accent: form.accent || null,
    sortOrder: Number.parseInt(form.sortOrder || "0", 10) || 0,
    featured: form.featured,
    parentId: form.parentId || null,
  };
}

/* ========================================================================== */
/* Shared field set                                                           */
/* ========================================================================== */

function CategoryFields({
  form,
  setForm,
  errors,
  parents,
  autoSlug,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  parents: { id: string; name: string }[];
  autoSlug: boolean;
}) {
  return (
    <FormGrid columns={3}>
      <Field label="Name" error={errors.name} required>
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
          placeholder="Graphics Cards"
        />
      </Field>

      <Field label="Slug" error={errors.slug} required hint="/shop/<slug>">
        <Input
          value={form.slug}
          invalid={Boolean(errors.slug)}
          onChange={(event) =>
            setForm((current) => ({ ...current, slug: event.target.value }))
          }
          className="font-mono text-xs"
          placeholder="graphics-cards"
        />
      </Field>

      <Field
        label="Component kind"
        error={errors.kind}
        hint="Products of this kind list here even without being assigned to it."
      >
        <Select
          value={form.kind}
          onChange={(event) =>
            setForm((current) => ({ ...current, kind: event.target.value }))
          }
        >
          <option value="">No kind (grouping only)</option>
          {KIND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Parent" error={errors.parentId} hint="Leave empty for a top-level section.">
        <Select
          value={form.parentId}
          onChange={(event) =>
            setForm((current) => ({ ...current, parentId: event.target.value }))
          }
        >
          <option value="">Top level</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </Select>
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

      <Field
        label="Icon"
        error={errors.icon}
        hint="A lucide-react icon name, e.g. cpu or monitor."
      >
        <Input
          value={form.icon}
          onChange={(event) =>
            setForm((current) => ({ ...current, icon: event.target.value }))
          }
          className="font-mono text-xs"
          placeholder="gpu"
        />
      </Field>

      <Field label="Description" error={errors.description} className="sm:col-span-2">
        <Textarea
          rows={2}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </Field>

      <div className="sm:col-span-2 lg:col-span-3">
        <Checkbox
          checked={form.featured}
          onChange={(event) =>
            setForm((current) => ({ ...current, featured: event.target.checked }))
          }
          label="Featured"
          hint="Featured categories are the ones the storefront promotes on the home page."
        />
      </div>
    </FormGrid>
  );
}

/* ========================================================================== */
/* Manager                                                                    */
/* ========================================================================== */

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const toast = useToast();

  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<FormState>(emptyForm);
  const [createErrors, setCreateErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Only top-level rows can be a parent — the storefront navigation is two
  // levels deep and a third would have nowhere to render.
  const parents = categories
    .filter((category) => !category.parentId)
    .map((category) => ({ id: category.id, name: category.name }));

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setCreateErrors({});

    const result = await adminPost<{ ok: true; id: string }>(
      "/api/admin/categories",
      toPayload(createForm),
    );
    setSaving(false);

    if (!result.ok) {
      setCreateErrors(result.fields);
      toast.error(result.error);
      return;
    }

    toast.success("Category created.");
    setCreateForm(emptyForm());
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <Panel title="New category">
          <form onSubmit={create} className="flex flex-col gap-4" noValidate>
            <CategoryFields
              form={createForm}
              setForm={setCreateForm}
              errors={createErrors}
              parents={parents}
              autoSlug
            />
            <div className="flex items-center gap-2">
              <Button type="submit" loading={saving}>
                Create category
              </Button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setCreateErrors({});
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
            New category
          </Button>
        </div>
      )}

      {categories.length === 0 ? (
        <Note tone="warn">
          No categories exist. The storefront falls back to a synthetic tree built
          from component kinds, so navigation still works — but nothing is grouped
          the way Yalman Gaming would group it.
        </Note>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              parents={parents.filter((parent) => parent.id !== category.id)}
              open={openId === category.id}
              onToggle={() =>
                setOpenId((current) => (current === category.id ? null : category.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Row                                                                        */
/* ========================================================================== */

function CategoryRow({
  category,
  parents,
  open,
  onToggle,
}: {
  category: AdminCategory;
  parents: { id: string; name: string }[];
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>(() => formFrom(category));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setForm(formFrom(category)), [category]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPatch<{ ok: true }>(
      `/api/admin/categories/${category.id}`,
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }
    toast.success("Category saved.");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(
      `/api/admin/categories/${category.id}`,
    );
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Category deleted.");
    router.refresh();
  }

  return (
    <li
      className={cn(
        "metal rounded-xl",
        category.depth > 0 && "ml-0 border-l-2 border-l-cyan/20 sm:ml-6",
      )}
    >
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
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-chrome">{category.name}</span>
            <span className="font-mono text-[0.6875rem] text-ash">/{category.slug}</span>
            {category.kind && <Pill tone="cyan">{category.kind}</Pill>}
            {category.featured && <Pill tone="violet">Featured</Pill>}
          </span>
          <span className="mt-0.5 block text-xs text-ash">
            {category.parentName ? `Under ${category.parentName} · ` : "Top level · "}
            {category._count.products} direct{" "}
            {category._count.products === 1 ? "product" : "products"}
            {category._count.children > 0
              ? ` · ${category._count.children} subcategories`
              : ""}
            {` · sort ${category.sortOrder}`}
          </span>
        </span>
      </button>

      {open && (
        <form
          onSubmit={save}
          className="flex flex-col gap-4 border-t border-[var(--color-line)] p-4"
          noValidate
        >
          <CategoryFields
            form={form}
            setForm={setForm}
            errors={errors}
            parents={parents}
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
                  {deleting && <Spinner className="h-3 w-3" />}
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

            <span className="text-xs text-ash">
              Deleting keeps the products — they lose their category and fall back to
              matching by component kind.
            </span>
          </div>
        </form>
      )}
    </li>
  );
}
