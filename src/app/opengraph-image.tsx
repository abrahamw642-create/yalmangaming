/**
 * The site's default Open Graph / Twitter card, 1200×630.
 *
 * Next's file convention: sitting at the root of `src/app`, this is the card
 * every route inherits unless it sets its own `openGraph.images`.
 *
 * Rendered by Satori, which supports a subset of CSS and has two rules that
 * shape everything below:
 *
 *  1. **Any element with more than one child needs `display: flex`.** That
 *     includes text: `<div>{a}, {b}</div>` is three child nodes, not one
 *     string, and it throws. Every interpolated line here is built as a single
 *     template literal for that reason — it is the failure mode worth knowing
 *     about, because the route just returns an empty response rather than an
 *     error you can read.
 *  2. **There is no CSS grid.** The faint grid in the background is a handful of
 *     positioned hairlines instead, which at this size looks the same as the
 *     site's `grid-bg` utility anyway.
 *
 * No custom font is loaded on purpose. A webfont means a fetch (or a bundled
 * binary) on a route that must never fail, and the default face is close enough
 * at this size. A card that always renders beats a card that renders perfectly.
 */

import { ImageResponse } from "next/og";
import { contact, siteConfig, storeAddress } from "@/lib/site";

export const alt = `${siteConfig.name} — gaming PCs and custom builds in Lahore`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Tokens copied from `globals.css` — Satori cannot read CSS variables. */
const VOID = "#04050a";
const CHROME = "#edf1fa";
const SILVER = "#a6b0c6";
const ASH = "#8e99b1";
const CYAN = "#22d3ee";
const LINE = "rgba(148,163,200,0.10)";

/** Vertical hairline positions across the 1200px canvas. */
const COLUMNS = [150, 300, 450, 600, 750, 900, 1050];
/** Horizontal hairline positions across the 630px canvas. */
const ROWS = [105, 210, 315, 420, 525];

const ADDRESS_LINE = `${storeAddress.floor}, ${storeAddress.building}, ${storeAddress.block}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: VOID,
          position: "relative",
          padding: "72px 80px",
        }}
      >
        {/* --- Background: grid hairlines ----------------------------------- */}
        {COLUMNS.map((x) => (
          <div
            key={`c${x}`}
            style={{
              position: "absolute",
              top: 0,
              left: x,
              width: 1,
              height: 630,
              backgroundColor: LINE,
            }}
          />
        ))}
        {ROWS.map((y) => (
          <div
            key={`r${y}`}
            style={{
              position: "absolute",
              left: 0,
              top: y,
              width: 1200,
              height: 1,
              backgroundColor: LINE,
            }}
          />
        ))}

        {/* --- Background: the two accent glows ------------------------------ */}
        <div
          style={{
            position: "absolute",
            top: -260,
            left: -140,
            width: 900,
            height: 700,
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.26), rgba(34,211,238,0) 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            right: -180,
            width: 860,
            height: 720,
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(168,85,247,0.22), rgba(168,85,247,0) 68%)",
          }}
        />

        {/* --- Top: eyebrow --------------------------------------------------- */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 44, height: 3, backgroundColor: CYAN }} />
          <div
            style={{
              marginLeft: 18,
              fontSize: 22,
              letterSpacing: 6,
              color: CYAN,
            }}
          >
            HAFEEZ CENTRE · LAHORE
          </div>
        </div>

        {/* --- Middle: the wordmark and the line ------------------------------ */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.02,
              color: CHROME,
            }}
          >
            YALMAN GAMING
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              maxWidth: 900,
              fontSize: 33,
              lineHeight: 1.35,
              color: SILVER,
            }}
          >
            Gaming PCs, premium components and custom builds — configured with
            live compatibility and wattage checks.
          </div>
        </div>

        {/* --- Bottom: the facts ---------------------------------------------- */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, color: ASH }}>{ADDRESS_LINE}</div>
            <div style={{ marginTop: 10, fontSize: 30, color: CHROME }}>
              {contact.phoneDisplay}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: `1px solid ${CYAN}`,
              borderRadius: 14,
              padding: "14px 26px",
              fontSize: 26,
              letterSpacing: 2,
              color: CYAN,
            }}
          >
            BUILD YOUR PC
          </div>
        </div>
      </div>
    ),
    size,
  );
}
