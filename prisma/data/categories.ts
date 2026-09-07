/**
 * The shop category tree.
 *
 * Slugs are the URL segment for `/shop/[category]` and the nav in
 * `src/lib/site.ts` links straight at them, so they must not be renamed
 * casually. `kind` ties a category to a `ComponentKind` (see src/lib/types.ts)
 * — the listing pages use it to decide which facets and spec chips to show, and
 * it is null for grouping-only nodes like `components` and `accessories`.
 *
 * The tree is intentionally two levels deep: the header dropdowns and the
 * mobile drawer both render parent -> children with no third tier.
 */

export type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  /** ComponentKind, or null for a grouping node. */
  kind: string | null;
  /** lucide-react icon name, resolved by src/components/ui/KindIcon.tsx. */
  icon: string;
  /** Design-token accent name from globals.css. */
  accent: string;
  sortOrder: number;
  featured: boolean;
  /** Parent category slug, or null for a top-level node. */
  parent: string | null;
};

export const categories: SeedCategory[] = [
  /* --- Gaming PCs -------------------------------------------------------- */
  {
    name: "Gaming PCs",
    slug: "gaming-pcs",
    description:
      "Complete machines assembled and tested on the Yalman Gaming bench, from first-build 1080p rigs to no-compromise 4K towers.",
    kind: "prebuilt",
    icon: "pc-case",
    accent: "cyan",
    sortOrder: 10,
    featured: true,
    parent: null,
  },
  {
    name: "Entry Gaming PCs",
    slug: "entry-gaming-pcs",
    description: "Smooth 1080p in esports titles without overspending.",
    kind: "prebuilt",
    icon: "gamepad-2",
    accent: "emerald",
    sortOrder: 11,
    featured: false,
    parent: "gaming-pcs",
  },
  {
    name: "Mid-Range Gaming PCs",
    slug: "mid-range-gaming-pcs",
    description: "High-refresh 1080p and comfortable 1440p in modern titles.",
    kind: "prebuilt",
    icon: "gauge",
    accent: "cyan",
    sortOrder: 12,
    featured: false,
    parent: "gaming-pcs",
  },
  {
    name: "High-End Gaming PCs",
    slug: "high-end-gaming-pcs",
    description: "1440p at high refresh with real headroom for 4K.",
    kind: "prebuilt",
    icon: "zap",
    accent: "violet",
    sortOrder: 13,
    featured: false,
    parent: "gaming-pcs",
  },
  {
    name: "Extreme Gaming PCs",
    slug: "extreme-gaming-pcs",
    description: "Flagship silicon for 4K, creation and local AI work.",
    kind: "prebuilt",
    icon: "flame",
    accent: "ember",
    sortOrder: 14,
    featured: false,
    parent: "gaming-pcs",
  },

  /* --- Components -------------------------------------------------------- */
  {
    name: "Components",
    slug: "components",
    description:
      "Every part that goes inside the case — pick them individually here, or configure the whole machine in the PC builder.",
    kind: null,
    icon: "circuit-board",
    accent: "violet",
    sortOrder: 20,
    featured: true,
    parent: null,
  },
  {
    name: "Graphics Cards",
    slug: "graphics-cards",
    description:
      "The single biggest factor in gaming performance at 1440p and 4K. GeForce RTX, Radeon RX and Intel Arc.",
    kind: "gpu",
    icon: "gpu",
    accent: "cyan",
    sortOrder: 21,
    featured: true,
    parent: "components",
  },
  {
    name: "Processors",
    slug: "processors",
    description:
      "AMD Ryzen on AM5 and AM4, Intel Core and Core Ultra on LGA1700 and LGA1851.",
    kind: "cpu",
    icon: "cpu",
    accent: "violet",
    sortOrder: 22,
    featured: true,
    parent: "components",
  },
  {
    name: "Motherboards",
    slug: "motherboards",
    description:
      "The board decides your socket, memory type and how much you can expand later.",
    kind: "motherboard",
    icon: "circuit-board",
    accent: "sky",
    sortOrder: 23,
    featured: true,
    parent: "components",
  },
  {
    name: "Memory",
    slug: "memory",
    description:
      "DDR5 and DDR4 kits with EXPO and XMP profiles, from 16GB to 64GB.",
    kind: "ram",
    icon: "memory-stick",
    accent: "emerald",
    sortOrder: 24,
    featured: true,
    parent: "components",
  },
  {
    name: "Storage",
    slug: "storage",
    description:
      "PCIe Gen5 and Gen4 NVMe drives for Windows and games, SATA SSDs and high-capacity hard disks.",
    kind: "storage",
    icon: "hard-drive",
    accent: "lime",
    sortOrder: 25,
    featured: true,
    parent: "components",
  },
  {
    name: "Cooling",
    slug: "cooling",
    description:
      "Tower air coolers and all-in-one liquid coolers. Check socket support and case clearance before you buy.",
    kind: "cooler",
    icon: "fan",
    accent: "sky",
    sortOrder: 26,
    featured: true,
    parent: "components",
  },
  {
    name: "Case Fans",
    slug: "case-fans",
    description: "Airflow and static-pressure fans, plain and addressable RGB.",
    kind: "fan",
    icon: "wind",
    accent: "cyan",
    sortOrder: 27,
    featured: false,
    parent: "components",
  },
  {
    name: "Power Supplies",
    slug: "power-supplies",
    description:
      "80 PLUS rated ATX and SFX units. Size from your build's live wattage estimate, not from a guess.",
    kind: "psu",
    icon: "plug-zap",
    accent: "ember",
    sortOrder: 28,
    featured: true,
    parent: "components",
  },
  {
    name: "PC Cases",
    slug: "cases",
    description:
      "Mid towers, full towers and Mini-ITX chassis. Every listing carries its real GPU, cooler and radiator clearance.",
    kind: "case",
    icon: "box",
    accent: "violet",
    sortOrder: 29,
    featured: true,
    parent: "components",
  },
  {
    name: "Operating Systems",
    slug: "operating-systems",
    description: "Windows licences, or bring your own.",
    kind: "os",
    icon: "monitor-cog",
    accent: "sky",
    sortOrder: 30,
    featured: false,
    parent: "components",
  },

  /* --- Monitors ---------------------------------------------------------- */
  {
    name: "Gaming Monitors",
    slug: "monitors",
    description:
      "1080p, 1440p and 4K panels from 144Hz to 360Hz. Match the panel to the graphics card, not to the marketing.",
    kind: "monitor",
    icon: "monitor",
    accent: "cyan",
    sortOrder: 40,
    featured: true,
    parent: null,
  },

  /* --- Accessories ------------------------------------------------------- */
  {
    name: "Accessories",
    slug: "accessories",
    description:
      "Everything on the desk: keyboards, mice, audio, capture and seating.",
    kind: null,
    icon: "keyboard",
    accent: "rose",
    sortOrder: 50,
    featured: true,
    parent: null,
  },
  {
    name: "Keyboards",
    slug: "keyboards",
    description: "Mechanical and Hall-effect boards, wired and wireless.",
    kind: "keyboard",
    icon: "keyboard",
    accent: "violet",
    sortOrder: 51,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Mice",
    slug: "mice",
    description: "Lightweight wireless and wired sensors built for competitive play.",
    kind: "mouse",
    icon: "mouse",
    accent: "cyan",
    sortOrder: 52,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Headsets",
    slug: "headsets",
    description: "Wired and wireless gaming audio with boom microphones.",
    kind: "headset",
    icon: "headphones",
    accent: "emerald",
    sortOrder: 53,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Microphones",
    slug: "microphones",
    description: "USB condenser microphones for streaming, calls and voice-over.",
    kind: "microphone",
    icon: "mic",
    accent: "ember",
    sortOrder: 54,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Webcams",
    slug: "webcams",
    description: "1080p and 4K cameras for streaming and meetings.",
    kind: "webcam",
    icon: "video",
    accent: "sky",
    sortOrder: 55,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Gaming Chairs",
    slug: "chairs",
    description: "Seating built for long sessions, from fabric to leatherette.",
    kind: "chair",
    icon: "armchair",
    accent: "rose",
    sortOrder: 56,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Controllers",
    slug: "controllers",
    description: "Gamepads for PC — wired, wireless and tournament-grade.",
    kind: "controller",
    icon: "gamepad-2",
    accent: "lime",
    sortOrder: 57,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Mousepads",
    slug: "mousepads",
    description: "Cloth and hybrid surfaces, desk-mat sizes included.",
    kind: "mousepad",
    icon: "square",
    accent: "violet",
    sortOrder: 58,
    featured: false,
    parent: "accessories",
  },
  {
    name: "Speakers",
    slug: "speakers",
    description: "Desktop 2.0 and 2.1 systems for games, music and film.",
    kind: "speaker",
    icon: "speaker",
    accent: "ember",
    sortOrder: 59,
    featured: false,
    parent: "accessories",
  },
];
