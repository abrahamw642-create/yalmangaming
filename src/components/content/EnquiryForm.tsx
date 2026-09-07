"use client";

/**
 * The one enquiry form, in two configurations.
 *
 * `/contact` asks what the message is about; `/quote` asks for a budget and the
 * games being played. Everything else — the fields, the validation, the error
 * rendering, the success state — is identical, so it lives once here rather
 * than twice in two pages that would slowly drift apart.
 *
 * Validation runs `enquirySchema` in the browser *before* the request is sent,
 * and the route handler runs the same schema again on arrival. The client pass
 * exists to give field-level messages instantly; the server pass is the one
 * that decides anything.
 *
 * Where each variant posts, and why they differ:
 *
 *  - `contact` → `POST /api/contact`, which takes the schema verbatim.
 *  - `quote`   → `POST /api/quote`, which already existed and takes
 *    `{ name, phone, email?, city?, message? }` plus an optional *build*. That
 *    endpoint only records a build when it carries components, so a standalone
 *    quote has nowhere structured to put a budget band or a game list. Rather
 *    than send them to be dropped, `composeQuoteMessage` folds them into the
 *    message the shop actually reads. Nothing the customer typed is lost.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Button, ButtonLink, Card } from "@/components/ui";
import { BUDGET_BANDS } from "@/lib/types";
import { whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";
import { fieldErrors } from "@/lib/validation";
import {
  CONTACT_TOPICS,
  EMPTY_ENQUIRY,
  QUOTE_GAME_OPTIONS,
  budgetLabel,
  enquirySchema,
  topicLabel,
  type EnquiryFormState,
  type EnquirySource,
} from "./forms";

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `POST /api/quote` caps `message` at 1000 characters, and the quote variant
 * appends a budget line and a game list to whatever the customer wrote. The
 * lower ceiling here leaves room for both with margin; the contact variant has
 * nothing appended, so it gets the schema's full allowance.
 */
const MESSAGE_LIMIT: Record<EnquirySource, number> = { contact: 1200, quote: 600 };

/** Absolute ceiling accepted by `/api/quote`. `composeQuoteMessage` respects it. */
const QUOTE_MESSAGE_CEILING = 1000;

/** More than a handful of titles stops being a signal and starts being a list. */
const MAX_GAMES = 6;

/* -------------------------------------------------------------------------- */
/* Field primitives                                                           */
/* -------------------------------------------------------------------------- */

const CONTROL_BASE =
  "w-full rounded-xl border bg-graphite px-3.5 text-[0.9375rem] text-chrome " +
  "placeholder:text-ash/55 transition-colors focus:outline-none";

