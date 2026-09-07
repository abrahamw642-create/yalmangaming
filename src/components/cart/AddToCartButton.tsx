"use client";

/**
 * Add-to-cart triggers for the two things Yalman Gaming sells: a catalog
 * product, and a whole configured machine.
 *
 * Both give the same confirmation beat — the label flips to "Added" for a
 * moment while the drawer slides in — so the action never feels like it did
 * nothing on a slow connection.
 */

import * as React from "react";
import { Check, Plus, ShoppingCart } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CartProductInput } from "@/lib/cart";
import { KIND_META } from "@/lib/types";
import type { BuildState, CompatibilityReport } from "@/lib/types";
import { useCart } from "./CartProvider";

const CONFIRMATION_MS = 1_600;

/** Keeps a short-lived "done" flag without leaking a timer after unmount. */
function useConfirmation(): [boolean, () => void] {
  const [done, setDone] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const trigger = React.useCallback(() => {
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), CONFIRMATION_MS);
  }, []);

  return [done, trigger];
}

export function AddToCartButton({
  product,
  quantity = 1,
  variant = "secondary",
  size = "md",
  className,
  label = "ADD TO CART",
  iconOnly = false,
}: {
  product: CartProductInput;
  quantity?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  label?: string;
  /** Compact form for dense product grids. */
  iconOnly?: boolean;
}) {
  const { addProduct } = useCart();
  const [added, confirm] = useConfirmation();

  const stock = product.stock ?? 0;
  const soldOut = stock <= 0;

  return (
    <Button
      variant={added ? "success" : variant}
      size={iconOnly ? "icon" : size}
      className={className}
      disabled={soldOut}
      onClick={() => {
        addProduct(product, quantity);
        confirm();
      }}
      aria-label={
        soldOut
          ? `${product.name} is out of stock`
          : `Add ${product.name} to your cart`
      }
      // Announce the outcome for screen readers without moving focus.
      aria-live="polite"
    >
      {soldOut ? (
        <>
          {!iconOnly && "OUT OF STOCK"}
          {iconOnly && <ShoppingCart size={16} aria-hidden="true" />}
        </>
      ) : added ? (
        <>
          <Check size={16} aria-hidden="true" />
          {!iconOnly && "ADDED"}
        </>
      ) : (
        <>
          {iconOnly ? (
            <Plus size={16} aria-hidden="true" />
          ) : (
            <ShoppingCart size={16} aria-hidden="true" />
          )}
          {!iconOnly && label}
        </>
      )}
    </Button>
  );
}

/**
 * Adds an entire build. Blocked while the compatibility engine reports a hard
 * error — the same rule the server enforces, surfaced here so the customer
 * finds out in the builder rather than at checkout.
 */
export function AddBuildToCartButton({
  build,
  report,
  variant = "primary",
  size = "lg",
  className,
  label = "ADD BUILD TO CART",
}: {
  build: BuildState;
  report: CompatibilityReport;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  label?: string;
}) {
  const { addBuild } = useCart();
  const [added, confirm] = useConfirmation();

  const blocked = report.status === "error";
  const empty = Object.values(build.selection).flat().length === 0;
  const missing = report.missing.length > 0;

  const reason = empty
    ? "Add some parts to your build first"
    : blocked
      ? "Fix the compatibility errors before adding this build"
      : missing
        ? `Still to choose: ${report.missing.map((kind) => KIND_META[kind].label).join(", ")}`
        : null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        variant={added ? "success" : variant}
        size={size}
        disabled={blocked || empty}
        onClick={() => {
          addBuild(build, report);
          confirm();
        }}
        aria-describedby={reason ? "add-build-reason" : undefined}
        aria-live="polite"
      >
        {added ? (
          <>
            <Check size={18} aria-hidden="true" />
            ADDED TO CART
          </>
        ) : (
          <>
            <ShoppingCart size={18} aria-hidden="true" />
            {label}
          </>
        )}
      </Button>
      {reason && (
        <p
          id="add-build-reason"
          className={cn("text-xs", blocked || empty ? "text-rose" : "text-ash")}
        >
          {reason}
        </p>
      )}
    </div>
  );
}

export default AddToCartButton;
