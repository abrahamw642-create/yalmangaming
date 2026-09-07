/**
 * Section 1 — the hero.
 *
 * This file is deliberately thin, and the split is the point:
 *
 *   `HeroCopy`      — a Server Component holding the H1, the sub-line, both
 *                     calls to action and the store's rating. Server-rendered
 *                     HTML, so the page's most important words never wait on a
 *                     WebGL bundle and a crawler sees them without running JS.
 *   `ScrollExplode` — the client shell that pins a viewport-height stage,
 *                     mounts `HeroScene` through `dynamic(..., { ssr: false })`
 *                     with `SceneFallback` as its loading state, and drives the
 *                     scene's `scrollProgress` from the scroll position.
 *
 * `Hero` is where the two meet: the copy is passed in as `children`, so it is
 * rendered on the server and handed to the client shell as finished markup
 * rather than being re-implemented inside it.
 *
 * The stage owns its own height (`min-h-[100svh]`, and `h-[100svh]` once
 * pinned), which is what the canvas needs — the scene fills 100% of its parent
 * and would collapse to nothing in an auto-height box.
 */

import { HeroCopy } from "./HeroCopy";
import { ScrollExplode } from "./ScrollExplode";

export function Hero() {
  return (
    <ScrollExplode>
      <HeroCopy />
    </ScrollExplode>
  );
}

export default Hero;
