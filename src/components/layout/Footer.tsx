"use client";

/**
 * The site footer.
 *
 * Everything factual comes from `@/lib/site`: the four link groups, the full
 * store address, the phone number and the Google rating. Two deliberate
 * omissions:
 *
 *  - **No social links.** Yalman Gaming has not given us profile URLs, and a
 *    guessed one would send customers to somebody else's page.
 *  - **No opening time.** Only the closing time is confirmed, so the footer
 *    says when the shop closes and nothing more.
 *
 * The whole file is a client component because the newsletter form lives in it;
 * the cost is a few kilobytes of static link data, which is cheaper than a
 * second module boundary for one input.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Wrench,
} from "lucide-react";
import {
  FOOTER_LINKS,
  businessHours,
  contact,
  mapsLinks,
  ratings,
  siteConfig,
  storeAddress,
  telLink,
  whatsappLink,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { Wordmark } from "./Wordmark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="no-print relative mt-24 border-t border-line bg-carbon">
      {/* A hairline of accent along the very top edge, so the footer reads as a
          deliberate end to the page rather than the page simply stopping. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent"
      />

      <div className="container-page py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* --- Identity + store ------------------------------------------ */}
          <div className="flex flex-col gap-6">
            <Link href="/" aria-label="Yalman Gaming — home" className="w-fit rounded-lg">
              <Wordmark size="md" />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-silver">
              {siteConfig.tagline} Gaming PCs, components and custom builds — in
              the shop at Hafeez Centre, or configured online.
            </p>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-cyan" aria-hidden="true" />
                <address className="not-italic leading-relaxed text-silver">
                  {storeAddress.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  <a
                    href={mapsLinks.directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan underline-offset-4 hover:underline"
                  >
                    Get directions
                    <ArrowRight size={12} aria-hidden="true" />
                  </a>
                </address>
              </div>

              <a
                href={telLink}
                className="flex items-center gap-3 text-silver transition-colors hover:text-chrome"
              >
                <Phone size={16} className="shrink-0 text-cyan" aria-hidden="true" />
                <span className="tnum font-mono">{contact.phoneDisplay}</span>
              </a>

              <a
                href={whatsappLink(
                  "Hi Yalman Gaming — I found you through your website.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-silver transition-colors hover:text-chrome"
              >
                <MessageCircle size={16} className="shrink-0 text-[#25D366]" aria-hidden="true" />
                WhatsApp us
              </a>

              {/* Only the closing time is confirmed — see @/lib/site. A status
                  dot is deliberately not used here: it would imply the shop is
                  open right now, which nothing on this site actually knows. */}
              <p className="flex gap-3 text-xs leading-relaxed text-ash">
                <Clock size={16} className="mt-px shrink-0 text-ash" aria-hidden="true" />
                <span>
                  We close at {businessHours.closingTime}. {businessHours.note}
                </span>
              </p>
            </div>

            {/* --- Trust ---------------------------------------------------- */}
            <div className="flex w-fit items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <Star size={18} className="shrink-0 text-ember" aria-hidden="true" fill="currentColor" />
              <p className="text-sm text-silver">
                <span className="tnum font-display font-semibold text-chrome">
                  {ratings.google.score.toFixed(1)}
                </span>{" "}
                on {ratings.google.label} from{" "}
                <span className="tnum">{ratings.google.count}</span> reviews
              </p>
            </div>
          </div>

          {/* --- Link groups + newsletter ---------------------------------- */}
          <div className="flex flex-col gap-12">
            <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_LINKS.map((group) => (
                <div key={group.heading}>
                  <h2 className="eyebrow">{group.heading}</h2>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {group.links.map((link) => (
                      <li key={`${group.heading}:${link.href}`}>
                        <Link
                          href={link.href}
                          className="text-sm text-silver transition-colors hover:text-chrome"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <NewsletterForm />
          </div>
        </div>

        <div className="rule-fade my-10" />

        {/* --- Legal line --------------------------------------------------- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-ash">
            © {year} {siteConfig.legalName}. {storeAddress.city},{" "}
            {storeAddress.country}.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link href="/privacy" className="text-ash transition-colors hover:text-chrome">
              Privacy
            </Link>
            <Link href="/terms" className="text-ash transition-colors hover:text-chrome">
              Terms
            </Link>
            <Link
              href="/builder"
              className="inline-flex items-center gap-1.5 font-semibold text-cyan transition-opacity hover:opacity-80"
            >
              <Wrench size={13} aria-hidden="true" />
              Build your PC
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                 */
/* -------------------------------------------------------------------------- */

type FormState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

/**
 * Posts to `/api/newsletter`, which is owned by the content area and may not
 * exist yet. A 404 is therefore an expected outcome, not a bug: it degrades to
 * pointing the customer at WhatsApp instead of showing a red error for
 * something they did nothing wrong to cause.
 */
function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<FormState>({ status: "idle" });
  const fieldId = React.useId();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = email.trim();
    if (!value || !value.includes("@")) {
      setState({ status: "error", message: "Enter a valid email address." });
      return;
    }

    setState({ status: "sending" });

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });

      if (response.status === 404 || response.status === 405) {
        setState({
          status: "done",
          message:
            "Email sign-up is not switched on yet — message us on WhatsApp and we will let you know about new stock.",
        });
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setState({
          status: "error",
          message: payload?.error ?? "That did not go through. Please try again.",
        });
        return;
      }

      setEmail("");
      setState({
        status: "done",
        message: "You are on the list. We will only email about stock and deals.",
      });
    } catch {
      setState({
        status: "error",
        message:
          "We could not reach the server. Check your connection and try again.",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-6">
      <h2 className="font-display text-lg font-semibold text-chrome">
        New stock and price drops
      </h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-silver">
        One email when something worth knowing about lands — new GPUs, restocks
        and genuine price changes. No newsletter filler.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={fieldId} className="sr-only">
          Email address
        </label>
        <input
          id={fieldId}
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "idle" ? undefined : `${fieldId}-status`}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-xl border bg-void/60 px-4 text-sm text-chrome",
            "placeholder:text-ash focus:outline-none focus-visible:border-cyan",
            state.status === "error" ? "border-rose/60" : "border-line-strong",
          )}
        />
        <button
          type="submit"
          disabled={state.status === "sending"}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5",
            "metal text-sm font-semibold text-chrome transition-all duration-200",
            "hover:border-line-strong hover:text-white hover:shadow-glow-xs",
            "disabled:pointer-events-none disabled:opacity-45",
          )}
        >
          {state.status === "sending" ? "Sending…" : "Notify me"}
          {state.status !== "sending" && <ArrowRight size={15} aria-hidden="true" />}
        </button>
      </form>

      {state.status !== "idle" && state.status !== "sending" && (
        <p
          id={`${fieldId}-status`}
          role="status"
          aria-live="polite"
          className={cn(
            "mt-3 text-xs leading-relaxed",
            state.status === "error" ? "text-rose" : "text-emerald",
          )}
        >
          {state.message}
        </p>
      )}

      <p className="mt-3 text-xs text-ash">
        Prefer WhatsApp?{" "}
        <a
          href={whatsappLink(
            "Hi Yalman Gaming — please let me know when new stock arrives.",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cyan underline-offset-4 hover:underline"
        >
          Message us
        </a>{" "}
        and we will tell you directly.
      </p>
    </div>
  );
}

export default Footer;
