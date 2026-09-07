"use client";

/**
 * Yalman Gaming admin — saved-build status and deletion.
 *
 * Saved builds are customer property: they are what a share link resolves to,
 * and `/builder?load=<code>` reopens them. Deleting one breaks any link the
 * customer has kept, so the control is two-step and says so.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { adminDelete, adminPatch } from "@/components/admin/api";
import { BUILD_STATUSES } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import { Select } from "@/components/admin/ui";
import { Spinner } from "@/components/ui";

export function BuildControls({
  buildId,
  shareCode,
  status,
  quotedCount,
  orderedCount,
}: {
  buildId: string;
  shareCode: string;
  status: string;
  quotedCount: number;
  orderedCount: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 6_000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  async function setStatus(next: string) {
    setBusy(true);
    const result = await adminPatch<{ ok: true }>(`/api/admin/builds/${buildId}`, {
      status: next,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Build ${shareCode} is now ${next}.`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/builds/${buildId}`);
    setBusy(false);
    setConfirming(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Build ${shareCode} deleted.`);
    router.refresh();
  }

  const linked = quotedCount + orderedCount;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Select
        value={status}
        aria-label={`Status of build ${shareCode}`}
        disabled={busy}
        onChange={(event) => setStatus(event.target.value)}
        className="w-32 py-1 text-xs"
      >
        {BUILD_STATUSES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>

      {confirming ? (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded border border-rose/60 bg-rose/15 px-2 py-0.5 font-mono text-[0.625rem] uppercase text-rose disabled:opacity-50"
        >
          {busy && <Spinner className="h-3 w-3" />}
          {linked > 0 ? "Delete anyway" : "Confirm delete"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          title={
            linked > 0
              ? `This build is attached to ${linked} quote or order record${linked === 1 ? "" : "s"}.`
              : "Deleting breaks the customer's share link."
          }
          className="font-mono text-[0.625rem] uppercase tracking-wider text-ash transition-colors hover:text-rose"
        >
          Delete
        </button>
      )}
    </div>
  );
}
