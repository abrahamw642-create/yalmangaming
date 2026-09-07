import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { ComparisonTable } from "@/components/shop/ComparisonTable";
import { SamplePricingNote } from "@/components/ui";
import { MAX_COMPARE } from "@/lib/filters";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Compare Products",
  description:
    "Put up to four components side by side and see exactly where their specifications differ.",
  alternates: { canonical: `${siteConfig.url}/compare` },
  // The comparison is per-visitor state held in the browser; there is nothing
  // stable here for a crawler to index.
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Compare" },
        ]}
      />

      <header className="mt-4 flex flex-col gap-3">
        <p className="eyebrow">Side by side</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          Compare Products
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-silver">
          Up to {MAX_COMPARE} products at a time, drawn from the specifications
          recorded for each one. Rows where they differ are highlighted.
        </p>
      </header>

      <div className="mt-8">
        <SamplePricingNote className="mb-6 max-w-2xl" />
        <ComparisonTable />
      </div>
    </div>
  );
}
