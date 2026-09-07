"use client";

/**
 * The site header.
 *
 * Sticky, glass, and it *densifies* on scroll: at the top of a page it is tall
 * and transparent so the hero owns the screen; past the fold it shrinks, gains
 * a frosted backing and a hairline, and stops competing with the content behind
 * it. Nothing about the layout changes — only the height and the surface — so
 * there is no reflow of the row itself.
 *
 * The navigation comes from `NAV_ITEMS` in `@/lib/site` by way of `STORE_NAV`
 * in `./MegaMenu`, which is also where the reason for rewriting the gaming-PC
 * tier links is written down.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  ImageOff,
  Menu,
  MessageCircle,
  Phone,
  Scale,
  ShoppingBag,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { CartButton } from "@/components/cart/CartButton";
import { useWishlist } from "@/components/shop/CompareProvider";
import { MAX_COMPARE, type ProductCardData } from "@/lib/filters";
import { contact, telLink, whatsappLink } from "@/lib/site";
import { cn, effectivePrice, formatPKR } from "@/lib/utils";
import { MegaMenu, STORE_NAV, isActiveHref } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { SearchTrigger } from "./SearchDialog";
import { Wordmark } from "./Wordmark";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  /* --- Densify on scroll --------------------------------------------------- */
  React.useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      // Coalesced into one rAF: scroll fires far faster than the browser paints.
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /* Any navigation closes whatever was open. */
  React.useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "no-print sticky top-0 z-40 w-full transition-[height,background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-b border-line bg-void/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_10px_30px_-24px_rgba(0,0,0,1)]"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "container-page flex items-center gap-3 transition-[height] duration-300",
            scrolled ? "h-16" : "h-20",
          )}
        >
          <Link
            href="/"
            aria-label="Yalman Gaming — home"
            className="shrink-0 rounded-lg"
          >
            <Wordmark size={scrolled ? "sm" : "md"} className="transition-all duration-300" />
          </Link>

          <nav
            aria-label="Main"
            className="ml-2 hidden min-w-0 flex-1 items-center lg:flex"
          >
            <ul className="flex items-center gap-0.5">
              {STORE_NAV.map((item) => {
                const active = isActiveHref(pathname, item.href);
                return (
                  <li
                    key={item.label}
                    className={item.secondary ? "hidden 2xl:block" : undefined}
                  >
                    {item.children?.length ? (
                      <MegaMenu
                        item={item}
                        active={active}
                        open={openMenu === item.label}
                        onOpen={() => setOpenMenu(item.label)}
                        onClose={() =>
                          setOpenMenu((current) =>
                            current === item.label ? null : current,
                          )
                        }
                      />
                    ) : (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative inline-flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200",
                          active ? "text-chrome" : "text-silver hover:text-chrome",
                        )}
                      >
                        {item.label}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute inset-x-2.5 -bottom-px h-px",
                            "bg-gradient-to-r from-transparent via-cyan to-transparent",
                            "transition-opacity duration-200",
                            active ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* --- Actions ------------------------------------------------- */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SearchTrigger showShortcut />
            <AccountMenu />
            <WishlistMenu />
            <CartButton />

            <Link
              href="/builder"
              className={cn(
                "hidden h-10 items-center gap-2 rounded-xl px-4 sm:inline-flex lg:px-5",
                "bg-gradient-to-b from-cyan to-sky font-display text-xs font-bold tracking-wide text-void",
                "shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110",
              )}
            >
              <Wrench size={15} aria-hidden="true" />
              <span className="hidden lg:inline">BUILD YOUR PC</span>
              <span className="lg:hidden">BUILD</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-white/[0.03] text-chrome transition-colors hover:border-cyan/50 lg:hidden"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Dropdown shell                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A small popover anchored under a header icon. Closes on Escape (returning
 * focus to its trigger), on a pointer outside it, and on navigation.
 */
function Dropdown({
  label,
  icon,
  badge,
  align = "right",
  className,
  children,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  badge?: number;
  align?: "left" | "right";
  className?: string;
  children: (close: () => void) => React.ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const panelId = React.useId();

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    onOpen?.();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
    // `onOpen` is a fetch trigger; re-running it when the callback identity
    // changes would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-xl border border-line-strong",
          "bg-white/[0.03] text-chrome transition-all duration-200",
          "hover:border-cyan/50 hover:bg-cyan/5 hover:shadow-glow-xs",
          open && "border-cyan/50 bg-cyan/5",
        )}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="tnum absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-cyan to-sky px-1 font-mono text-[0.625rem] font-bold text-void shadow-glow-xs"
            aria-hidden="true"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={cn(
            "glass-strong absolute top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))]",
            "rounded-2xl p-3 shadow-lift",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Account                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * There is no customer account system — checkout is guest-only and orders are
 * confirmed by phone or WhatsApp. Rather than link a `/account` page that does
 * not exist, this says so plainly and offers what a shopper actually wanted:
 * their cart, their saved comparison, and a way to reach the shop.
 */
function AccountMenu() {
  return (
    <Dropdown
      label="Your account"
      icon={<User size={18} aria-hidden="true" />}
      className="hidden sm:block"
    >
      {(close) => (
        <>
          <p className="px-2 pb-2 pt-1 font-display text-sm font-semibold text-chrome">
            No account needed
          </p>
          <p className="px-2 pb-3 text-xs leading-relaxed text-silver">
            Order as a guest — we confirm every order with you by phone or
            WhatsApp before anything is built or dispatched.
          </p>

          <ul className="flex flex-col gap-0.5">
            {[
              { label: "Your cart", href: "/cart", icon: <ShoppingBag size={15} aria-hidden="true" /> },
              { label: "Comparison", href: "/compare", icon: <Scale size={15} aria-hidden="true" /> },
              { label: "Your build", href: "/builder", icon: <Wrench size={15} aria-hidden="true" /> },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-silver transition-colors hover:bg-white/5 hover:text-chrome"
                >
                  <span className="text-cyan">{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="rule-fade my-2" />

          <a
            href={telLink}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-silver transition-colors hover:bg-white/5 hover:text-chrome"
          >
            <Phone size={15} className="text-cyan" aria-hidden="true" />
            {contact.phoneDisplay}
          </a>
          <a
            href={whatsappLink("Hi Yalman Gaming — I need a hand with an order.")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-silver transition-colors hover:bg-white/5 hover:text-chrome"
          >
            <MessageCircle size={15} className="text-[#25D366]" aria-hidden="true" />
            Message us on WhatsApp
          </a>
        </>
      )}
    </Dropdown>
  );
}

/* -------------------------------------------------------------------------- */
/* Wishlist                                                                   */
/* -------------------------------------------------------------------------- */

/** How many saved items the panel will show before it stops fetching. */
const WISHLIST_PREVIEW = 8;

/**
 * Saved items live in the browser (`useWishlist`), so the panel holds ids and
 * has to resolve them to products. `GET /api/products?ids=` caps a request at
 * `MAX_COMPARE` ids — it was built for the comparison table — so the preview is
 * fetched in chunks of that size rather than one oversized request the endpoint
 * would silently truncate.
 */
function WishlistMenu() {
  const wishlist = useWishlist();
  const [items, setItems] = React.useState<ProductCardData[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const ids = React.useMemo(
    () => wishlist.ids.slice(0, WISHLIST_PREVIEW).join(","),
    [wishlist.ids],
  );

  const load = React.useCallback(async () => {
    if (!ids) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const chunks: string[][] = [];
      const list = ids.split(",");
      for (let i = 0; i < list.length; i += MAX_COMPARE) {
        chunks.push(list.slice(i, i + MAX_COMPARE));
      }

      const responses = await Promise.all(
        chunks.map((chunk) =>
          fetch(`/api/products?ids=${encodeURIComponent(chunk.join(","))}`).then(
            (response) =>
              response.ok
                ? (response.json() as Promise<{ items: ProductCardData[] }>)
                : { items: [] },
          ),
        ),
      );

      setItems(responses.flatMap((response) => response.items ?? []));
    } catch {
      // Offline or the API is down — an empty panel with its own message is
      // better than a spinner that never resolves.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  return (
    <Dropdown
      label={`Saved items${wishlist.count ? `, ${wishlist.count} saved` : ""}`}
      icon={<Heart size={18} aria-hidden="true" />}
      badge={wishlist.count}
      className="hidden md:block"
      onOpen={() => void load()}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
            <p className="font-display text-sm font-semibold text-chrome">
              Saved items
            </p>
            {wishlist.count > 0 && (
              <button
                type="button"
                onClick={() => {
                  wishlist.clear();
                  setItems([]);
                }}
                className="text-xs text-ash transition-colors hover:text-chrome"
              >
                Clear
              </button>
            )}
          </div>

          {wishlist.count === 0 ? (
            <p className="px-2 pb-2 text-xs leading-relaxed text-silver">
              Nothing saved yet. Tap the heart on any product to keep it here —
              saved items stay in this browser, on this device.
            </p>
          ) : loading && items === null ? (
            <div className="space-y-1 p-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="skeleton h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton h-2.5 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <ul className="max-h-72 overflow-y-auto">
                {(items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={close}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5"
                    >
                      <SavedThumb src={item.imageUrl} alt={item.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-chrome">
                          {item.name}
                        </span>
                        <span className="tnum block font-mono text-xs text-silver">
                          {formatPKR(effectivePrice(item))}
                          {item.samplePrice && (
                            <span
                              className="ml-1.5 text-[0.5625rem] uppercase tracking-wider text-ash"
                              title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
                            >
                              sample
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        wishlist.remove(item.id);
                        setItems((current) =>
                          (current ?? []).filter((saved) => saved.id !== item.id),
                        );
                      }}
                      aria-label={`Remove ${item.name} from saved items`}
                      className="shrink-0 rounded-lg p-2 text-ash transition-colors hover:bg-white/5 hover:text-rose"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              {wishlist.count > WISHLIST_PREVIEW && (
                <p className="px-2 pt-2 text-xs text-ash">
                  Showing {WISHLIST_PREVIEW} of {wishlist.count} saved items.
                </p>
              )}
            </>
          )}
        </>
      )}
    </Dropdown>
  );
}

function SavedThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = React.useState(false);

  if (!src || failed) {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-carbon text-ash">
        <ImageOff size={14} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-carbon p-1">
      {/* Catalogue art is transparent line work — contained, never cropped. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export default Navbar;
