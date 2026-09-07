"use client";

/**
 * Yalman Gaming — toasts.
 *
 * Deliberately tiny: a context holding an array, a hook to push onto it, and a
 * portalled viewport. Other areas call `useToast()` after add-to-cart, saving a
 * build or copying a share link.
 *
 * Two decisions worth knowing about:
 *
 *  1. `useToast()` outside the provider returns a no-op API rather than
 *     throwing. A toast is confirmation of something that already happened —
 *     the add-to-cart itself must never fail because the chrome was not mounted.
 *  2. The live region is the viewport container, not each toast. Screen readers
 *     announce additions to an existing `aria-live` region; mounting a fresh
 *     region per toast is unreliable across readers.
 */

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ToastTone = "success" | "info" | "warning" | "error";

export type ToastAction = {
  label: string;
  /** Renders the action as a link. Takes precedence over `onClick`. */
  href?: string;
  onClick?: () => void;
};

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds on screen. `0` keeps it up until dismissed. */
  duration?: number;
  action?: ToastAction;
};

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
  action?: ToastAction;
};

export type ToastApi = {
  toasts: Toast[];
  /** Push a toast. Accepts a bare string for the common one-liner case. */
  toast: (input: ToastInput | string) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  /** Dismiss one toast, or all of them when called with no id. */
  dismiss: (id?: string) => void;
};

/** Errors stay up longer — they usually carry something to act on. */
const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4_000,
  info: 5_000,
  warning: 7_000,
  error: 9_000,
};

/** More than this on screen and the newest is unreadable before it expires. */
const MAX_VISIBLE = 4;

/** Repeat presses of the same button inside this window refresh one toast. */
const DEDUPE_WINDOW_MS = 1_200;

