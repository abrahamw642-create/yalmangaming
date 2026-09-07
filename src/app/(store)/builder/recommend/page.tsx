import type { Metadata } from "next";
import { Cpu, ShieldCheck, Wallet } from "lucide-react";

import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { ButtonLink } from "@/components/ui";
import { RecommendWizard } from "@/components/recommend/RecommendWizard";
import { siteConfig, whatsappLink } from "@/lib/site";

const PATH = "/builder/recommend";

export const metadata: Metadata = {
  title: "Build Recommendations",
  description:
    "Tell us your budget, the resolution you play at and the frame rate you want. We spec a complete, compatibility-checked gaming PC from what Yalman Gaming actually stocks, with a live PKR total and a reason for every part.",
  alternates: { canonical: `${siteConfig.url}${PATH}` },
  openGraph: {
    title: `Build Recommendations | ${siteConfig.name}`,
    description:
      "A budget and a resolution in, a complete compatible machine out — priced in PKR, with every part explained.",
    url: `${siteConfig.url}${PATH}`,
    type: "website",
  },
};

// The recommendation is computed from live stock and pricing on every request,
// so nothing on this page may be captured into a static build.
export const dynamic = "force-dynamic";

const PROMISES: { icon: typeof Cpu; title: string; detail: string }[] = [
  {
    icon: Wallet,
    title: "Your budget, split by what you play",
    detail:
      "A 4K build spends on the graphics card; a 240 FPS build spends on the processor. We split the money the way your answers call for, then show you the split.",
  },
  {
    icon: ShieldCheck,
    title: "Checked by the same engine as the builder",
    detail:
      "Sockets, memory generation, card length, cooler clearance, radiator mounts, wattage and PCIe cabling. If something conflicts, we substitute until it does not — and if we cannot, we say so.",
  },
  {
    icon: Cpu,
    title: "Only parts we actually stock",
    detail:
      "Every part comes out of the catalogue with its current price and stock level attached. Nothing here is a placeholder machine.",
  },
];

export default function RecommendPage() {
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Custom PC Builder", href: "/builder" },
          { label: "Build Recommendations" },
        ]}
      />

      <header className="mt-4 flex flex-col gap-4">
        <p className="eyebrow">Guided build</p>
        <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-chrome-gradient sm:text-4xl md:text-5xl">
          Tell us the budget. We&rsquo;ll spec the machine.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-silver">
          Five questions, then a complete build: every part chosen from what we
          have on the shelf, checked against the same compatibility engine the
          custom builder runs, and priced in rupees with the reasoning shown.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/builder" variant="outline" size="md">
            I&rsquo;d rather pick every part myself
          </ButtonLink>
          <ButtonLink
            href={whatsappLink(
              "Hi Yalman Gaming — I would like help specifying a PC.",
            )}
            variant="ghost"
            size="md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Talk to us instead
          </ButtonLink>
        </div>
      </header>

      <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        {PROMISES.map((promise) => (
          <li key={promise.title} className="metal rounded-2xl p-4">
            <promise.icon className="h-4 w-4 text-cyan" aria-hidden="true" />
            <p className="mt-3 font-display text-sm font-semibold text-chrome">
              {promise.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-silver">
              {promise.detail}
            </p>
          </li>
        ))}
      </ul>

      <div className="rule-fade my-10" />

      {/* The page stays a Server Component; the wizard is the only client
          boundary, and it owns every piece of state in this flow. */}
      <RecommendWizard />
    </div>
  );
}
