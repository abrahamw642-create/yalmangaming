"use client";

/**
 * What a customer can do with a recommendation.
 *
 * Four exits, in the order the store actually wants them:
 *   1. Open it in the builder — the recommendation is a starting point, not a
 *      verdict, and every part should be swappable.
 *   2. Add the whole machine to the cart.
 *   3. Ask for a quote, so the shop confirms pricing and availability.
 *   4. Send the whole configuration to WhatsApp.
 *
 * Nothing here is treated as authoritative. "Open in builder" and "Request a
 * quote" both POST part *ids*; the route handlers re-read every price and run
 * `checkCompatibility` again over database rows before they write anything. A
 * build the engine could not fully repair never reaches any of them.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  FileText,
  MessageCircle,
  Settings2,
  ShoppingCart,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { Button, ButtonLink, Price } from "@/components/ui";
import { useCart } from "@/components/cart/CartProvider";
import type { Recommendation } from "@/lib/recommend";
import {
  bandIdFor,
  buildText,
  defaultServiceIds,
  selectedServices,
  servicesSubtotal,
  shareUrlFor,
  toBuildPayload,
} from "@/lib/build-serialize";
import { BUILD_STORAGE_KEY } from "@/lib/build-store";
import type { BuildState } from "@/lib/types";
import { whatsappLink } from "@/lib/site";
import { normalizePkPhone } from "@/lib/validation";
import { cn, formatPKR } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Recommendation -> build state                                              */
/* -------------------------------------------------------------------------- */

/**
 * The recommendation, expressed in the shape the rest of the site already
 * speaks: the builder store, the cart and both route handlers all take a
 * `BuildState`, so the hand-off needs no bespoke wire format.
 */
function toBuildState(
  recommendation: Recommendation,
  services: string[],
): BuildState {
  const { input } = recommendation;
  return {
    id: null,
    shareCode: null,
    name: recommendation.suggestedName,
    goal: input.goal,
    budgetId: bandIdFor(input.budgetMin, input.budgetMax),
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    resolution: input.resolution,
    targetFps: input.targetFps,
    games: input.games,
    selection: recommendation.selection,
    services,
    assembleForMe: services.length > 0,
  };
}

/**
 * Hands the configuration to the builder directly, as well as by share code.
 *
 * `BuildProvider` restores `BUILD_STORAGE_KEY` on mount and runs the result
 * through `sanitizeBuildState`, so seeding it is the same published contract as
 * calling `loadBuild` — which this page cannot do, because it deliberately sits
 * outside the builder's provider. The `?load=` deep link stays the source of
 * truth: whatever the server returns for the share code wins over this the
 * moment it arrives.
 */
function seedBuilderState(build: BuildState, id: string, shareCode: string) {
  try {
    window.localStorage.setItem(
      BUILD_STORAGE_KEY,
      JSON.stringify({ ...build, id, shareCode }),
    );
  } catch {
    // Private browsing or a full quota. The share code still opens the build.
  }
}

