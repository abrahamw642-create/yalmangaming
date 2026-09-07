"use client";

/**
 * Yalman Gaming admin — discount codes.
 *
 * A coupon is only ever *applied* server-side: `validateCoupon` in
 * `@/lib/orders` re-reads the row, re-checks the window, the usage cap and the
 * minimum spend, and recomputes the discount before an order is written. So
 * nothing here needs to be defensive about what the browser believes — this is
 * purely the place the rules get written down.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
import { COUPON_TYPES } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import {
  Checkbox,
  Field,
  FormGrid,
  Input,
  Panel,
  Pill,
  Select,
  Textarea,
} from "@/components/admin/ui";
import { Button } from "@/components/ui";
import { cn, formatPKR } from "@/lib/utils";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minSpend: number | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  /** `YYYY-MM-DD`, ready for `<input type="date">`. */
  startsAt: string | null;
  expiresAt: string | null;
  /** Computed server-side against the same clock the checkout uses. */
  state: "live" | "scheduled" | "expired" | "used-up" | "off";
};

type FormState = {
  code: string;
  description: string;
  discountType: string;
  discountValue: string;
  minSpend: string;
  maxUses: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
};

function emptyForm(): FormState {
  return {
    code: "",
    description: "",
    discountType: "percent",
    discountValue: "",
    minSpend: "",
    maxUses: "",
    active: true,
    startsAt: "",
    expiresAt: "",
  };
}

function formFrom(coupon: CouponRow): FormState {
  return {
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    minSpend: coupon.minSpend === null ? "" : String(coupon.minSpend),
    maxUses: coupon.maxUses === null ? "" : String(coupon.maxUses),
    active: coupon.active,
    startsAt: coupon.startsAt ?? "",
    expiresAt: coupon.expiresAt ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    code: form.code,
    description: form.description || null,
    discountType: form.discountType,
    discountValue: Number.parseInt(form.discountValue || "0", 10) || 0,
    minSpend: form.minSpend ? Number.parseInt(form.minSpend, 10) : null,
    maxUses: form.maxUses ? Number.parseInt(form.maxUses, 10) : null,
    active: form.active,
    startsAt: form.startsAt || null,
    expiresAt: form.expiresAt || null,
  };
}

const STATE_LABELS: Record<CouponRow["state"], { label: string; tone: "emerald" | "cyan" | "rose" | "neutral" | "ember" }> = {
  live: { label: "Live", tone: "emerald" },
  scheduled: { label: "Scheduled", tone: "cyan" },
  expired: { label: "Expired", tone: "rose" },
  "used-up": { label: "Fully redeemed", tone: "ember" },
  off: { label: "Switched off", tone: "neutral" },
};

/* ========================================================================== */
/* Field set                                                                  */
/* ========================================================================== */

