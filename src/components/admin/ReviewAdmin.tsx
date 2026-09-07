"use client";

/**
 * Yalman Gaming admin — review moderation and entry.
 *
 * There is no review-generation anywhere in this system. The seed writes zero
 * `Review` rows, nothing on the storefront invents review text, and the only
 * way a star rating ever appears on a product is a person typing in what a
 * real customer actually said and approving it here.
 *
 * Approving or deleting recalculates the product's cached `rating` and
 * `reviewCount` server-side, so a product whose last approved review is removed
 * goes back to showing the empty state instead of a stale score.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Trash2, Undo2 } from "lucide-react";

import { adminDelete, adminPatch, adminPost } from "@/components/admin/api";
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
import { Button, Spinner } from "@/components/ui";
import type { ReviewTarget } from "@/lib/admin-queries";
import { cn } from "@/lib/utils";

/* ========================================================================== */
/* Entry form                                                                 */
/* ========================================================================== */

const EMPTY = {
  productId: "",
  authorName: "",
  rating: "5",
  title: "",
  body: "",
  verified: false,
  approved: true,
};

export function ReviewComposer({ targets }: { targets: ReviewTarget[] }) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await adminPost<{ ok: true; id: string }>("/api/admin/reviews", {
      productId: form.productId,
      authorName: form.authorName,
      rating: Number.parseInt(form.rating, 10),
      title: form.title || null,
      body: form.body,
      verified: form.verified,
      approved: form.approved,
    });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.fields);
      toast.error(result.error);
      return;
    }

    toast.success("Review saved.");
    setForm(EMPTY);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Enter a customer review
      </Button>
    );
  }

  return (
    <Panel
      title="Enter a review"
      description="Only what a real Yalman Gaming customer actually said. Nothing on this site generates review text."
      className="w-full"
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormGrid>
          <Field
            label="Product"
            htmlFor="review-product"
            error={errors.productId}
            required
            className="sm:col-span-2"
          >
            <Select
              id="review-product"
              value={form.productId}
              invalid={Boolean(errors.productId)}
              onChange={(event) => set("productId", event.target.value)}
            >
              <option value="">Choose a product…</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} — {target.label}
                  {target.reviewCount > 0 ? ` (${target.reviewCount})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Customer name"
            htmlFor="review-author"
            error={errors.authorName}
            required
            hint="Use the name they are happy to be published under."
          >
            <Input
              id="review-author"
              value={form.authorName}
              invalid={Boolean(errors.authorName)}
              onChange={(event) => set("authorName", event.target.value)}
            />
          </Field>

          <Field label="Rating" htmlFor="review-rating" error={errors.rating} required>
            <Select
              id="review-rating"
              value={form.rating}
              onChange={(event) => set("rating", event.target.value)}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Headline"
            htmlFor="review-title"
            error={errors.title}
            className="sm:col-span-2"
          >
            <Input
              id="review-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Optional — their own words if they gave one"
            />
          </Field>

          <Field
            label="What they said"
            htmlFor="review-body"
            error={errors.body}
            required
            className="sm:col-span-2"
          >
            <Textarea
              id="review-body"
              rows={4}
              value={form.body}
              invalid={Boolean(errors.body)}
              onChange={(event) => set("body", event.target.value)}
            />
          </Field>
        </FormGrid>

        <div className="flex flex-col gap-2">
          <Checkbox
            checked={form.verified}
            onChange={(event) => set("verified", event.target.checked)}
            label="Verified purchase"
            hint="Tick only when you can tie this customer to an order Yalman Gaming fulfilled."
          />
          <Checkbox
            checked={form.approved}
            onChange={(event) => set("approved", event.target.checked)}
            label="Publish immediately"
            hint="Leave unticked to hold it in the queue below."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" loading={saving}>
            Save review
          </Button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setForm(EMPTY);
              setErrors({});
            }}
            className="text-sm text-silver hover:text-chrome"
          >
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

/* ========================================================================== */
/* Moderation actions                                                         */
/* ========================================================================== */

export function ReviewActions({
  reviewId,
  approved,
  productName,
}: {
  reviewId: string;
  approved: boolean;
  productName: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  async function setApproved(next: boolean) {
    setBusy(true);
    const result = await adminPatch<{ ok: true }>(`/api/admin/reviews/${reviewId}`, {
      approved: next,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      next
        ? `Published on ${productName}.`
        : `Hidden from ${productName}. Its rating has been recalculated.`,
    );
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/reviews/${reviewId}`);
    setBusy(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Review deleted.");
    router.refresh();
  }

  const action =
    "inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 font-mono text-[0.625rem] uppercase tracking-wider transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {busy && <Spinner className="h-3.5 w-3.5 text-cyan" />}

      {approved ? (
        <button
          type="button"
          onClick={() => setApproved(false)}
          disabled={busy}
          className={cn(action, "border-[var(--color-line-strong)] text-silver hover:border-ember/50 hover:text-ember")}
        >
          <Undo2 className="h-3 w-3" />
          Unpublish
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setApproved(true)}
          disabled={busy}
          className={cn(action, "border-emerald/50 bg-emerald/10 text-emerald hover:bg-emerald/20")}
        >
          <Check className="h-3 w-3" />
          Publish
        </button>
      )}

      {confirming ? (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className={cn(action, "border-rose/60 bg-rose/15 text-rose")}
        >
          Confirm delete
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          aria-label="Delete review"
          className={cn(action, "border-[var(--color-line-strong)] text-silver hover:border-rose/50 hover:text-rose")}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Static star row                                                            */
/* ========================================================================== */

/** The rating as entered — never averaged, never rounded up. */
export function ReviewStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5",
            step <= rating ? "fill-ember text-ember" : "text-iron",
          )}
        />
      ))}
    </span>
  );
}
