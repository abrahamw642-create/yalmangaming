"use client";

/**
 * Yalman Gaming admin — the product editor.
 *
 * The interesting part is the compatibility section. `KIND_SPEC_GROUPS` in
 * `@/components/admin/schema` declares which columns belong to which kind, and
 * this form renders *only* those — a CPU never shows a radiator size, a
 * mousepad never shows a socket. Changing the kind swaps the field set and the
 * API nulls every column the new kind does not use, so a product cannot carry
 * a spec that stopped meaning anything.
 *
 * Images are paths under `public/`. `next.config.ts` declares no remote image
 * patterns, so an absolute URL would make `next/image` throw on the storefront;
 * the schema rejects one here instead of letting it reach a customer.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
import {
  KIND_OPTIONS,
  KIND_SPEC_GROUPS,
  PRODUCT_STATUSES,
  type SpecField,
} from "@/components/admin/schema";
import {
  emptySpecFormValues,
  productFormToPayload,
  WARRANTY_OPTIONS,
  type ProductFormImage,
  type ProductFormSpecRow,
  type ProductFormState,
} from "@/components/admin/payloads";
import { useToast } from "@/components/admin/Toast";
import {
  Checkbox,
  Field,
  FormGrid,
  Input,
  Note,
  Panel,
  Select,
  Textarea,
} from "@/components/admin/ui";
import { Button } from "@/components/ui";
import { KIND_META } from "@/lib/types";
import { cn, formatPKR, slugify } from "@/lib/utils";

type Option = { id: string; label: string };

type Errors = Record<string, string>;

export function ProductForm({
  mode,
  productId,
  initial,
  brands,
  categories,
  usage,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial: ProductFormState;
  brands: Option[];
  categories: Option[];
  /** Where the product already appears, so deletion can be explained. */
  usage?: { orderItems: number; buildComponents: number; reviews: number };
}) {
  const router = useRouter();
  const toast = useToast();

  const [state, setState] = React.useState<ProductFormState>(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Once the slug is typed by hand, the name stops driving it.
  const [slugLocked, setSlugLocked] = React.useState(mode === "edit");

  const set = React.useCallback(
    <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  function changeName(name: string) {
    setState((current) => ({
      ...current,
      name,
      slug: slugLocked ? current.slug : slugify(name),
    }));
  }

  function changeKind(kind: ProductFormState["kind"]) {
    setState((current) => {
      // Carry over any column the new kind also uses — a GPU becoming a
      // prebuilt should not lose its recommended PSU wattage.
      const next = emptySpecFormValues(kind);
      for (const key of Object.keys(next)) {
        if (key in current.specs) next[key] = current.specs[key];
      }
      return { ...current, kind, specs: next };
    });
  }

  function setSpec(name: string, value: string) {
    setState((current) => ({ ...current, specs: { ...current.specs, [name]: value } }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);

    const payload = productFormToPayload(state);

    const result =
      mode === "create"
        ? await adminPost<{ ok: true; id: string }>("/api/admin/products", {
            product: payload,
          })
        : await adminPatch<{ ok: true; id: string }>(`/api/admin/products/${productId}`, {
            mode: "full",
            product: payload,
          });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Product created." : "Product saved.");
    if (mode === "create") {
      router.push(`/admin/products/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function remove() {
    if (!productId) return;
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/products/${productId}`);
    setDeleting(false);
    setConfirmDelete(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Product deleted.");
    router.push("/admin/products");
    router.refresh();
  }

  const price = Number.parseInt(state.price || "0", 10) || 0;
  const salePrice = state.salePrice ? Number.parseInt(state.salePrice, 10) : null;
  const groups = KIND_SPEC_GROUPS[state.kind];

  return (
    <form onSubmit={save} className="flex flex-col gap-5" noValidate>
      {formError && <Note tone="warn">{formError}</Note>}

      {/* ---- Identity ---------------------------------------------------- */}
      <Panel
        title="Identity"
        description="How the product is named, addressed and grouped on the storefront."
      >
        <FormGrid>
          <Field
            label="Product name"
            htmlFor="p-name"
            error={errors.name}
            required
            className="sm:col-span-2"
          >
            <Input
              id="p-name"
              value={state.name}
              invalid={Boolean(errors.name)}
              onChange={(event) => changeName(event.target.value)}
              placeholder="NVIDIA GeForce RTX 5070 Ti 16GB"
            />
          </Field>

          <Field
            label="URL slug"
            htmlFor="p-slug"
            error={errors.slug}
            required
            hint="Lives at /product/<slug>. Changing it breaks existing links."
          >
            <Input
              id="p-slug"
              value={state.slug}
              invalid={Boolean(errors.slug)}
              onChange={(event) => {
                setSlugLocked(true);
                set("slug", event.target.value);
              }}
              placeholder="nvidia-geforce-rtx-5070-ti-16gb"
              className="font-mono"
            />
          </Field>

          <Field label="SKU" htmlFor="p-sku" error={errors.sku} required>
            <Input
              id="p-sku"
              value={state.sku}
              invalid={Boolean(errors.sku)}
              onChange={(event) => set("sku", event.target.value)}
              placeholder="YG-GPU-5070TI"
              className="font-mono"
            />
          </Field>

          <Field
            label="Product type"
            htmlFor="p-kind"
            error={errors.kind}
            required
            hint="Drives the PC builder step it appears in and which specs matter below."
          >
            <Select
              id="p-kind"
              value={state.kind}
              onChange={(event) =>
                changeKind(event.target.value as ProductFormState["kind"])
              }
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="p-status" error={errors.status}>
            <Select
              id="p-status"
              value={state.status}
              onChange={(event) => set("status", event.target.value)}
            >
              {PRODUCT_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label} — {status.hint}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Brand" htmlFor="p-brand" error={errors.brandId}>
            <Select
              id="p-brand"
              value={state.brandId}
              onChange={(event) => set("brandId", event.target.value)}
            >
              <option value="">No brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="p-category" error={errors.categoryId}>
            <Select
              id="p-category"
              value={state.categoryId}
              onChange={(event) => set("categoryId", event.target.value)}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Headline"
            htmlFor="p-headline"
            error={errors.headline}
            hint="One line under the name on product cards."
            className="sm:col-span-2"
          >
            <Input
              id="p-headline"
              value={state.headline}
              onChange={(event) => set("headline", event.target.value)}
              placeholder="16GB GDDR7 for high-refresh 1440p"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="p-description"
            error={errors.description}
            hint="Shown on the product page. Only state what Yalman Gaming can stand behind."
            className="sm:col-span-2"
          >
            <Textarea
              id="p-description"
              rows={5}
              value={state.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
        </FormGrid>
      </Panel>

      {/* ---- Commerce ---------------------------------------------------- */}
      <Panel
        title="Price and stock"
        description="Whole rupees only. No decimals exist anywhere in this system."
      >
        <FormGrid columns={3}>
          <Field label="Price (PKR)" htmlFor="p-price" error={errors.price} required>
            <Input
              id="p-price"
              inputMode="numeric"
              value={state.price}
              invalid={Boolean(errors.price)}
              onChange={(event) =>
                set("price", event.target.value.replace(/[^\d]/g, ""))
              }
              className="tnum font-mono"
            />
          </Field>

          <Field
            label="Sale price (PKR)"
            htmlFor="p-sale"
            error={errors.salePrice}
            hint={
              salePrice && salePrice < price
                ? `Customers pay ${formatPKR(salePrice)} — ${Math.round(((price - salePrice) / price) * 100)}% off.`
                : "Leave blank when the product is not discounted."
            }
          >
            <Input
              id="p-sale"
              inputMode="numeric"
              value={state.salePrice}
              invalid={Boolean(errors.salePrice)}
              onChange={(event) =>
                set("salePrice", event.target.value.replace(/[^\d]/g, ""))
              }
              className="tnum font-mono"
            />
          </Field>

          <Field
            label="Cost price (PKR)"
            htmlFor="p-cost"
            error={errors.costPrice}
            hint="Internal only. Never shown to a customer."
          >
            <Input
              id="p-cost"
              inputMode="numeric"
              value={state.costPrice}
              onChange={(event) =>
                set("costPrice", event.target.value.replace(/[^\d]/g, ""))
              }
              className="tnum font-mono"
            />
          </Field>

          <Field label="Stock on hand" htmlFor="p-stock" error={errors.stock}>
            <Input
              id="p-stock"
              inputMode="numeric"
              value={state.stock}
              onChange={(event) =>
                set("stock", event.target.value.replace(/[^\d]/g, ""))
              }
              className="tnum font-mono"
            />
          </Field>

          <Field
            label="Low-stock threshold"
            htmlFor="p-low"
            error={errors.lowStockAt}
            hint="At or below this, the storefront shows a low-stock badge."
          >
            <Input
              id="p-low"
              inputMode="numeric"
              value={state.lowStockAt}
              onChange={(event) =>
                set("lowStockAt", event.target.value.replace(/[^\d]/g, ""))
              }
              className="tnum font-mono"
            />
          </Field>

          <Field label="Supplier" htmlFor="p-supplier" error={errors.supplier}>
            <Input
              id="p-supplier"
              value={state.supplier}
              onChange={(event) => set("supplier", event.target.value)}
            />
          </Field>

          <Field
            label="Warranty"
            htmlFor="p-warranty"
            error={errors.warranty}
            hint="Yalman Gaming has published no durations or terms, so this is the only wording the site can state."
            className="sm:col-span-2"
          >
            <Select
              id="p-warranty"
              value={state.warranty}
              onChange={(event) => set("warranty", event.target.value)}
            >
              <option value="">No warranty stated</option>
              {WARRANTY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
          <Checkbox
            checked={state.samplePrice}
            onChange={(event) => set("samplePrice", event.target.checked)}
            label="This price is still seeded sample data"
            hint="While this is ticked the storefront prints a “sample” marker beside the figure. Untick it once the price is the one Yalman Gaming actually charges."
          />
          <div className="flex flex-wrap gap-4">
            <Checkbox
              checked={state.featured}
              onChange={(event) => set("featured", event.target.checked)}
              label="Featured"
            />
            <Checkbox
              checked={state.isNew}
              onChange={(event) => set("isNew", event.target.checked)}
              label="New arrival"
            />
            <Checkbox
              checked={state.onDeal}
              onChange={(event) => set("onDeal", event.target.checked)}
              label="Show on the deals page"
            />
          </div>
        </div>
      </Panel>

      {/* ---- Compatibility specs ----------------------------------------- */}
      <Panel
        title={`${KIND_META[state.kind].label} specifications`}
        description="Only the fields that mean something for this product type. Everything else is cleared when you save."
      >
        {groups.every((group) => group.fields.length === 0) ? (
          <Note>
            {groups[0]?.help ??
              "This product type carries no compatibility attributes."}
          </Note>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <fieldset key={group.group}>
                <legend className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-cyan">
                  {group.group}
                </legend>
                {group.help && (
                  <p className="mb-3 mt-1 text-xs leading-relaxed text-ash">
                    {group.help}
                  </p>
                )}
                <FormGrid columns={3} className={group.help ? undefined : "mt-3"}>
                  {group.fields.map((field) => (
                    <SpecInput
                      key={field.name}
                      field={field}
                      value={state.specs[field.name] ?? ""}
                      error={errors[`specs.${field.name}`]}
                      onChange={(value) => setSpec(field.name, value)}
                    />
                  ))}
                </FormGrid>
              </fieldset>
            ))}
          </div>
        )}
      </Panel>

      {/* ---- Images ------------------------------------------------------ */}
      <Panel
        title="Images"
        description="Paths under public/, e.g. /images/placeholder/gpu.svg. The first image is the card thumbnail."
        action={
          <RowButton
            onClick={() =>
              set("images", [
                ...state.images,
                { url: "", alt: "", placeholder: false } satisfies ProductFormImage,
              ])
            }
          >
            <Plus className="h-3 w-3" /> Add image
          </RowButton>
        }
      >
        {state.images.length === 0 ? (
          <Note>
            No images. The storefront falls back to a neutral placeholder, which is
            honest but not persuasive — add the line art or a real photo.
          </Note>
        ) : (
          <ul className="flex flex-col gap-3">
            {state.images.map((image, index) => (
              <li
                key={index}
                className="grid gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-[3rem_1fr_1fr_auto] sm:items-start"
              >
                <div className="grid h-12 w-12 place-items-center rounded border border-[var(--color-line)] bg-carbon p-1">
                  {image.url.startsWith("/") ? (
                    <Image
                      src={image.url}
                      alt=""
                      width={44}
                      height={34}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="font-mono text-[0.5rem] uppercase text-ash">?</span>
                  )}
                </div>

                <Field
                  label={`Image ${index + 1} path`}
                  error={errors[`images.${index}.url`]}
                >
                  <Input
                    value={image.url}
                    invalid={Boolean(errors[`images.${index}.url`])}
                    onChange={(event) =>
                      set(
                        "images",
                        state.images.map((row, i) =>
                          i === index ? { ...row, url: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder="/images/placeholder/gpu.svg"
                    className="font-mono text-xs"
                  />
                </Field>

                <Field label="Alt text" error={errors[`images.${index}.alt`]}>
                  <Input
                    value={image.alt}
                    onChange={(event) =>
                      set(
                        "images",
                        state.images.map((row, i) =>
                          i === index ? { ...row, alt: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Describe the part for screen readers"
                  />
                </Field>

                <div className="flex items-center gap-1 sm:pt-6">
                  <RowIcon
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => set("images", moveRow(state.images, index, -1))}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </RowIcon>
                  <RowIcon
                    label="Move down"
                    disabled={index === state.images.length - 1}
                    onClick={() => set("images", moveRow(state.images, index, 1))}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </RowIcon>
                  <RowIcon
                    label="Remove image"
                    danger
                    onClick={() =>
                      set(
                        "images",
                        state.images.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </RowIcon>
                </div>

                <div className="sm:col-span-4">
                  <Checkbox
                    checked={image.placeholder}
                    onChange={(event) =>
                      set(
                        "images",
                        state.images.map((row, i) =>
                          i === index
                            ? { ...row, placeholder: event.target.checked }
                            : row,
                        ),
                      )
                    }
                    label="Generated line art, not a photograph of the actual item"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ---- Spec sheet -------------------------------------------------- */}
      <Panel
        title="Spec sheet"
        description="The table on the product page. Rows are grouped by the group name you give them."
        action={
          <RowButton
            onClick={() =>
              set("specSheet", [
                ...state.specSheet,
                {
                  group: state.specSheet.at(-1)?.group || "Specifications",
                  label: "",
                  value: "",
                } satisfies ProductFormSpecRow,
              ])
            }
          >
            <Plus className="h-3 w-3" /> Add row
          </RowButton>
        }
      >
        {state.specSheet.length === 0 ? (
          <Note>
            No spec rows. The product page shows the compatibility attributes above
            instead, which is usually thinner than a buyer wants.
          </Note>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.specSheet.map((row, index) => (
              <li
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-center"
              >
                <Input
                  value={row.group}
                  aria-label={`Group for spec row ${index + 1}`}
                  placeholder="Group"
                  onChange={(event) =>
                    set(
                      "specSheet",
                      state.specSheet.map((r, i) =>
                        i === index ? { ...r, group: event.target.value } : r,
                      ),
                    )
                  }
                />
                <Input
                  value={row.label}
                  aria-label={`Label for spec row ${index + 1}`}
                  placeholder="Label"
                  invalid={Boolean(errors[`specSheet.${index}.label`])}
                  onChange={(event) =>
                    set(
                      "specSheet",
                      state.specSheet.map((r, i) =>
                        i === index ? { ...r, label: event.target.value } : r,
                      ),
                    )
                  }
                />
                <Input
                  value={row.value}
                  aria-label={`Value for spec row ${index + 1}`}
                  placeholder="Value"
                  invalid={Boolean(errors[`specSheet.${index}.value`])}
                  onChange={(event) =>
                    set(
                      "specSheet",
                      state.specSheet.map((r, i) =>
                        i === index ? { ...r, value: event.target.value } : r,
                      ),
                    )
                  }
                />
                <div className="flex items-center gap-1">
                  <RowIcon
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => set("specSheet", moveRow(state.specSheet, index, -1))}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </RowIcon>
                  <RowIcon
                    label="Move down"
                    disabled={index === state.specSheet.length - 1}
                    onClick={() => set("specSheet", moveRow(state.specSheet, index, 1))}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </RowIcon>
                  <RowIcon
                    label="Remove row"
                    danger
                    onClick={() =>
                      set(
                        "specSheet",
                        state.specSheet.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </RowIcon>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ---- Actions ------------------------------------------------------ */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line-strong)] bg-carbon/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button type="submit" loading={saving}>
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
          <Link
            href="/admin/products"
            className="rounded-lg px-3 py-2 text-sm text-silver transition-colors hover:text-chrome"
          >
            Cancel
          </Link>
          {mode === "edit" && state.status === "active" && (
            <Link
              href={`/product/${state.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2 text-sm text-cyan transition-colors hover:text-white"
            >
              View on the storefront ↗
            </Link>
          )}
        </div>

        {mode === "edit" && (
          <div className="flex items-center gap-2">
            {usage && (usage.orderItems > 0 || usage.buildComponents > 0) && (
              <span className="text-[0.6875rem] text-ash">
                On {usage.orderItems} order {usage.orderItems === 1 ? "line" : "lines"} ·{" "}
                {usage.buildComponents} saved{" "}
                {usage.buildComponents === 1 ? "build" : "builds"}
              </span>
            )}
            {confirmDelete ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  onClick={remove}
                >
                  Delete permanently
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-silver hover:text-chrome"
                >
                  Keep it
                </button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Spec input                                                                 */
/* -------------------------------------------------------------------------- */

function SpecInput({
  field,
  value,
  error,
  onChange,
}: {
  field: SpecField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `spec-${field.name}`;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center sm:col-span-2">
        <Checkbox
          id={id}
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
          label={field.label}
          hint={field.help}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={field.label} htmlFor={id} hint={field.help} error={error}>
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Not set</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.type === "map") {
    return (
      <Field
        label={field.label}
        htmlFor={id}
        hint={field.help}
        error={error}
        className="sm:col-span-2"
      >
        <Textarea
          id={id}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"pcie8 = 4\n12vhpwr = 1"}
          className="font-mono text-xs"
        />
      </Field>
    );
  }

  const numeric = field.type === "int" || field.type === "float";

  return (
    <Field
      label={
        field.suffix ? (
          <>
            {field.label}{" "}
            <span className="font-mono text-[0.625rem] text-ash">({field.suffix})</span>
          </>
        ) : (
          field.label
        )
      }
      htmlFor={id}
      hint={field.help}
      error={error}
      className={field.type === "list" ? "sm:col-span-2" : undefined}
    >
      <Input
        id={id}
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn((numeric || field.type === "list") && "font-mono")}
      />
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                */
/* -------------------------------------------------------------------------- */

function moveRow<T>(rows: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function RowButton({
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
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--color-line-strong)] px-2.5 text-xs text-silver transition-colors hover:border-cyan/50 hover:text-cyan"
    >
      {children}
    </button>
  );
}

function RowIcon({
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
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--color-line-strong)] text-silver transition-colors",
        danger ? "hover:border-rose/50 hover:text-rose" : "hover:border-cyan/50 hover:text-cyan",
        "disabled:cursor-not-allowed disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}
