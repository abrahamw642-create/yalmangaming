import type { Metadata } from "next";
import { getPartsForKind } from "@/lib/catalog";
import { BUILDER_STEP_KINDS, type BuilderPart, type ComponentKind } from "@/lib/types";
import { siteConfig } from "@/lib/site";
import type { BuilderCatalog } from "@/components/builder/BuilderShell";
import BuilderClient from "./BuilderClient";

export const metadata: Metadata = {
  title: "Custom PC Builder",
  description:
    "Configure a custom gaming PC part by part with live compatibility checking, a running wattage estimate and PKR pricing. Built and tested by Yalman Gaming, Hafeez Centre, Lahore.",
  alternates: { canonical: "/builder" },
  openGraph: {
    title: `Custom PC Builder | ${siteConfig.name}`,
    description:
      "Pick every part. We check sockets, clearances, memory and wattage as you go, then build and test the machine at Hafeez Centre, Lahore.",
    url: `${siteConfig.url}/builder`,
    type: "website",
  },
};

// Stock, pricing and the `?load=` share code are all per-request; nothing on
// this page should be captured into a static build.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Loads the catalogue for one builder step.
 *
 * A kind that fails to load (empty table, migration pending) must not take the
 * whole builder down — that step simply shows its empty state and every other
 * step still works.
 */
async function partsFor(kind: ComponentKind): Promise<BuilderPart[]> {
  try {
    return await getPartsForKind(kind);
  } catch (error) {
    console.error(`[builder] could not load parts for "${kind}"`, error);
    return [];
  }
}

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // One query per builder step, in parallel. The client needs every kind up
  // front so compatibility ranking is instant when a customer jumps around.
  const lists = await Promise.all(BUILDER_STEP_KINDS.map(partsFor));

  const catalog: BuilderCatalog = {};
  BUILDER_STEP_KINDS.forEach((kind, i) => {
    catalog[kind] = lists[i];
  });

  return (
    <BuilderClient
      catalog={catalog}
      loadShareCode={firstValue(params.load)}
      step={firstValue(params.step)}
    />
  );
}
