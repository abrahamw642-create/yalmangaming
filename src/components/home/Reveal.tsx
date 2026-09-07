"use client";

/**
 * Scroll-reveal wrapper for the home page sections.
 *
 * Deliberately tiny: one `whileInView` transition, fired once, with the motion
 * removed entirely — not merely shortened — when the visitor has asked for
 * reduced motion. In that case the children are handed straight through with no
 * wrapper transform and no observer at all, so there is nothing to animate and
 * nothing to fail.
 *
 * Used for section-level blocks (headings, grids, panels) rather than for
 * individual words or cards: the brief for this page is premium and restrained,
 * and a page where every element flies in reads as a template.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type RevealProps = {
  children: React.ReactNode;
  /** Seconds of delay, for staggering two or three siblings. Keep it small. */
  delay?: number;
  /** Travel distance in px. 0 gives a pure cross-fade. */
  y?: number;
  className?: string;
  /** Fraction of the element that must be visible before it fires. */
  amount?: number;
};

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  amount = 0.15,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // `once` matters here: re-triggering on the way back up turns a long
      // storefront page into a flicker gallery.
      viewport={{ once: true, amount, margin: "0px 0px -60px 0px" }}
      transition={{
        duration: 0.55,
        delay,
        // Decelerating curve — arrives, settles, and does not overshoot.
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
