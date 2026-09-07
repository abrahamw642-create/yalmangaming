"use client";

/**
 * The floating WhatsApp button.
 *
 * WhatsApp is how this shop actually talks to customers, so the button does
 * more than open an empty chat: each option pre-fills a message with what the
 * visitor is looking at — the page they are on, the cart they have filled, or
 * the machine they configured in the builder.
 *
 * ## Staying out of the way
 *
 * Two other things live at the bottom of the viewport and would otherwise sit
 * under this button:
 *
 *  - `@/components/builder/MobileSummaryBar` — a full-width sticky bar on the
 *    builder, `z-40`, hidden from `xl` where the summary moves into a column.
 *  - `@/components/shop/CompareProvider`'s `CompareBar` — the comparison tray,
 *    also `z-40`, shown whenever something is selected to compare.
 *
 * The float therefore sits at `z-30` (under both, never over a total or a
 * primary action) and lifts itself above whichever of the two is on screen.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { useCompare } from "@/components/shop/CompareProvider";
import { BUILD_STORAGE_KEY } from "@/lib/build-store";
import { buildText, sanitizeBuildState, shareUrlFor } from "@/lib/build-serialize";
import type { CartLine } from "@/lib/cart";
import { checkCompatibility } from "@/lib/compatibility";
import { whatsappLink } from "@/lib/site";
import type { BuildState } from "@/lib/types";
import { cn, formatPKR } from "@/lib/utils";

/** wa.me carries the message in the URL; keep it well inside what clients accept. */
const MAX_MESSAGE = 1_400;

type Option = {
  id: string;
  label: string;
  detail: string;
  message: string;
};

export function WhatsAppFloat() {
  const pathname = usePathname();
  const cart = useCart();
  const compare = useCompare();

  const [open, setOpen] = React.useState(false);
  const [pageUrl, setPageUrl] = React.useState("");
  const [build, setBuild] = React.useState<BuildState | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

  /* The current URL and the saved build are both browser-only facts, so they
     are read in an effect rather than during render — the server has neither. */
  React.useEffect(() => {
    setPageUrl(window.location.href);
    setBuild(readSavedBuild());
  }, [pathname]);

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;

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
  }, [open]);

  const options = React.useMemo(
    () => buildOptions({ pageUrl, cartItems: cart.items, cartTotal: cart.totals.total, build }),
    [pageUrl, cart.items, cart.totals.total, build],
  );

  /* --- Clearance ---------------------------------------------------------- */
  const onBuilder = pathname === "/builder" || pathname.startsWith("/builder/");
  const compareOpen = compare.count > 0;

  const bottomClass = onBuilder
    ? // The builder's summary bar owns the bottom edge below `xl`.
      "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] xl:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
    : compareOpen
      ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]"
      : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]";

  return (
    <div
      ref={containerRef}
      className={cn(
        "no-print fixed right-4 z-30 flex flex-col items-end gap-3 md:right-6",
        "transition-[bottom] duration-300",
        bottomClass,
      )}
    >
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Message Yalman Gaming on WhatsApp"
          className="glass-strong w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-3 shadow-lift"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="font-display text-sm font-semibold text-chrome">
              Chat with Yalman Gaming
            </p>
            <p className="mt-1 text-xs leading-relaxed text-silver">
              Pick what you need and we will open WhatsApp with the message
              already written.
            </p>
          </div>

          <ul className="flex flex-col gap-0.5">
            {options.map((option) => (
              <li key={option.id}>
                <a
                  href={whatsappLink(option.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/5"
                >
                  <span className="block text-sm font-medium text-chrome">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ash">
                    {option.detail}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close WhatsApp options" : "Message us on WhatsApp"}
        className={cn(
          "relative grid h-14 w-14 place-items-center rounded-full",
          "bg-[#25D366] text-[#04250f] shadow-[0_10px_30px_-8px_rgba(37,211,102,0.7)]",
          "transition-transform duration-200 hover:scale-105 active:scale-95",
        )}
      >
        {/* A single slow ring, not a permanent pulse: enough to be noticed once,
            not enough to be the brightest moving thing on every page. */}
        {!open && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-pulse-ring"
          />
        )}
        {open ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <MessageCircle size={24} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

function clip(text: string): string {
  return text.length <= MAX_MESSAGE
    ? text
    : `${text.slice(0, MAX_MESSAGE - 1).trimEnd()}…`;
}

function buildOptions({
  pageUrl,
  cartItems,
  cartTotal,
  build,
}: {
  pageUrl: string;
  cartItems: CartLine[];
  cartTotal: number;
  build: BuildState | null;
}): Option[] {
  const here = pageUrl ? `\n\n${pageUrl}` : "";

  const options: Option[] = [
    {
      id: "product",
      label: "Ask about a product",
      detail: "Specs, alternatives, or what suits your games.",
      message: clip(
        `Hi Yalman Gaming — I have a question about a product on your website.${here}`,
      ),
    },
    {
      id: "availability",
      label: "Check availability",
      detail: "Find out whether it is in the shop right now.",
      message: clip(
        `Hi Yalman Gaming — is this in stock at the moment?${here}`,
      ),
    },
    {
      id: "price",
      label: "Confirm a price",
      detail: "Website figures marked “sample” are placeholders.",
      message: clip(
        `Hi Yalman Gaming — could you confirm the current price for this? The figure on the website is marked as sample pricing.${here}`,
      ),
    },
  ];

  if (cartItems.length > 0) {
    const lines = cartItems
      .map(
        (line) =>
          `• ${line.name}${line.quantity > 1 ? ` ×${line.quantity}` : ""} — ${formatPKR(
            line.unitPrice * line.quantity,
          )}`,
      )
      .join("\n");

    const sample = cartItems.some((line) => line.samplePrice)
      ? "\n(Prices taken from the website's sample figures — please confirm.)"
      : "";

    options.splice(1, 0, {
      id: "cart",
      label: "Share my cart",
      detail: `${cartItems.length} item${cartItems.length === 1 ? "" : "s"} · ${formatPKR(cartTotal)}`,
      message: clip(
        `Hi Yalman Gaming — here is what I have in my cart:\n\n${lines}\n\nTotal (incl. delivery estimate): ${formatPKR(
          cartTotal,
        )}${sample}`,
      ),
    });
  }

  if (build && Object.values(build.selection).flat().length > 0) {
    const report = checkCompatibility(build.selection);
    options.splice(cartItems.length > 0 ? 2 : 1, 0, {
      id: "build",
      label: "Share my build",
      detail: build.name.trim() || "Your saved configuration",
      message: buildText(build, report, {
        shareUrl: build.shareCode ? shareUrlFor(build.shareCode) : null,
        maxLength: MAX_MESSAGE,
      }),
    });
  }

  return options;
}

/**
 * Reads whatever the builder last persisted. Anything unrecognisable comes back
 * as `null` rather than throwing — this is a convenience button, and a corrupt
 * saved build must not take the chrome down with it.
 */
function readSavedBuild(): BuildState | null {
  try {
    const raw = window.localStorage.getItem(BUILD_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeBuildState(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export default WhatsAppFloat;
