"use client";

/**
 * What a customer can do with a finished configuration.
 *
 * Two rules govern everything here:
 *
 *  - A build with a hard compatibility error never reaches the cart, a saved
 *    record or a quote. The server enforces this again; the UI just refuses
 *    early and says why.
 *  - Nothing client-side is treated as authoritative. Save and quote post
 *    part *ids*; the route handler re-reads prices and re-runs the engine.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  FileText,
  MessageCircle,
  Save,
  Share2,
  ShoppingCart,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  buildText,
  shareUrlFor,
  toBuildPayload,
} from "@/lib/build-serialize";
import { useBuild } from "@/lib/build-store";
import { useCart } from "@/components/cart/CartProvider";
import { whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui";

type SaveResult = { shareCode: string; id: string };

export function BuildActions({ className }: { className?: string }) {
  const { build, report, loadBuild } = useBuild();
  const cart = useCart();

  const [origin, setOrigin] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [addedToCart, setAddedToCart] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);

  // Resolved after mount so the server render and the first client render emit
  // the same href, then upgraded to an absolute URL.
  React.useEffect(() => setOrigin(window.location.origin), []);

  const parts = Object.values(build.selection).flat();
  const empty = parts.length === 0;
  const blocked = report.status === "error";
  const shareUrl = build.shareCode
    ? shareUrlFor(build.shareCode, origin || null)
    : null;

  // Any edit clears `shareCode` in the reducer, so its presence is exactly
  // "saved, and unchanged since". No separate dirty flag to keep in sync.
  const saved = Boolean(build.shareCode);

  const whatsappHref = React.useMemo(
    () => whatsappLink(buildText(build, report, { shareUrl })),
    [build, report, shareUrl],
  );

  const disabledReason = empty
    ? "Add at least one part first."
    : blocked
      ? "Resolve the compatibility errors above first."
      : null;

  async function save(): Promise<SaveResult | null> {
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBuildPayload(build)),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(messageFrom(data) ?? "Could not save this build. Try again.");
        return null;
      }

      const result = data as Partial<SaveResult> | null;
      if (!result?.shareCode || !result.id) {
        setError("The server did not return a share code.");
        return null;
      }

      loadBuild({ ...build, id: result.id, shareCode: result.shareCode });
      return { shareCode: result.shareCode, id: result.id };
    } catch {
      setError("Network error. Check your connection and try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const code = build.shareCode ?? (await save())?.shareCode;
    if (!code) return;

    const url = shareUrlFor(code, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard blocked (insecure context, denied permission): fall back to
      // showing the link so it can be copied by hand.
      setError(`Copy this link: ${url}`);
    }
  }

  function addToCart() {
    if (empty || blocked) return;
    cart.addBuild(build, report);
    cart.setOpen(true);
    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 2400);
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <Button
        variant="primary"
        size="lg"
        onClick={addToCart}
        disabled={empty || blocked}
        className="w-full"
      >
        {addedToCart ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Added to cart
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Add build to cart
          </>
        )}
      </Button>

      {disabledReason && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ash">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {disabledReason}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => void save()}
          loading={saving}
          disabled={empty || saved}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save build
            </>
          )}
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={() => void share()}
          disabled={empty || saving}
        >
          {copied ? (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Link copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share build
            </>
          )}
        </Button>
      </div>

      {shareUrl && (
        <p className="truncate rounded-lg border border-line bg-carbon px-3 py-2 font-mono text-[0.6875rem] text-silver">
          {shareUrl}
        </p>
      )}

      <Button
        variant="outline"
        size="md"
        onClick={() => setQuoteOpen(true)}
        disabled={empty}
        className="w-full"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        Request a quote
      </Button>

      <ButtonLink
        href={whatsappHref}
        variant="whatsapp"
        size="md"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Ask Yalman Gaming
      </ButtonLink>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose/30 bg-rose/[0.07] px-3 py-2 text-xs leading-relaxed text-rose"
        >
          {error}
        </p>
      )}

      {quoteOpen && (
        <QuoteDialog onClose={() => setQuoteOpen(false)} />
      )}
    </div>
  );
}

function messageFrom(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error: unknown }).error;
    if (typeof value === "string") return value;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Quote dialog                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Portalled to `document.body` so it escapes the sticky summary column's
 * stacking and overflow context — a modal rendered inside a sticky sidebar
 * would otherwise be clipped to it.
 */
function QuoteDialog({ onClose }: { onClose: () => void }) {
  const { build, report } = useBuild();
  const [mounted, setMounted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [city, setCity] = React.useState("");
  const [message, setMessage] = React.useState("");

  const titleId = React.useId();
  const firstFieldRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          city: city.trim() || undefined,
          message: message.trim() || undefined,
          build: toBuildPayload(build),
        }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          messageFrom(data) ??
            "Could not send this request. Please try again, or message us on WhatsApp.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again, or message us on WhatsApp.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-void/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong w-full max-w-lg rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="font-display text-lg font-bold text-chrome"
            >
              Request a quote
            </h2>
            <p className="mt-0.5 text-xs text-silver">
              We confirm current pricing and availability, then call you back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ash hover:bg-white/5 hover:text-chrome"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10 text-emerald">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 font-display text-lg font-semibold text-chrome">
              Request sent
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-silver">
              Your configuration is with the Yalman Gaming bench. We will get
              back to you on the number you gave us.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="mt-5"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 px-5 py-4">
            <Field
              id="quote-name"
              label="Your name"
              required
              value={name}
              onChange={setName}
              inputRef={firstFieldRef}
              autoComplete="name"
            />
            <Field
              id="quote-phone"
              label="Phone number"
              required
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
              hint="So we can call you back with confirmed pricing."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="quote-email"
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                optional
              />
              <Field
                id="quote-city"
                label="City"
                value={city}
                onChange={setCity}
                autoComplete="address-level2"
                optional
              />
            </div>

            <div>
              <label
                htmlFor="quote-message"
                className="mb-1.5 block text-xs font-medium text-silver"
              >
                Anything else?{" "}
                <span className="text-ash">(optional)</span>
              </label>
              <textarea
                id="quote-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl border border-line bg-carbon px-3 py-2.5 text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40"
                placeholder="Delivery city, timeline, parts you already own…"
              />
            </div>

            <p className="rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-silver">
              Sending{" "}
              <span className="font-medium text-chrome">
                {build.name.trim() || "Untitled Build"}
              </span>{" "}
              — {Object.values(build.selection).flat().length} parts,{" "}
              {report.power.estimatedWatts}W estimated draw.
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose/30 bg-rose/[0.07] px-3 py-2 text-xs leading-relaxed text-rose"
              >
                {error}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                disabled={!name.trim() || phone.trim().length < 7}
                className="flex-1"
              >
                Send request
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  optional = false,
  hint,
  autoComplete,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-silver">
        {label}
        {optional && <span className="ml-1 text-ash">(optional)</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line bg-carbon px-3 text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40"
      />
      {hint && <p className="mt-1 text-[0.6875rem] text-ash">{hint}</p>}
    </div>
  );
}