function CouponFields({
  form,
  setForm,
  errors,
  lockCode,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  lockCode?: boolean;
}) {
  const percent = form.discountType === "percent";

  return (
    <FormGrid columns={3}>
      <Field
        label="Code"
        error={errors.code}
        required
        hint={lockCode ? "Changing this invalidates anything already handed out." : undefined}
      >
        <Input
          value={form.code}
          invalid={Boolean(errors.code)}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              code: event.target.value.toUpperCase(),
            }))
          }
          placeholder="HAFEEZ10"
          className="font-mono uppercase"
        />
      </Field>

      <Field label="Discount type" error={errors.discountType}>
        <Select
          value={form.discountType}
          onChange={(event) =>
            setForm((current) => ({ ...current, discountType: event.target.value }))
          }
        >
          {COUPON_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={percent ? "Percent off" : "Amount off (PKR)"}
        error={errors.discountValue}
        required
        hint={
          percent
            ? "1–100. Applied to the goods subtotal, never to delivery."
            : "Whole rupees, capped at the goods subtotal."
        }
      >
        <Input
          value={form.discountValue}
          inputMode="numeric"
          invalid={Boolean(errors.discountValue)}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              discountValue: event.target.value.replace(/[^\d]/g, ""),
            }))
          }
          className="tnum font-mono"
        />
      </Field>

      <Field
        label="Minimum spend (PKR)"
        error={errors.minSpend}
        hint="Below this the coupon simply stops applying."
      >
        <Input
          value={form.minSpend}
          inputMode="numeric"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              minSpend: event.target.value.replace(/[^\d]/g, ""),
            }))
          }
          className="tnum font-mono"
        />
      </Field>

      <Field label="Maximum uses" error={errors.maxUses} hint="Leave blank for unlimited.">
        <Input
          value={form.maxUses}
          inputMode="numeric"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              maxUses: event.target.value.replace(/[^\d]/g, ""),
            }))
          }
          className="tnum font-mono"
        />
      </Field>

      <div className="flex items-end pb-2">
        <Checkbox
          checked={form.active}
          onChange={(event) =>
            setForm((current) => ({ ...current, active: event.target.checked }))
          }
          label="Active"
          hint="Switch off to disable it without deleting it."
        />
      </div>

      <Field label="Starts" error={errors.startsAt} hint="Blank means it is live now.">
        <Input
          type="date"
          value={form.startsAt}
          onChange={(event) =>
            setForm((current) => ({ ...current, startsAt: event.target.value }))
          }
          className="font-mono"
        />
      </Field>

      <Field label="Expires" error={errors.expiresAt} hint="Blank means it never expires.">
        <Input
          type="date"
          value={form.expiresAt}
          invalid={Boolean(errors.expiresAt)}
          onChange={(event) =>
            setForm((current) => ({ ...current, expiresAt: event.target.value }))
          }
          className="font-mono"
        />
      </Field>

      <Field
        label="Description"
        error={errors.description}
        hint="Shown to the customer when the code is applied."
        className="sm:col-span-2 lg:col-span-3"
      >
        <Textarea
          rows={2}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </Field>
    </FormGrid>
  );
}

/* ========================================================================== */
/* Manager                                                                    */
/* ========================================================================== */

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
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
      "/api/admin/coupons",
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }

    toast.success("Coupon created.");
    setForm(emptyForm());
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <Panel title="New coupon">
          <form onSubmit={create} className="flex flex-col gap-4" noValidate>
            <CouponFields form={form} setForm={setForm} errors={errors} />
            <div className="flex items-center gap-2">
              <Button type="submit" loading={saving}>
                Create coupon
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
            New coupon
          </Button>
        </div>
      )}

      {coupons.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line-strong)] px-4 py-10 text-center text-sm text-ash">
          No coupons. The checkout&rsquo;s code box simply rejects anything typed into
          it until one exists.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              open={openId === coupon.id}
              onToggle={() =>
                setOpenId((current) => (current === coupon.id ? null : coupon.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CouponCard({
  coupon,
  open,
  onToggle,
}: {
  coupon: CouponRow;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>(() => formFrom(coupon));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setForm(formFrom(coupon)), [coupon]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPatch<{ ok: true }>(
      `/api/admin/coupons/${coupon.id}`,
      toPayload(form),
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }
    toast.success("Coupon saved.");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/coupons/${coupon.id}`);
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Coupon deleted.");
    router.refresh();
  }

  const state = STATE_LABELS[coupon.state];

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
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm uppercase tracking-wider text-chrome">
              {coupon.code}
            </span>
            <Pill tone={state.tone}>{state.label}</Pill>
          </span>
          <span className="mt-0.5 block text-xs text-ash">
            {coupon.discountType === "percent"
              ? `${coupon.discountValue}% off`
              : `${formatPKR(coupon.discountValue)} off`}
            {coupon.minSpend ? ` over ${formatPKR(coupon.minSpend)}` : ""} ·{" "}
            {coupon.usedCount} used
            {coupon.maxUses !== null ? ` of ${coupon.maxUses}` : " (unlimited)"}
            {coupon.expiresAt ? ` · until ${coupon.expiresAt}` : ""}
          </span>
        </span>
      </button>

      {open && (
        <form
          onSubmit={save}
          className="flex flex-col gap-4 border-t border-[var(--color-line)] p-4"
          noValidate
        >
          <CouponFields form={form} setForm={setForm} errors={errors} lockCode />

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
            <span className="text-xs text-ash">
              Orders keep the code they used, so deleting does not change history.
            </span>
          </div>
        </form>
      )}
    </li>
  );
}
