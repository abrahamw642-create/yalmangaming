import * as React from "react";
import { cn } from "@/lib/utils";

/* ========================================================================== */
/* Exploded-view phases                                                       */
/* ========================================================================== */

export type ExplodePhase = {
  id: string;
  /** Short label for a caption rail or a progress marker. */
  label: string;
  /** One factual line about the part. Nothing here is a claim about a product. */
  caption: string;
  /** Scroll progress window, 0..1, over which this group separates. */
  range: [number, number];
};

/**
 * The order the hero machine comes apart in, and the copy that goes with it.
 *
 * Deliberately defined in this file rather than beside the scene: it is the one
 * module in `components/three` that does not import three.js, so a caller can
 * render the captions — in a Server Component, or in the reduced-motion path
 * where there is no canvas at all — without pulling WebGL into that bundle.
 *
 * Windows overlap on purpose. A part starts moving while the one before it is
 * still travelling, which is what makes the sequence read as a machine coming
 * apart rather than a slideshow of seven separate steps.
 */
export const EXPLODE_PHASES: ExplodePhase[] = [
  {
    id: "shell",
    label: "Chassis",
    caption: "Tempered glass, mesh front and the top panel lift away.",
    range: [0.0, 0.18],
  },
  {
    id: "gpu",
    label: "Graphics card",
    caption: "The card releases from the PCIe x16 slot.",
    range: [0.14, 0.34],
  },
  {
    id: "board",
    label: "Motherboard",
    caption: "The board comes off its standoffs, clear of the tray.",
    range: [0.3, 0.5],
  },
  {
    id: "ram",
    label: "Memory",
    caption: "Modules lift out of their DIMM slots.",
    range: [0.44, 0.6],
  },
  {
    id: "cpu",
    label: "Processor",
    caption: "The retention frame opens and the CPU comes out of the socket.",
    range: [0.54, 0.7],
  },
  {
    id: "cooler",
    label: "Cooling",
    caption: "Cold plate off the CPU, radiator and fans with it.",
    range: [0.66, 0.84],
  },
  {
    id: "power",
    label: "Power & airflow",
    caption: "Power supply, drives and case fans out of the chassis.",
    range: [0.78, 1.0],
  },
];

/** The phase a given progress value sits in, for a live caption. */
export function phaseAt(progress: number): ExplodePhase {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  // Windows overlap, so the *last* one that has started is the one to name.
  let current = EXPLODE_PHASES[0];
  for (const phase of EXPLODE_PHASES) {
    if (p >= phase.range[0]) current = phase;
  }
  return current;
}

/**
 * The static stand-in for every 3D scene.
 *
 * Shown when `useLowPower()` returns `off` — a stated `prefers-reduced-motion`
 * preference, no WebGL, or a device with several low-power signals — and also
 * usable as the `loading` placeholder for the dynamic imports.
 *
 * It is deliberately *drawn*, not a spinner and not an empty box: on a phone
 * that never gets the canvas this is the hero image, so it has to look like a
 * decision rather than a failure. No animation of any kind, which is the whole
 * point of the reduced-motion path.
 *
 * Pure SVG with no three.js imports, so a Server Component can render it
 * directly. Decorative: `aria-hidden`, and nothing here is the only place a
 * piece of information lives.
 */
