"use client";

/**
 * Yalman Gaming admin — quote status and reply notes.
 *
 * The status buttons save immediately (one click, one fact), while the notes
 * box saves explicitly — nobody wants a half-typed sentence written to the
 * database on every keystroke.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { adminDelete, adminPatch } from "@/components/admin/api";
import { QUOTE_STATUSES } from "@/components/admin/schema";
import { useToast } from "@/components/admin/Toast";
import { Textarea } from "@/components/admin/ui";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export function QuoteControls({
  quoteId,
  status,
  notes,
}: {
  quoteId: string;
  status: string;
  notes: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState(notes ?? "");
  const [savingStatus, setSavingStatus] = React.useState<string | null>(null);
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setDraft(notes ?? ""), [notes]);

  async function setStatus(next: string) {
    if (next === status) return;
    setSavingStatus(next);
    const result = await adminPatch<{ ok: true }>(`/api/admin/quotes/${quoteId}`, {
      status: next,
    });
    setSavingStatus(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marked ${next}.`);
    router.refresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    const result = await adminPatch<{ ok: true }>(`/api/admin/quotes/${quoteId}`, {
      notes: draft.trim() || null,
    });
    setSavingNotes(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Notes saved.");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const result = await adminDelete<{ ok: true }>(`/api/admin/quotes/${quoteId}`);
    setDeleting(false);
    setConfirmDelete(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Quote request deleted.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
          Status
        </span>
        {QUOTE_STATUSES.map((option) => {
          const active = option.id === status;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatus(option.id)}
              title={option.hint}
              aria-pressed={active}
              disabled={savingStatus !== null}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60",
                active
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-[var(--color-line-strong)] text-silver hover:text-chrome",
              )}
            >
              {savingStatus === option.id && <Spinner className="h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`quote-notes-${quoteId}`}
          className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash"
        >
          Internal notes
        </label>
        <Textarea
          id={`quote-notes-${quoteId}`}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What was quoted, what the customer said, what to follow up on."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={savingNotes}
            disabled={draft === (notes ?? "")}
            onClick={saveNotes}
          >
            {draft === (notes ?? "") ? "Notes saved" : "Save notes"}
          </Button>

          {confirmDelete ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={deleting}
                onClick={remove}
              >
                Delete this request
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
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-ash transition-colors hover:text-rose"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