function messageFrom(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error: unknown }).error;
    if (typeof value === "string") return value;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export function RecommendActions({
  recommendation,
  className,
}: {
  recommendation: Recommendation;
  className?: string;
}) {
  const cart = useCart();

  const [assemble, setAssemble] = React.useState(false);
  const [origin, setOrigin] = React.useState("");
  const [savedCode, setSavedCode] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Set once the build is saved; the effect below performs the navigation. */
  const [handOff, setHandOff] = React.useState<string | null>(null);

  // Resolved after mount so the server render and the first client render emit
  // the same href, then upgraded to an absolute URL.
  React.useEffect(() => setOrigin(window.location.origin), []);

  /**
   * A full page navigation, deliberately, rather than `router.push`.
   *
   * `/builder` is `force-dynamic` and re-reads the saved build from the server
   * the moment it mounts, so a soft transition preserves nothing worth keeping.
   * Against that, a client-side transition here was observed to fetch the route
   * and then not commit — and this is the one action the whole flow exists to
   * produce. A hand-off this important should not depend on a transition
   * landing when a full load costs nothing.
   */
  React.useEffect(() => {
    if (handOff) window.location.assign(handOff);
  }, [handOff]);

  const services = React.useMemo(
    () => (assemble ? defaultServiceIds() : []),
    [assemble],
  );
  const serviceLines = React.useMemo(() => selectedServices(services), [services]);
  const serviceTotal = servicesSubtotal(services);

  const build = React.useMemo(
    () => toBuildState(recommendation, services),
    [recommendation, services],
  );

  const blocked = recommendation.report.status === "error";
  const componentsTotal = recommendation.budget.total;
  const grandTotal = componentsTotal + serviceTotal;

  const shareUrl = savedCode ? shareUrlFor(savedCode, origin || null) : null;
  const whatsappHref = React.useMemo(
    () => whatsappLink(buildText(build, recommendation.report, { shareUrl })),
    [build, recommendation.report, shareUrl],
  );

  async function openInBuilder() {
    if (blocked) return;
    setError(null);
    setOpening(true);
    try {
      const response = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBuildPayload(build)),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          messageFrom(data) ??
            "Could not hand this build to the builder. Try again in a moment.",
        );
        return;
      }

      const saved = data as { id?: string; shareCode?: string } | null;
      if (!saved?.shareCode || !saved.id) {
        setError("The server did not return a share code.");
        return;
      }

      setSavedCode(saved.shareCode);
      seedBuilderState(build, saved.id, saved.shareCode);
      // The builder pulls the saved configuration back out of the database, so
      // what opens there is what the server actually stored.
      setHandOff(`/builder?load=${encodeURIComponent(saved.shareCode)}`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setOpening(false);
    }
  }

  function addToCart() {
    if (blocked) return;
    cart.addBuild(build, recommendation.report);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* --- Live total --------------------------------------------------- */}
      <div className="metal rounded-2xl p-4">
        <p className="eyebrow mb-2">Your build</p>
        <Price
          price={grandTotal}
          samplePrice={recommendation.samplePricing}
          size="lg"
        />
        <dl className="mt-3 flex flex-col gap-1 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ash">
              {recommendation.parts.length} components
            </dt>
            <dd className="tnum font-mono text-silver">
              {formatPKR(componentsTotal)}
            </dd>
          </div>
          {serviceTotal > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ash">
                {serviceLines.length} assembly services
              </dt>
              <dd className="tnum font-mono text-silver">
                {formatPKR(serviceTotal)}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ash">Estimated draw</dt>
            <dd className="tnum font-mono text-silver">
              {recommendation.report.power.estimatedWatts}W
            </dd>
          </div>
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3">
          <input
            type="checkbox"
            checked={assemble}
            onChange={(event) => setAssemble(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-cyan)]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-chrome">
              <Wrench className="h-3 w-3 text-cyan" aria-hidden="true" />
              Have Yalman Gaming build it
            </span>
            <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ash">
              Assembly, cable management, BIOS, Windows install, drivers and a
              benchmark pass — {formatPKR(servicesSubtotal(defaultServiceIds()))}{" "}
              at sample pricing.
            </span>
          </span>
        </label>
      </div>

      {/* --- Primary exits ------------------------------------------------- */}
      <Button
        variant="primary"
        size="lg"
        onClick={() => void openInBuilder()}
        loading={opening}
        disabled={blocked}
        className="w-full"
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        Open in the builder
      </Button>

      <Button
        variant="secondary"
        size="md"
        onClick={addToCart}
        disabled={blocked}
        className="w-full"
      >
        {added ? (
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="md"
          onClick={() => setQuoteOpen(true)}
          disabled={blocked}
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
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Ask on WhatsApp
        </ButtonLink>
      </div>

      {blocked && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-rose">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          This build still has an unresolved conflict, so it cannot be saved,
          carted or quoted. WhatsApp still works — send it over and we will
          substitute the part.
        </p>
      )}

      {shareUrl && (
        <p className="truncate rounded-lg border border-line bg-carbon px-3 py-2 font-mono text-[0.6875rem] text-silver">
          {shareUrl}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose/30 bg-rose/[0.07] px-3 py-2 text-xs leading-relaxed text-rose"
        >
          {error}
        </p>
      )}

      {quoteOpen && (
        <QuoteDialog
          build={build}
          partCount={recommendation.parts.length}
          watts={recommendation.report.power.estimatedWatts}
          onClose={() => setQuoteOpen(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quote dialog                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Portalled to `document.body` so it escapes the sticky summary column's
 * stacking and overflow context — a modal rendered inside a sticky sidebar
 * would otherwise be clipped to it.
 */
function QuoteDialog({
  build,
  partCount,
  watts,
  onClose,
}: {
  build: BuildState;
  partCount: number;
  watts: number;
  onClose: () => void;
}) {
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Validated with the same helper the checkout uses, so "0328 4400231",
  // "+92 328 4400231" and "03284400231" are all accepted.
  const phoneValid = phone.trim().length === 0 || normalizePkPhone(phone) !== null;
  const canSubmit = name.trim().length >= 2 && normalizePkPhone(phone) !== null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass-strong w-full max-w-lg rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-lg font-bold text-chrome">
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
            <Button variant="secondary" size="md" onClick={onClose} className="mt-5">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 px-5 py-4">
            <Field
              id="rec-quote-name"
              label="Your name"
              required
              value={name}
              onChange={setName}
              inputRef={firstFieldRef}
              autoComplete="name"
            />
            <Field
              id="rec-quote-phone"
              label="Phone number"
              required
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
              hint="So we can call you back with confirmed pricing."
              error={
                phoneValid ? null : "Enter a Pakistani mobile number, like 0328 4400231"
              }
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="rec-quote-email"
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                optional
              />
              <Field
                id="rec-quote-city"
                label="City"
                value={city}
                onChange={setCity}
                autoComplete="address-level2"
                optional
              />
            </div>

            <div>
              <label
                htmlFor="rec-quote-message"
                className="mb-1.5 block text-xs font-medium text-silver"
              >
                Anything else? <span className="text-ash">(optional)</span>
              </label>
              <textarea
                id="rec-quote-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl border border-line bg-carbon px-3 py-2.5 text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/40"
                placeholder="Delivery city, timeline, parts you already own…"
              />
            </div>

            <p className="rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-silver">
              Sending{" "}
              <span className="font-medium text-chrome">{build.name}</span> —{" "}
              {partCount} parts, {watts}W estimated draw
              {build.services.length > 0
                ? `, with ${build.services.length} assembly services`
                : ""}
              .
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
                disabled={!canSubmit}
                className="flex-1"
              >
                Send request
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
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
  error,
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
  error?: string | null;
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

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
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full rounded-xl border bg-carbon px-3 text-sm text-chrome placeholder:text-ash",
          "focus:outline-none focus:ring-1",
          error
            ? "border-rose/50 focus:border-rose/60 focus:ring-rose/40"
            : "border-line focus:border-cyan/50 focus:ring-cyan/40",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[0.6875rem] text-rose">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[0.6875rem] text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