export function SceneFallback({
  className,
  glow = true,
}: {
  className?: string;
  /** Set false inside dense UI where the ambient glow would fight the layout. */
  glow?: boolean;
}) {
  const uid = React.useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;

  // Cooler fin stack and radiator slats — drawn as repeated hairlines, which is
  // what makes the illustration read as machined rather than blocked-in.
  const fins = Array.from({ length: 13 }, (_, i) => 176 + i * 7.5);
  const frontFans = [214, 300, 386];

  return (
    <div
      className={cn(
        "pointer-events-none relative flex h-full w-full items-center justify-center",
        className,
      )}
      aria-hidden="true"
    >
      {glow && (
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 45%, rgba(34,211,238,0.13), transparent 70%)",
          }}
        />
      )}
      <svg
        viewBox="0 0 460 560"
        className="relative h-full max-h-[560px] w-full max-w-[460px]"
        role="presentation"
        focusable="false"
      >
        <defs>
          <linearGradient id={id("steel")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-iron)" />
            <stop offset="45%" stopColor="var(--color-steel)" />
            <stop offset="100%" stopColor="var(--color-carbon)" />
          </linearGradient>
          <linearGradient id={id("glass")} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="rgba(148,163,200,0.16)" />
            <stop offset="38%" stopColor="rgba(148,163,200,0.05)" />
            <stop offset="100%" stopColor="rgba(4,5,10,0.35)" />
          </linearGradient>
          <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={id("rgb")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-cyan)" />
            <stop offset="52%" stopColor="var(--color-sky)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
          <linearGradient id={id("shadow")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(4,5,10,0.75)" />
            <stop offset="100%" stopColor="rgba(4,5,10,0)" />
          </linearGradient>
          <radialGradient id={id("floor")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="rgba(4,5,10,0.85)" />
            <stop offset="100%" stopColor="rgba(4,5,10,0)" />
          </radialGradient>
          <pattern
            id={id("grid")}
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M26 0H0v26"
              fill="none"
              stroke="rgba(148,163,200,0.055)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Technical backdrop */}
        <rect
          x="18"
          y="18"
          width="424"
          height="470"
          fill={`url(#${id("grid")})`}
        />

        {/* Ground shadow */}
        <ellipse
          cx="230"
          cy="508"
          rx="168"
          ry="26"
          fill={`url(#${id("floor")})`}
        />

        {/* ---- Chassis ------------------------------------------------- */}
        <rect
          x="86"
          y="42"
          width="288"
          height="456"
          rx="16"
          fill={`url(#${id("steel")})`}
          stroke="var(--color-line-strong)"
          strokeWidth="1.5"
        />
        <rect
          x="86"
          y="42"
          width="288"
          height="456"
          rx="16"
          fill={`url(#${id("sheen")})`}
        />

        {/* Feet */}
        <rect x="106" y="498" width="46" height="9" rx="4" fill="#07080d" />
        <rect x="308" y="498" width="46" height="9" rx="4" fill="#07080d" />

        {/* Top vent slots */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={168 + i * 22}
            y="52"
            width="12"
            height="4"
            rx="2"
            fill="rgba(4,5,10,0.8)"
          />
        ))}
        {/* Power button */}
        <circle cx="124" cy="56" r="5" fill="#0a0c12" />
        <circle
          cx="124"
          cy="56"
          r="3"
          fill="var(--color-cyan)"
          opacity="0.85"
        />

        {/* Front intake column with the RGB light bar */}
        <rect
          x="98"
          y="72"
          width="26"
          height="404"
          rx="9"
          fill="var(--color-void)"
          opacity="0.75"
        />
        <rect
          x="107"
          y="86"
          width="8"
          height="376"
          rx="4"
          fill={`url(#${id("rgb")})`}
          opacity="0.9"
        />

        {/* ---- Tempered glass side panel -------------------------------- */}
        <rect
          x="134"
          y="62"
          width="222"
          height="416"
          rx="9"
          fill="var(--color-void)"
        />

        {/* ---- Interior -------------------------------------------------- */}
        {/* Motherboard */}
        <rect
          x="252"
          y="80"
          width="98"
          height="286"
          rx="4"
          fill="#0a1017"
          stroke="rgba(148,163,200,0.12)"
        />
        <rect x="262" y="92" width="30" height="26" rx="3" fill="#39404f" />
        <rect x="300" y="88" width="44" height="10" rx="2" fill="#2a3140" />
        {/* Memory */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x={264 + i * 11}
              y="126"
              width="7"
              height="74"
              rx="2"
              fill="#161b24"
            />
            <rect
              x={264 + i * 11}
              y="126"
              width="7"
              height="10"
              rx="2"
              fill={i < 2 ? "var(--color-cyan)" : "var(--color-violet)"}
              opacity={0.85}
            />
          </g>
        ))}
        {/* Chipset + M.2 heatshields */}
        <rect x="258" y="286" width="76" height="12" rx="3" fill="#2f3646" />
        <rect x="258" y="308" width="76" height="12" rx="3" fill="#2f3646" />
        <rect x="262" y="336" width="82" height="20" rx="3" fill="#20263200" />

        {/* CPU tower cooler — fin stack drawn as hairlines */}
        <rect x="168" y="118" width="86" height="104" rx="5" fill="#242b38" />
        {fins.map((x) => (
          <line
            key={x}
            x1={x}
            y1="122"
            x2={x}
            y2="218"
            stroke="rgba(206,213,227,0.42)"
            strokeWidth="1.4"
          />
        ))}
        <rect x="164" y="112" width="94" height="8" rx="3" fill="#4a5261" />
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={182 + i * 22}
            cy="228"
            r="4.5"
            fill="var(--color-ember)"
            opacity="0.55"
          />
        ))}

        {/* Graphics card */}
        <rect
          x="152"
          y="238"
          width="198"
          height="46"
          rx="6"
          fill="#171c26"
          stroke="rgba(148,163,200,0.14)"
        />
        <rect
          x="152"
          y="238"
          width="198"
          height="6"
          rx="3"
          fill={`url(#${id("rgb")})`}
          opacity="0.75"
        />
        {[196, 262].map((cx) => (
          <g key={cx}>
            <circle
              cx={cx}
              cy="264"
              r="17"
              fill="#0d1018"
              stroke="rgba(148,163,200,0.2)"
            />
            {[0, 1, 2, 3, 4, 5, 6].map((b) => (
              <path
                key={b}
                d={`M${cx} 264 L${cx + 15 * Math.cos((b / 7) * Math.PI * 2)} ${
                  264 + 15 * Math.sin((b / 7) * Math.PI * 2)
                }`}
                stroke="rgba(148,163,200,0.28)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            ))}
            <circle cx={cx} cy="264" r="5" fill="#2b3242" />
          </g>
        ))}

        {/* PSU shroud + storage */}
        <rect x="146" y="392" width="204" height="72" rx="6" fill="#10141c" />
        <rect
          x="146"
          y="392"
          width="204"
          height="3"
          rx="1.5"
          fill="rgba(148,163,200,0.16)"
        />
        <rect x="266" y="368" width="70" height="18" rx="3" fill="#1a1f2d" />
        <rect
          x="272"
          y="374"
          width="30"
          height="3"
          rx="1.5"
          fill="rgba(148,163,200,0.3)"
        />

        {/* Front intake fans */}
        {frontFans.map((cy) => (
          <g key={cy}>
            <circle
              cx="160"
              cy={cy}
              r="26"
              fill="none"
              stroke="rgba(148,163,200,0.1)"
              strokeWidth="1.5"
            />
            <circle
              cx="160"
              cy={cy}
              r="22"
              fill="none"
              stroke={`url(#${id("rgb")})`}
              strokeWidth="2.5"
              opacity="0.5"
            />
            <circle cx="160" cy={cy} r="7" fill="#1a1f2d" />
          </g>
        ))}

        {/* Glass tint and reflection last, so it sits over the interior */}
        <rect
          x="134"
          y="62"
          width="222"
          height="416"
          rx="9"
          fill={`url(#${id("glass")})`}
          stroke="rgba(148,163,200,0.22)"
          strokeWidth="1.5"
        />
        <path
          d="M148 470 L300 66 L344 66 L192 470 Z"
          fill="rgba(255,255,255,0.035)"
        />

        {/* Base shadow under the tower */}
        <rect
          x="86"
          y="470"
          width="288"
          height="28"
          fill={`url(#${id("shadow")})`}
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

export default SceneFallback;
