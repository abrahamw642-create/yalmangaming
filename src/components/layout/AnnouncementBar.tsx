"use client";

/**
 * The strip above the navbar.
 *
 * Every line in it is a fact Yalman Gaming supplied (`@/lib/site`): where the
 * shop is, when it closes, the phone number and the Google rating. Nothing
 * here promises a delivery window, a discount or an opening time — only the
 * closing time is confirmed, so only the closing time is stated.
 *
 * Dismissal is remembered in `localStorage`. The server therefore renders the
 * bar for everyone and a returning visitor's copy is removed on hydration;
 * doing it the other way round would hide the bar from search engines and
 * flash it *in* for the majority who never dismissed it.
 */

import * as React from "react";
import Link from "next/link";
import { MapPin, Phone, Star, X } from "lucide-react";
import {
  businessHours,
  contact,
  mapsLinks,
  ratings,
  storeAddress,
  telLink,
} from "@/lib/site";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "yalman:announcement:v1";
const ROTATE_MS = 7_000;

type Line = {
  id: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

const LINES: Line[] = [
  {
    id: "store",
    icon: <MapPin size={13} aria-hidden="true" />,
    content: (
      <>
        <span className="text-chrome">{storeAddress.building}</span>
        <span className="text-ash">
          {" "}
          · {storeAddress.block}, {storeAddress.city}
        </span>
        <a
          href={mapsLinks.directions}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 font-semibold text-cyan underline-offset-4 hover:underline"
        >
          Directions
        </a>
      </>
    ),
  },
  {
    id: "hours",
    icon: <Phone size={13} aria-hidden="true" />,
    content: (
      <>
        <span className="text-ash">We close at {businessHours.closingTime} —</span>{" "}
        <a
          href={telLink}
          className="font-semibold text-chrome underline-offset-4 hover:underline"
        >
          {contact.phoneDisplay}
        </a>
      </>
    ),
  },
  {
    id: "rating",
    icon: <Star size={13} aria-hidden="true" />,
    content: (
      <>
        <span className="tnum text-chrome">
          {ratings.google.score.toFixed(1)}
        </span>
        <span className="text-ash">
          {" "}
          on {ratings.google.label} from {ratings.google.count} reviews
        </span>
      </>
    ),
  },
];

export function AnnouncementBar() {
  const [dismissed, setDismissed] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // Storage blocked — show the bar; it is only ever an inconvenience.
    }
  }, []);

  React.useEffect(() => {
    if (dismissed) return;
    // `prefers-reduced-motion` covers involuntary movement, and a line that
    // swaps itself out from under a reader is exactly that.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % LINES.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [dismissed]);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* Dismissed for this page view only. */
    }
  };

  return (
    <div className="no-print relative border-b border-line bg-carbon">
      <div className="container-page flex h-9 items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2 text-xs">
          <span className="shrink-0 text-cyan">{LINES[index].icon}</span>
          <span className="truncate">{LINES[index].content}</span>
        </p>

        <div className="flex shrink-0 items-center gap-1">
          {/* Dots double as manual controls — a strip that rotates itself and
              cannot be stopped is unusable for anyone who reads slowly.
              Plain toggle buttons, not a tablist: there are no tab panels
              here, only one line of text being swapped. */}
          <div
            className="hidden items-center gap-1.5 sm:flex"
            role="group"
            aria-label="Store information"
          >
            {LINES.map((line, i) => (
              <button
                key={line.id}
                type="button"
                aria-pressed={i === index}
                aria-label={`Show store information ${i + 1} of ${LINES.length}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index ? "bg-cyan" : "bg-white/15 hover:bg-white/30",
                )}
              />
            ))}
          </div>

          <Link
            href="/contact"
            className="hidden text-xs font-medium text-silver transition-colors hover:text-chrome md:inline"
          >
            Visit the store
          </Link>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss store information"
            className="rounded-md p-1 text-ash transition-colors hover:bg-white/5 hover:text-chrome"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBar;
