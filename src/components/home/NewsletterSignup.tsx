"use client";

/**
 * Section 12 — Stock and offer alerts.
 *
 * The form is driven by a **Server Action** passed down from the page rather
 * than a `fetch` to an API route. Three reasons that is the right call here:
 *
 *  1. It works without JavaScript. React submits the form natively and the
 *     action runs on the server either way, so the one interactive element at
 *     the bottom of a long page is not gated on a hydration that may never
 *     finish on a bad connection.
 *  2. There is no endpoint to keep in step. The validation
 *     (`newsletterSchema`) and the write live together.
 *  3. `useActionState` gives the pending and result states for free, which is
 *     what turns "did that work?" into an answer.
 *
 * Nothing here promises a schedule, a frequency or an unsubscribe flow — none
 * of those has been set up, and a newsletter box that lies about the first
 * email is a bad first impression.
 */

import * as React from "react";
import { useActionState } from "react";
import { ArrowRight, CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Action contract                                                            */
/* -------------------------------------------------------------------------- */

export type NewsletterState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export const NEWSLETTER_INITIAL_STATE: NewsletterState = { status: "idle" };

export type NewsletterAction = (
  state: NewsletterState,
  formData: FormData,
) => Promise<NewsletterState>;

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function NewsletterSignup({ action }: { action: NewsletterAction }) {
  const [state, formAction, pending] = useActionState(
    action,
    NEWSLETTER_INITIAL_STATE,
  );

  const errorId = React.useId();
  const invalid = state.status === "error";

  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <div className="metal relative isolate overflow-hidden rounded-3xl px-6 py-12 md:px-12 md:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[42rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, rgba(34,211,238,0.24), rgba(168,85,247,0.12) 55%, transparent 72%)",
            }}
          />

          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white/[0.03]">
              <Mail className="h-5 w-5 text-cyan" strokeWidth={1.5} aria-hidden="true" />
            </span>

            <h2
              id="newsletter-heading"
              className="mt-6 font-display text-[clamp(1.625rem,3.6vw,2.5rem)] font-bold leading-tight tracking-tight text-chrome-gradient"
            >
              Know when the good stock lands.
            </h2>

            <p className="mt-4 text-base leading-relaxed text-silver">
              Graphics cards and CPUs move fast in Hafeez Centre. Leave your
              email and we will tell you when new hardware arrives and when
              prices drop. We use it for nothing else.
            </p>

            <form
              action={formAction}
              className="mx-auto mt-9 flex w-full max-w-lg flex-col gap-3 sm:flex-row"
            >
              {/* Honeypot. Hidden from people and from assistive technology;
                  a filled value is a bot and the action discards it. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label htmlFor="website">Leave this field empty</label>
                <input
                  id="website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  defaultValue=""
                />
              </div>

              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                aria-invalid={invalid || undefined}
                aria-describedby={state.status === "idle" ? undefined : errorId}
                className={cn(
                  "h-13 w-full flex-1 rounded-xl border bg-void/60 px-4 text-[0.9375rem]",
                  "text-chrome placeholder:text-ash",
                  "transition-colors duration-200",
                  "focus:border-cyan/60 focus:outline-none focus:ring-2 focus:ring-cyan/25",
                  invalid ? "border-rose/60" : "border-line-strong",
                )}
              />

              <Button
                type="submit"
                size="lg"
                loading={pending}
                className="w-full sm:w-auto"
              >
                {pending ? "SENDING" : "NOTIFY ME"}
                {!pending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>

            {/* One live region for both outcomes, so a screen reader hears the
                result of a submit without the focus moving. */}
            <div
              id={errorId}
              role="status"
              aria-live="polite"
              className="mt-4 min-h-6"
            >
              {state.status === "ok" && (
                <p className="flex items-center justify-center gap-2 text-sm text-emerald">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {state.message}
                </p>
              )}
              {state.status === "error" && (
                <p className="flex items-center justify-center gap-2 text-sm text-rose">
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  {state.message}
                </p>
              )}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-ash">
              Your address is stored so we can email you and is not shared. Tell
              us to remove it and we will.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NewsletterSignup;
