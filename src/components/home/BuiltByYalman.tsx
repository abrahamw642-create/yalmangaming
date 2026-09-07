/**
 * Section 7 — Built by Yalman.
 *
 * Machines from the `ShowcaseBuild` table: real configurations the shop has
 * put together, each carrying a JSON snapshot of its component list so the
 * card can name the parts without joining back through the catalogue.
 *
 * Two things worth flagging:
 *
 * 1. The component JSON is parsed defensively. It is a text column, so a hand
 *    edit from the admin can put anything in it; a malformed row loses its
 *    parts list and keeps its card rather than taking the section down.
 * 2. `price` is sample data (`samplePrice`), so it goes through `<Price>` with
 *    the flag set and picks up the "sample" marker. No warranty language and no
 *    build times: neither has been confirmed by the store.
 */

import Link from "next/link";
import { ArrowRight, Cpu } from "lucide-react";
import { Badge, ButtonLink, Price, SectionHeading } from "@/components/ui";
import { parseJson } from "@/lib/specs";
import { KIND_META, isComponentKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/** The row shape the page selects. Kept flat so this file never sees Prisma. */
export type ShowcaseCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: string | null;
  target: string | null;
  price: number | null;
  samplePrice: boolean;
  /** JSON text: `[{ "kind": "cpu", "name": "..." }]`. */
  components: string | null;
  accent: string | null;
  imageUrl: string | null;
};

type ShowcasePart = { kind: string; name: string };

/** Which parts a card names, and in what order. The rest stay on /showcase. */
const HEADLINE_KINDS = ["cpu", "gpu", "ram", "storage"] as const;

const ACCENT_EDGE: Record<string, string> = {
  cyan: "hover:border-cyan/40",
  violet: "hover:border-violet/40",
  ember: "hover:border-ember/40",
  emerald: "hover:border-emerald/40",
  rose: "hover:border-rose/40",
  lime: "hover:border-lime/40",
  sky: "hover:border-sky/40",
};

const TIER_TONE: Record<string, "emerald" | "cyan" | "violet" | "ember"> = {
  Entry: "emerald",
  "Mid-Range": "cyan",
  "High-End": "violet",
  Extreme: "ember",
};

/**
 * Reads the component snapshot, discarding anything that is not a
 * `{ kind, name }` pair — the column is free-form text as far as the database
 * is concerned.
 */
function parseParts(json: string | null): ShowcasePart[] {
  const raw = parseJson<unknown>(json, []);
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const kind = record.kind;
    const name = record.name;
    if (typeof kind !== "string" || typeof name !== "string") return [];
    if (!kind || !name) return [];
    return [{ kind, name }];
  });
}

export function BuiltByYalman({ builds }: { builds: ShowcaseCardData[] }) {
  if (!builds.length) return null;

  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      className="relative py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="From the bench"
            title={<span id="showcase-heading">Built by Yalman</span>}
            description="Configurations we assemble regularly, with the parts that go into them. Any of them can be changed part by part."
            action={
              <ButtonLink href="/showcase" variant="outline" size="md">
                SEE EVERY BUILD
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {builds.map((build) => (
              <li key={build.id}>
                <ShowcaseCard build={build} />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function ShowcaseCard({ build }: { build: ShowcaseCardData }) {
  const parts = parseParts(build.components);

  // Named in a fixed order so three cards read as a comparison rather than
  // three different lists.
  const headline = HEADLINE_KINDS.flatMap((kind) => {
    const part = parts.find((p) => p.kind === kind);
    return part ? [part] : [];
  });

  const edge = (build.accent && ACCENT_EDGE[build.accent]) || ACCENT_EDGE.cyan;
  const tone = (build.tier && TIER_TONE[build.tier]) || "neutral";

  return (
    <article
      className={cn(
        "metal group flex h-full flex-col overflow-hidden rounded-2xl",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        edge,
      )}
    >
      {/* Line-art illustration on a transparent ground — contained with
          padding, never cropped like a photograph. */}
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-[var(--color-line)] bg-gradient-to-b from-white/[0.03] to-transparent p-6">
        {build.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={build.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Cpu className="h-12 w-12 text-iron" strokeWidth={1.5} aria-hidden="true" />
        )}

        {build.tier && (
          <span className="absolute left-4 top-4">
            <Badge tone={tone}>{build.tier}</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-bold uppercase tracking-tight text-chrome">
          <Link
            href={`/showcase#${build.slug}`}
            className="transition-colors hover:text-white"
          >
            {build.name}
          </Link>
        </h3>

        {build.tagline && (
          <p className="mt-1.5 text-sm leading-relaxed text-silver">
            {build.tagline}
          </p>
        )}

        {build.target && (
          <p className="tnum mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-cyan">
            {build.target}
          </p>
        )}

        {headline.length > 0 && (
          <dl className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-4">
            {headline.map((part) => (
              <div key={part.kind} className="flex gap-3 text-xs leading-relaxed">
                <dt className="w-20 shrink-0 font-mono uppercase tracking-wider text-ash">
                  {isComponentKind(part.kind)
                    ? KIND_META[part.kind].label
                    : part.kind}
                </dt>
                <dd className="min-w-0 flex-1 text-silver">{part.name}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-auto pt-6">
          {build.price !== null && (
            <Price
              price={build.price}
              samplePrice={build.samplePrice}
              size="lg"
            />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink
              href={`/showcase#${build.slug}`}
              variant="secondary"
              size="sm"
            >
              FULL SPEC
            </ButtonLink>
            <ButtonLink href="/builder" variant="ghost" size="sm">
              BUILD SOMETHING LIKE IT
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}

export default BuiltByYalman;
