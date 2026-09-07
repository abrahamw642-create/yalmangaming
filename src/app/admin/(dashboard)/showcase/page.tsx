import type { Metadata } from "next";

import { ShowcaseManager } from "@/components/admin/ShowcaseManager";
import { Note, PageHeader } from "@/components/admin/ui";
import { listShowcaseBuilds, parseShowcaseComponents } from "@/lib/admin-queries";
import { SamplePricingNote } from "@/components/ui";

export const metadata: Metadata = { title: "Showcase builds" };
export const dynamic = "force-dynamic";

export default async function AdminShowcasePage() {
  const rows = await listShowcaseBuilds();

  // The component list is JSON text in the database; parse it here so the
  // client editor receives plain rows and never has to know that.
  const builds = rows.map((build) => ({
    id: build.id,
    slug: build.slug,
    name: build.name,
    tagline: build.tagline,
    description: build.description,
    tier: build.tier,
    target: build.target,
    price: build.price,
    samplePrice: build.samplePrice,
    imageUrl: build.imageUrl,
    accent: build.accent,
    featured: build.featured,
    sortOrder: build.sortOrder,
    componentRows: parseShowcaseComponents(build.components),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Built by Yalman"
        title="Showcase builds"
        description="Machines the shop has actually assembled, shown on the storefront as proof of work rather than as products to configure."
      />

      <Note tone="info">
        Only list machines Yalman Gaming really built. Nothing here should describe a
        PC that does not exist, and no performance claim should be made that the
        bench has not measured.
      </Note>

      <ShowcaseManager builds={builds} />

      <SamplePricingNote />
    </div>
  );
}