function controlClasses(invalid: boolean, extra?: string) {
  return cn(
    CONTROL_BASE,
    invalid
      ? "border-rose/60 focus:border-rose"
      : "border-line-strong focus:border-cyan/60",
    extra,
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-silver"
      >
        {label}
        {optional && <span className="text-xs font-normal text-ash">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ash">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Wraps a native `<select>` so it can carry a chevron.
 *
 * `appearance-none` removes the platform arrow along with the rest of the OS
 * styling, and there is no way to restyle just the arrow — so it is drawn back
 * on top, pointer-events off so clicks still reach the select underneath.
 */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
        aria-hidden="true"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message composition                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Folds the quote-only answers into the message body.
 *
 * The game list is trimmed rather than the customer's own words if the total
 * would exceed what the endpoint accepts — their sentences carry more than a
 * list of titles does.
 */
export function composeQuoteMessage(values: EnquiryFormState): string {
  const lines: string[] = [values.message.trim()];

  const budget = budgetLabel(values.budgetId);
  if (budget) lines.push(`Budget: ${budget}`);

  if (values.games.length) lines.push(`Plays: ${values.games.join(", ")}`);

  let composed = lines.join("\n\n");
  if (composed.length > QUOTE_MESSAGE_CEILING && values.games.length) {
    // Drop the games line first; it is the one part the shop can ask about in
    // ten seconds on the phone.
    composed = lines.slice(0, budget ? 2 : 1).join("\n\n");
  }
  return composed.slice(0, QUOTE_MESSAGE_CEILING);
}

/* -------------------------------------------------------------------------- */
/* Submission state                                                           */
/* -------------------------------------------------------------------------- */

type Status =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "sent" }
  | { phase: "failed"; message: string };

/** Both endpoints answer with `error`; only `/api/contact` returns `fields`. */
type ApiPayload = {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
  details?: { fieldErrors?: Record<string, string[]> };
};

function serverFieldErrors(payload: ApiPayload | null): Record<string, string> {
  if (!payload) return {};
  if (payload.fields) return payload.fields;

  // `/api/quote` returns a flattened ZodError instead of the flat map.
  const flat = payload.details?.fieldErrors;
  if (!flat) return {};
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    const first = messages?.[0];
    if (first) out[key] = first;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

export function EnquiryForm({
  variant,
  submitLabel,
  className,
}: {
  variant: EnquirySource;
  submitLabel?: string;
  className?: string;
}) {
  const uid = React.useId();
  const [values, setValues] = React.useState<EnquiryFormState>(EMPTY_ENQUIRY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<Status>({ phase: "idle" });
  const summaryRef = React.useRef<HTMLDivElement>(null);

  const isQuote = variant === "quote";
  const limit = MESSAGE_LIMIT[variant];
  const sending = status.phase === "sending";

  const set = <K extends keyof EnquiryFormState>(
    key: K,
    value: EnquiryFormState[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error the moment the customer starts fixing it; leaving
    // it on screen while they type reads as "still wrong".
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const toggleGame = (game: string) => {
    setValues((prev) => {
      const has = prev.games.includes(game);
      if (has) return { ...prev, games: prev.games.filter((g) => g !== game) };
      if (prev.games.length >= MAX_GAMES) return prev;
      return { ...prev, games: [...prev.games, game] };
    });
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    // Honeypot, checked here rather than left to the schema. A filled value
    // would otherwise fail validation on a field the customer cannot see,
    // leaving a real person (or an over-eager password manager) staring at
    // "check the highlighted fields" with nothing highlighted. Bots get the
    // same success screen they would get from the route.
    if (values.website.trim().length > 0) {
      setStatus({ phase: "sent" });
      return;
    }

    const local: Record<string, string> = {};
    if (values.message.trim().length > limit) {
      local.message = `Keep this under ${limit} characters — or call us and talk it through.`;
    }

    const parsed = enquirySchema.safeParse({
      source: variant,
      name: values.name,
      phone: values.phone,
      email: values.email,
      city: values.city,
      topic: isQuote ? undefined : values.topic || undefined,
      budgetId: isQuote ? values.budgetId || undefined : undefined,
      games: isQuote ? values.games : [],
      message: values.message,
      // Always empty by the time we get here — the honeypot short-circuits
      // above — so it can never contribute an invisible field error.
      website: "",
    });

    const combined = parsed.success
      ? local
      : { ...fieldErrors(parsed.error), ...local };

    if (Object.keys(combined).length > 0) {
      setErrors(combined);
      setStatus({ phase: "idle" });
      // Move the announcement into view; a form that silently refuses to
      // submit below the fold is the worst version of this.
      summaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setErrors({});
    setStatus({ phase: "sending" });

    // Two endpoints, two body shapes. See the note at the top of this file.
    const endpoint = isQuote ? "/api/quote" : "/api/contact";
    const body = isQuote
      ? {
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim() || undefined,
          city: values.city.trim() || undefined,
          message: composeQuoteMessage(values),
        }
      : {
          source: "contact" as const,
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          city: values.city.trim(),
          topic: values.topic || undefined,
          games: [],
          message: values.message.trim(),
          website: values.website,
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as ApiPayload | null;

      if (!response.ok || payload?.ok === false) {
        const fields = serverFieldErrors(payload);
        if (Object.keys(fields).length) setErrors(fields);
        setStatus({
          phase: "failed",
          message:
            payload?.error ??
            "That did not go through. Please try again, or message us on WhatsApp.",
        });
        summaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      setStatus({ phase: "sent" });
    } catch {
      setStatus({
        phase: "failed",
        message:
          "We could not reach the server. Check your connection and try again — or send the same message on WhatsApp.",
      });
    }
  }

  /* --- Sent ------------------------------------------------------------- */

  if (status.phase === "sent") {
    const summary = isQuote
      ? `Hi Yalman Gaming — I just sent a quote request${
          budgetLabel(values.budgetId) ? ` (${budgetLabel(values.budgetId)})` : ""
        }.`
      : `Hi Yalman Gaming — I just sent a message through the website${
          topicLabel(values.topic) ? ` about ${topicLabel(values.topic)?.toLowerCase()}` : ""
        }.`;

    return (
      <Card className={cn("p-6 md:p-8", className)}>
        <div className="flex gap-4">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-emerald"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2
              className="font-display text-xl font-semibold text-chrome"
              // Announced on arrival: this block replaces the form the customer
              // had focus in, so nothing else would tell a screen reader it
              // worked.
              role="status"
            >
              {isQuote ? "Quote request sent" : "Message sent"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              It is with the shop, filed under{" "}
              <span className="font-mono text-chrome">{values.name.trim()}</span>{" "}
              on{" "}
              <span className="tnum font-mono text-chrome">
                {values.phone.trim()}
              </span>
              . Someone will call you back on that number.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ash">
              We have not set a reply time we can promise, so if it is urgent
              please ring the shop or send the same thing on WhatsApp — that is
              always the fastest route.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <ButtonLink
                href={whatsappLink(summary)}
                variant="whatsapp"
                size="md"
                target="_blank"
                rel="noopener noreferrer"
                prefetch={false}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Continue on WhatsApp
              </ButtonLink>
              <ButtonLink href="/builder" variant="secondary" size="md">
                BUILD YOUR PC
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setValues(EMPTY_ENQUIRY);
                  setStatus({ phase: "idle" });
                }}
              >
                Send another
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  /* --- Form ------------------------------------------------------------- */

  const remaining = limit - values.message.length;

  return (
    <Card className={cn("p-6 md:p-8", className)}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {/* Honeypot. Off-screen and hidden from assistive technology; a filled
            value makes the route answer as though it succeeded. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor={`${uid}-website`}>Leave this field empty</label>
          <input
            id={`${uid}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>

        {/* One live region for the whole form. Errors and failures both land
            here so a screen reader hears the outcome without focus moving. */}
        <div ref={summaryRef} role="alert" aria-live="assertive">
          {status.phase === "failed" && (
            <p className="flex items-start gap-2 rounded-xl border border-rose/40 bg-rose/[0.07] px-4 py-3 text-sm leading-relaxed text-rose">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {status.message}
            </p>
          )}
          {status.phase !== "failed" && Object.keys(errors).length > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-rose/40 bg-rose/[0.07] px-4 py-3 text-sm leading-relaxed text-rose">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Please check the highlighted fields below.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-name`} label="Your name" error={errors.name}>
            <input
              id={`${uid}-name`}
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? `${uid}-name-error` : undefined}
              className={controlClasses(!!errors.name, "h-12")}
            />
          </Field>

          <Field
            id={`${uid}-phone`}
            label="Phone"
            error={errors.phone}
            hint="We call this number back. WhatsApp works on it too."
          >
            <input
              id={`${uid}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0328 4400231"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={!!errors.phone || undefined}
              aria-describedby={errors.phone ? `${uid}-phone-error` : undefined}
              className={controlClasses(!!errors.phone, "tnum h-12 font-mono")}
            />
          </Field>

          <Field id={`${uid}-email`} label="Email" optional error={errors.email}>
            <input
              id={`${uid}-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={!!errors.email || undefined}
              aria-describedby={errors.email ? `${uid}-email-error` : undefined}
              className={controlClasses(!!errors.email, "h-12")}
            />
          </Field>

          <Field id={`${uid}-city`} label="City" optional error={errors.city}>
            <input
              id={`${uid}-city`}
              name="city"
              type="text"
              autoComplete="address-level2"
              placeholder="Lahore"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              aria-invalid={!!errors.city || undefined}
              aria-describedby={errors.city ? `${uid}-city-error` : undefined}
              className={controlClasses(!!errors.city, "h-12")}
            />
          </Field>

          {isQuote ? (
            <Field
              id={`${uid}-budget`}
              label="Budget"
              optional
              error={errors.budgetId}
              className="sm:col-span-2"
              hint="A range is enough — it tells us which parts are worth discussing."
            >
              <SelectShell>
                <select
                  id={`${uid}-budget`}
                  name="budgetId"
                  value={values.budgetId}
                  onChange={(e) => set("budgetId", e.target.value)}
                  aria-invalid={!!errors.budgetId || undefined}
                  className={controlClasses(!!errors.budgetId, "h-12 appearance-none pr-10")}
                >
                  <option value="">Not sure yet</option>
                  {BUDGET_BANDS.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.label} — {band.blurb}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
          ) : (
            <Field
              id={`${uid}-topic`}
              label="What is this about?"
              optional
              error={errors.topic}
              className="sm:col-span-2"
            >
              <SelectShell>
                <select
                  id={`${uid}-topic`}
                  name="topic"
                  value={values.topic}
                  onChange={(e) => set("topic", e.target.value)}
                  aria-invalid={!!errors.topic || undefined}
                  className={controlClasses(!!errors.topic, "h-12 appearance-none pr-10")}
                >
                  <option value="">Choose one</option>
                  {CONTACT_TOPICS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
          )}
        </div>

        {isQuote && (
          <fieldset>
            <legend className="mb-2 flex flex-wrap items-baseline gap-2 text-sm font-medium text-silver">
              What do you play?
              <span className="text-xs font-normal text-ash">
                optional — pick up to {MAX_GAMES}, or just describe it below
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {QUOTE_GAME_OPTIONS.map((game) => {
                const active = values.games.includes(game);
                const full = !active && values.games.length >= MAX_GAMES;
                return (
                  <button
                    key={game}
                    type="button"
                    onClick={() => toggleGame(game)}
                    aria-pressed={active}
                    disabled={full}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
                      active
                        ? "border-cyan/50 bg-cyan/10 text-cyan"
                        : "border-line-strong text-silver hover:border-line-strong hover:text-chrome",
                      full && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {game}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <Field
          id={`${uid}-message`}
          label={isQuote ? "What should the machine do?" : "Your message"}
          error={errors.message}
          hint={
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                {isQuote
                  ? "Resolution, refresh rate, whether you stream or edit — anything that shapes the spec."
                  : "The more specific, the faster we can answer it."}
              </span>
              <span
                className={cn(
                  "tnum font-mono text-[0.6875rem]",
                  remaining < 0 ? "text-rose" : "text-ash",
                )}
              >
                {values.message.length}/{limit}
              </span>
            </span>
          }
        >
          <textarea
            id={`${uid}-message`}
            name="message"
            rows={6}
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={!!errors.message || undefined}
            aria-describedby={errors.message ? `${uid}-message-error` : undefined}
            placeholder={
              isQuote
                ? "I want a 1440p machine for Warzone and some video editing. I already have a monitor and keyboard."
                : "Tell us what you need."
            }
            className={controlClasses(!!errors.message, "resize-y py-3")}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button type="submit" size="lg" loading={sending}>
            {!sending && <Send className="h-4 w-4" aria-hidden="true" />}
            {sending ? "SENDING" : (submitLabel ?? (isQuote ? "REQUEST A QUOTE" : "SEND MESSAGE"))}
          </Button>
          <p className="text-xs leading-relaxed text-ash">
            We use these details to answer you and nothing else. See the{" "}
            <Link href="/privacy" className="text-cyan hover:underline">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </form>
    </Card>
  );
}

export default EnquiryForm;
