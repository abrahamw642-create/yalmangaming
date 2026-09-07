"use client";

/**
 * The desktop navigation model, and the dropdown panel that renders a top-level
 * item's children.
 *
 * ## Why the nav tree is rebuilt here
 *
 * `NAV_ITEMS` in `@/lib/site` links the four gaming-PC tiers at
 * `/shop/gaming-pcs?tier=entry|mid|high|extreme`. There is no `tier` column on
 * `Product`, and `parseProductQuery` in `@/lib/filters` does not read a `tier`
 * parameter — so those URLs silently render the unfiltered prebuilt listing.
 *
 * The catalogue *does* carry the tiers as real `Category` rows
 * (`entry-gaming-pcs`, `mid-range-gaming-pcs`, `high-end-gaming-pcs`,
 * `extreme-gaming-pcs`), each with its own name and description, so this module
 * rewrites those hrefs to the child category slugs rather than inventing a
 * filter dimension the query layer does not have. `@/lib/site` is a shared
 * contract file nobody may edit, hence the remap living here.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, MessageCircle, Wrench } from "lucide-react";
import { NAV_ITEMS, whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Nav model                                                                  */
/* -------------------------------------------------------------------------- */

export type StoreNavChild = { label: string; href: string };

export type StoreNavItem = {
  label: string;
  href: string;
  children?: StoreNavChild[];
  /**
   * Items dropped from the tightest desktop bar. The full set is always in the
   * mobile sheet and the footer, so nothing becomes unreachable.
   */
  secondary?: boolean;
};

/** `?tier=` value → the real category slug that holds those machines. */
const TIER_CATEGORY_SLUGS: Record<string, string> = {
  entry: "entry-gaming-pcs",
  mid: "mid-range-gaming-pcs",
  high: "high-end-gaming-pcs",
  extreme: "extreme-gaming-pcs",
};

/** Rewrites a `?tier=` link onto the category that actually holds that tier. */
function resolveHref(href: string): string {
  const [path, query] = href.split("?");
  if (!query) return href;

  const params = new URLSearchParams(query);
  const tier = params.get("tier");
  if (!tier) return href;

  const slug = TIER_CATEGORY_SLUGS[tier];
  if (!slug) return path;

  params.delete("tier");
  const rest = params.toString();
  return rest ? `/shop/${slug}?${rest}` : `/shop/${slug}`;
}

/**
 * Items the header renders itself and must not repeat in the bar: the wordmark
 * already goes home, and the builder is the primary CTA button.
 */
const HANDLED_ELSEWHERE = new Set(["/", "/builder"]);

/** Kept out of the `lg` bar to stop it wrapping under the action cluster. */
const SECONDARY_LABELS = new Set(["About", "Contact"]);

export const STORE_NAV: StoreNavItem[] = NAV_ITEMS.filter(
  (item) => !HANDLED_ELSEWHERE.has(item.href),
).map((item) => ({
  label: item.label,
  href: resolveHref(item.href),
  secondary: SECONDARY_LABELS.has(item.label),
  children: item.children?.map((child) => ({
    label: child.label,
    href: resolveHref(child.href),
  })),
}));

/** The full tree including Home and the builder, for the mobile sheet. */
export const MOBILE_NAV: StoreNavItem[] = NAV_ITEMS.map((item) => ({
  label: item.label,
  href: resolveHref(item.href),
  children: item.children?.map((child) => ({
    label: child.label,
    href: resolveHref(child.href),
  })),
}));

/** True when `pathname` is inside the section `href` points at. */
export function isActiveHref(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/* -------------------------------------------------------------------------- */
/* Trigger + panel                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One top-level item that owns a dropdown.
 *
 * Opening is deliberately handled three ways because all three are real:
 * pointer users expect hover, keyboard users expect Enter/Space and arrows, and
 * touch users get a click (there is no hover on a touchscreen). The parent owns
 * `open` so only one panel is ever on screen.
 */
export function MegaMenu({
  item,
  open,
  onOpen,
  onClose,
  active,
}: {
  item: StoreNavItem;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  active: boolean;
}) {
  const panelId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  // Hover-out is delayed so crossing the gap between trigger and panel — or
  // slipping off the edge of a link — does not snap the menu shut.
  const closeTimer = React.useRef<number | null>(null);

  const children = item.children ?? [];

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(onClose, 140);
  }, [cancelClose, onClose]);

  React.useEffect(() => cancelClose, [cancelClose]);

  /* Escape closes and returns focus to the trigger; a click anywhere outside
     just closes. Both only while this panel is the open one. */
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      triggerRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose]);

  const focusFirstLink = React.useCallback(() => {
    // Deferred a frame: the panel has just been told to open and is not in the
    // DOM yet on the tick the key event fires.
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerEnter={(event) => {
        // Touch reports as a pointer enter immediately before the click; letting
        // it open here would make the first tap open and the click close again.
        if (event.pointerType === "touch") return;
        cancelClose();
        onOpen();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        scheduleClose();
      }}
      onFocusCapture={cancelClose}
      onBlurCapture={(event) => {
        if (containerRef.current?.contains(event.relatedTarget as Node)) return;
        onClose();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        // A disclosure, not a menubar: the panel holds ordinary links, so
        // `aria-expanded` + `aria-controls` describes it honestly and screen
        // readers do not announce menu-item semantics that are not there.
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpen();
            focusFirstLink();
          }
        }}
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-lg px-2.5 py-2",
          "text-sm font-medium transition-colors duration-200",
          active || open ? "text-chrome" : "text-silver hover:text-chrome",
        )}
      >
        {item.label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn(
            "text-ash transition-transform duration-200",
            open && "rotate-180 text-cyan",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-2.5 -bottom-px h-px",
            "bg-gradient-to-r from-transparent via-cyan to-transparent",
            "transition-opacity duration-200",
            active || open ? "opacity-100" : "opacity-0",
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={item.label}
          className={cn(
            "glass-strong absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-[min(46rem,calc(100vw-3rem))]",
            "-translate-x-1/2 rounded-2xl p-2 shadow-lift",
          )}
        >
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_15rem]">
            <div>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-chrome transition-colors hover:bg-white/5"
              >
                All {item.label}
                <ChevronRight size={14} className="text-ash" aria-hidden="true" />
              </Link>

              <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                {children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onClose}
                      className={cn(
                        "group/link flex items-center gap-2.5 rounded-xl px-3 py-2.5",
                        "text-sm text-silver transition-colors hover:bg-white/5 hover:text-chrome",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong transition-colors group-hover/link:bg-cyan"
                      />
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* The panel's second column is the site's primary CTA restated
                where a shopper is already deciding what to look at. */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
              <div>
                <p className="eyebrow">Not sure what fits?</p>
                <p className="mt-2 text-sm leading-relaxed text-silver">
                  Configure a full machine part by part. Compatibility is checked
                  as you go, with a live wattage estimate.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href="/builder"
                  onClick={onClose}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-xl",
                    "bg-gradient-to-b from-cyan to-sky text-xs font-bold tracking-wide text-void",
                    "shadow-glow-sm transition-all hover:brightness-110",
                  )}
                >
                  <Wrench size={14} aria-hidden="true" />
                  BUILD YOUR PC
                </Link>
                <a
                  href={whatsappLink(
                    "Hi Yalman Gaming — I have a question about what you have in stock.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-line-strong text-xs font-semibold text-silver transition-colors hover:border-cyan/50 hover:text-chrome"
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  Ask on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MegaMenu;
