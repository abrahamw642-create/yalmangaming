"use client";

/**
 * The small-screen navigation sheet.
 *
 * A full-screen panel rather than a slide-out drawer: the nav tree is three
 * levels of links and a partial overlay would put half of them under the thumb
 * rest. While it is open the page behind is frozen, focus is trapped inside,
 * and Escape closes — the same contract as any modal dialog.
 *
 * `BUILD YOUR PC` is pinned to the bottom of the sheet rather than sitting at
 * the end of the list: it is the site's strongest call to action and must stay
 * reachable without scrolling past nine categories to find it.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  Search,
  ShoppingCart,
  Wrench,
  X,
} from "lucide-react";
import {
  businessHours,
  contact,
  mapsLinks,
  storeAddress,
  telLink,
  whatsappLink,
} from "@/lib/site";
import { cn } from "@/lib/utils";
import { MOBILE_NAV, isActiveHref, type StoreNavItem } from "./MegaMenu";
import { openSearch } from "./SearchDialog";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;
  return createPortal(<Sheet onClose={onClose} />, document.body);
}

function Sheet({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Sections a visitor has opened. Seeded with whichever section they are
  // already inside, so the sheet opens showing where they are.
  const [expanded, setExpanded] = React.useState<string[]>(() =>
    MOBILE_NAV.filter(
      (item) =>
        item.children?.some((child) => isActiveHref(pathname, child.href)) ||
        (item.children && isActiveHref(pathname, item.href)),
    ).map((item) => item.label),
  );

  /* --- Scroll lock, initial focus, focus restore -------------------------- */
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  /* --- Escape + focus trap ------------------------------------------------ */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggle = (label: string) =>
    setExpanded((current) =>
      current.includes(label)
        ? current.filter((v) => v !== label)
        : [...current, label],
    );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      className="fixed inset-0 z-[80] flex flex-col bg-void lg:hidden"
    >
      {/* --- Header ------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            openSearch();
          }}
          className="flex flex-1 items-center gap-2.5 rounded-xl border border-line-strong bg-white/[0.03] px-3 py-2.5 text-sm text-ash"
        >
          <Search size={16} aria-hidden="true" />
          Search products
        </button>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong text-chrome transition-colors hover:border-cyan/50"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* --- Tree -------------------------------------------------------- */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-label="Main">
        <ul className="flex flex-col gap-0.5">
          {MOBILE_NAV.map((item) => (
            <li key={item.label}>
              {item.children?.length ? (
                <Accordion
                  item={item}
                  pathname={pathname}
                  open={expanded.includes(item.label)}
                  onToggle={() => toggle(item.label)}
                  onNavigate={onClose}
                />
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActiveHref(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-3.5",
                    "font-display text-lg font-semibold transition-colors",
                    isActiveHref(pathname, item.href)
                      ? "bg-white/[0.05] text-chrome"
                      : "text-silver hover:bg-white/[0.03] hover:text-chrome",
                  )}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="rule-fade my-5" />

        {/* Secondary destinations that are not part of the browse tree. */}
        <ul className="grid grid-cols-2 gap-2">
          {[
            { label: "Cart", href: "/cart", icon: <ShoppingCart size={15} aria-hidden="true" /> },
            { label: "Compare", href: "/compare", icon: <Scale size={15} aria-hidden="true" /> },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-3 text-sm font-medium text-silver transition-colors hover:border-line-strong hover:text-chrome"
              >
                <span className="text-cyan">{link.icon}</span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* --- Store ---------------------------------------------------- */}
        <div className="mt-5 rounded-2xl border border-line bg-white/[0.02] p-4">
          <p className="eyebrow">Visit the shop</p>
          <address className="mt-2 not-italic text-sm leading-relaxed text-silver">
            {storeAddress.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <p className="mt-2 text-xs text-ash">
            We close at {businessHours.closingTime}.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <a
              href={telLink}
              className="inline-flex items-center gap-2.5 text-sm font-medium text-chrome"
            >
              <Phone size={15} className="text-cyan" aria-hidden="true" />
              {contact.phoneDisplay}
            </a>
            <a
              href={whatsappLink("Hi Yalman Gaming — I have a question.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-sm font-medium text-chrome"
            >
              <MessageCircle size={15} className="text-[#25D366]" aria-hidden="true" />
              WhatsApp
            </a>
            <a
              href={mapsLinks.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-sm font-medium text-chrome"
            >
              <MapPin size={15} className="text-cyan" aria-hidden="true" />
              Directions
            </a>
          </div>
        </div>
      </nav>

      {/* --- Pinned CTA --------------------------------------------------- */}
      <div className="border-t border-line bg-carbon px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Link
          href="/builder"
          onClick={onClose}
          className={cn(
            "flex h-13 w-full items-center justify-center gap-2 rounded-xl",
            "bg-gradient-to-b from-cyan to-sky font-display text-sm font-bold tracking-wide text-void",
            "shadow-glow-sm transition-all active:brightness-95",
          )}
        >
          <Wrench size={16} aria-hidden="true" />
          BUILD YOUR PC
        </Link>
      </div>
    </div>
  );
}

function Accordion({
  item,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  item: StoreNavItem;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const panelId = React.useId();
  const active = isActiveHref(pathname, item.href);

  return (
    <>
      <div
        className={cn(
          "flex items-stretch rounded-xl transition-colors",
          active ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
        )}
      >
        {/* The label is a link in its own right — tapping "Components" should
            go to the components listing, not merely expand a list. */}
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex flex-1 items-center px-3 py-3.5 font-display text-lg font-semibold transition-colors",
            active ? "text-chrome" : "text-silver",
          )}
        >
          {item.label}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
          className="grid w-12 place-items-center rounded-r-xl text-ash transition-colors hover:text-chrome"
        >
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cn("transition-transform duration-200", open && "rotate-180 text-cyan")}
          />
        </button>
      </div>

      {open && (
        <ul id={panelId} className="ml-3 mt-0.5 border-l border-line pl-3">
          {item.children?.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={onNavigate}
                aria-current={isActiveHref(pathname, child.href) ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActiveHref(pathname, child.href)
                    ? "text-cyan"
                    : "text-silver hover:text-chrome",
                )}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default MobileNav;
