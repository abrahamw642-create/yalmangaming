"use client";

/**
 * Yalman Gaming admin — save feedback.
 *
 * Deliberately separate from the storefront's toaster: the admin shell never
 * mounts the store layout, and every editor here needs the same two-line
 * confirmation ("Saved", or the exact reason it did not save). Kept tiny so
 * the dashboard's client bundle stays small.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type Toast = { id: number; tone: ToastTone; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = React.createContext<ToastApi | null>(null);

/** How long a toast stays up. Errors linger — they are usually a next step. */
const TIMEOUT_MS = { success: 2_600, info: 3_200, error: 6_000 } as const;

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TIMEOUT_MS[tone]);
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // `aria-live` rather than a dialog: a save confirmation must reach a
        // screen reader without stealing focus from the field being edited.
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "glass-strong pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-[var(--shadow-lift)]",
              toast.tone === "success" && "border-emerald/40",
              toast.tone === "error" && "border-rose/40",
              toast.tone === "info" && "border-cyan/40",
            )}
          >
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                toast.tone === "success" && "bg-emerald",
                toast.tone === "error" && "bg-rose",
                toast.tone === "info" && "bg-cyan",
              )}
            />
            <p className="flex-1 text-sm leading-relaxed text-chrome">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 -mt-1 rounded p-1 text-ash transition-colors hover:text-chrome"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns a no-op API when no provider is mounted rather than throwing: a
 * missing toaster should never take down an editor mid-save.
 */
export function useToast(): ToastApi {
  const context = React.useContext(ToastContext);
  return (
    context ?? {
      success: () => {},
      error: () => {},
      info: () => {},
    }
  );
}
