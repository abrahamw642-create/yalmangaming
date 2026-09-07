"use client";

/**
 * Yalman Gaming admin — order status, payment status and internal notes.
 *
 * Kept as one save rather than three toggles: moving an order to *shipped*
 * usually happens in the same breath as marking it paid and writing down what
 * was agreed on the phone, and three separate round trips would let those
 * three facts disagree with each other.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { adminPatch } from "@/components/admin/api";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import { Field, Note, Select, Textarea } from "@/components/admin/ui";
import { Button } from "@/components/ui";

export function OrderStatusForm({
  orderId,
  status,
  paymentStatus,
  notes,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  notes: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [nextStatus, setNextStatus] = React.useState(status);
  const [nextPayment, setNextPayment] = React.useState(paymentStatus);
  const [nextNotes, setNextNotes] = React.useState(notes ?? "");
  const [saving, setSaving] = React.useState(false);

  // Re-sync when the server sends fresh data after a refresh.
  React.useEffect(() => setNextStatus(status), [status]);
  React.useEffect(() => setNextPayment(paymentStatus), [paymentStatus]);
  React.useEffect(() => setNextNotes(notes ?? ""), [notes]);

  const dirty =
    nextStatus !== status ||
    nextPayment !== paymentStatus ||
    nextNotes !== (notes ?? "");

  async function save() {
    setSaving(true);
    const result = await adminPatch<{ ok: true }>(`/api/admin/orders/${orderId}`, {
      status: nextStatus,
      paymentStatus: nextPayment,
      notes: nextNotes.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Order updated.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Order status"
        htmlFor="order-status"
        hint={ORDER_STATUSES.find((option) => option.id === nextStatus)?.hint}
      >
        <Select
          id="order-status"
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value)}
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Payment"
        htmlFor="order-payment"
        hint="No payment gateway is connected to this site, so this is set by hand once the money actually arrives."
      >
        <Select
          id="order-payment"
          value={nextPayment}
          onChange={(event) => setNextPayment(event.target.value)}
        >
          {PAYMENT_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Internal notes"
        htmlFor="order-notes"
        hint="Never shown to the customer. What was agreed on the call goes here."
      >
        <Textarea
          id="order-notes"
          rows={4}
          value={nextNotes}
          onChange={(event) => setNextNotes(event.target.value)}
          placeholder="Called 0328…, confirmed stock, delivery to Johar Town agreed at…"
        />
      </Field>

      {nextStatus === "cancelled" && status !== "cancelled" && (
        <Note tone="warn">
          Cancelling removes this order from committed revenue. Stock taken when the
          order was placed is <strong>not</strong> returned automatically — adjust it
          on the product if the parts went back on the shelf.
        </Note>
      )}

      <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
        {dirty ? "Save changes" : "Saved"}
      </Button>
    </div>
  );
}
