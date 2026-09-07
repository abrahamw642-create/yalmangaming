"use client";

/**
 * The header cart trigger.
 *
 * Opens the drawer rather than navigating, so browsing is never interrupted.
 * The count badge only appears once the persisted cart has hydrated — showing
 * a "0" that flicks to "3" a moment later reads as a bug.
 */

import * as React from "react";
import { ShoppingCart } from "lucide-react";
import { cn, pluralize } from "@/lib/utils";
import { useCart } from "./CartProvider";

export function CartButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { count, hydrated, setOpen } = useCart();
  const badge = hydrated && count > 0;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={
        badge
          ? `Open cart, ${count} ${pluralize(count, "item")}`
          : "Open cart, empty"
      }
      className={cn(
        "relative inline-flex items-center gap-2 rounded-xl border border-line-strong",
        "bg-white/[0.03] px-3 py-2 text-sm font-medium text-chrome transition-all duration-200",
        "hover:border-cyan/50 hover:bg-cyan/5 hover:shadow-glow-xs",
        className,
      )}
    >
      <ShoppingCart size={18} aria-hidden="true" />
      {showLabel && <span className="hidden sm:inline">Cart</span>}

      {badge && (
        <span
          className={cn(
            "tnum absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center",
            "rounded-full bg-gradient-to-b from-cyan to-sky px-1 font-mono text-[0.625rem]",
            "font-bold text-void shadow-glow-xs",
          )}
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

export default CartButton;