const ToastContext = React.createContext<ToastApi | null>(null);

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);
  // Last toast pushed, so a double-click on "Add to cart" refreshes the toast
  // that is already on screen instead of stacking a duplicate under it.
  const last = React.useRef<{ key: string; id: string; at: number } | null>(null);

  const dismiss = React.useCallback((id?: string) => {
    setToasts((current) => (id ? current.filter((t) => t.id !== id) : []));
  }, []);

  const toast = React.useCallback((input: ToastInput | string) => {
    const normalized: ToastInput =
      typeof input === "string" ? { title: input } : input;
    const tone = normalized.tone ?? "info";
    const key = `${tone}:${normalized.title}:${normalized.description ?? ""}`;
    const now = Date.now();

    if (last.current && last.current.key === key && now - last.current.at < DEDUPE_WINDOW_MS) {
      const id = last.current.id;
      last.current = { key, id, at: now };
      // Re-seat the existing toast at the end of the queue: same id, so the row
      // remounts its timer and the customer gets the full duration again.
      setToasts((current) => {
        const existing = current.find((t) => t.id === id);
        if (!existing) return current;
        return [...current.filter((t) => t.id !== id), existing];
      });
      return id;
    }

    const id = `t${++counter.current}-${now.toString(36)}`;
    last.current = { key, id, at: now };

    const next: Toast = {
      id,
      title: normalized.title,
      description: normalized.description,
      tone,
      duration: normalized.duration ?? DEFAULT_DURATION[tone],
      action: normalized.action,
    };

    setToasts((current) => [...current, next].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = React.useMemo<ToastApi>(
    () => ({
      toasts,
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
      warning: (title, description) => toast({ title, description, tone: "warning" }),
    }),
    [toasts, toast, dismiss],
  );

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

let warnedMissingProvider = false;

const NOOP_API: ToastApi = {
  toasts: [],
  toast: () => "",
  success: () => "",
  error: () => "",
  info: () => "",
  warning: () => "",
  dismiss: () => {},
};

/**
 * Feedback for something that has already succeeded. Safe to call from
 * anywhere; without a `<ToastProvider>` above it the calls simply go nowhere.
 */
export function useToast(): ToastApi {
  const context = React.useContext(ToastContext);

  if (!context) {
    if (process.env.NODE_ENV !== "production" && !warnedMissingProvider) {
      warnedMissingProvider = true;
      console.warn(
        "[Yalman] useToast() was called outside <ToastProvider>. Toasts are disabled for this tree.",
      );
    }
    return NOOP_API;
  }

  return context;
}

/* -------------------------------------------------------------------------- */
/* Viewport                                                                   */
/* -------------------------------------------------------------------------- */

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; ring: string; bar: string }> = {
  success: {
    icon: <Check size={14} aria-hidden="true" />,
    ring: "border-emerald/35 text-emerald",
    bar: "bg-emerald",
  },
  info: {
    icon: <Info size={14} aria-hidden="true" />,
    ring: "border-cyan/35 text-cyan",
    bar: "bg-cyan",
  },
  warning: {
    icon: <TriangleAlert size={14} aria-hidden="true" />,
    ring: "border-ember/35 text-ember",
    bar: "bg-ember",
  },
  error: {
    icon: <CircleX size={14} aria-hidden="true" />,
    ring: "border-rose/35 text-rose",
    bar: "bg-rose",
  },
};

/**
 * The stack itself.
 *
 * Sits above the cart drawer (`z-90`) on purpose: "Added to cart" fires at the
 * same moment the drawer slides in, and the confirmation must not disappear
 * behind it. Top-centre on phones so it never lands on the builder's sticky
 * summary bar or the compare tray; bottom-left on desktop, clear of the
 * WhatsApp float in the opposite corner.
 */
export function Toaster() {
  const context = React.useContext(ToastContext);
  const [mounted, setMounted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !context) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        "no-print pointer-events-none fixed z-[95] flex flex-col gap-2",
        "left-1/2 top-[calc(1rem+env(safe-area-inset-top))] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2",
        "sm:left-6 sm:top-auto sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:translate-x-0",
      )}
    >
      <AnimatePresence initial={false}>
        {context.toasts.map((toast) => (
          <ToastRow
            key={toast.id}
            toast={toast}
            paused={paused}
            onPause={setPaused}
            onDismiss={context.dismiss}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function ToastRow({
  toast,
  paused,
  onPause,
  onDismiss,
}: {
  toast: Toast;
  paused: boolean;
  onPause: (paused: boolean) => void;
  onDismiss: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = TONE_STYLES[toast.tone];

  // Time still owed to this toast. Banked on pause so hovering to read an
  // error message does not restart its clock from the top when you leave.
  const remaining = React.useRef(toast.duration);

  React.useEffect(() => {
    if (toast.duration <= 0 || paused) return;

    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);

    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1_200, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, toast.duration, toast.id, onDismiss]);

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => onPause(true)}
      onMouseLeave={() => onPause(false)}
      onFocusCapture={() => onPause(true)}
      onBlurCapture={() => onPause(false)}
      className="glass-strong pointer-events-auto relative overflow-hidden rounded-xl shadow-lift"
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-0.5", tone.bar)}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3 py-3 pl-4 pr-2.5">
        <span
          className={cn(
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white/5",
            tone.ring,
          )}
        >
          {tone.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-chrome">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-silver">
              {toast.description}
            </p>
          )}

          {toast.action &&
            (toast.action.href ? (
              <Link
                href={toast.action.href}
                onClick={() => onDismiss(toast.id)}
                className="mt-2 inline-flex text-xs font-semibold text-cyan underline-offset-4 hover:underline"
              >
                {toast.action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick?.();
                  onDismiss(toast.id);
                }}
                className="mt-2 inline-flex text-xs font-semibold text-cyan underline-offset-4 hover:underline"
              >
                {toast.action.label}
              </button>
            ))}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-lg p-1.5 text-ash transition-colors hover:bg-white/5 hover:text-chrome"
          aria-label={`Dismiss: ${toast.title}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

export default Toaster;
