/**
 * Prebuilt machines and the "Built by Yalman" showcase.
 *
 * Two exports, deliberately kept together because they describe the same six
 * machines from two angles:
 *
 *   `prebuilts`      — sellable Products with kind "prebuilt". They carry no
 *                      compatibility columns, because a finished machine is not
 *                      a part the builder has to fit against anything.
 *   `showcaseBuilds` — the ShowcaseBuild rows behind /showcase, each holding a
 *                      JSON component list so the page can render the parts
 *                      without joining back through the catalog.
 *
 * The component lists are the same parts that appear elsewhere in this seed, so
 * the prices below are roughly the sum of those parts plus assembly. Every
 * figure is sample data (`samplePrice`) pending Yalman Gaming's confirmation.
 */

import type { SeedProduct } from "./types.ts";
import { spec, MFR_WARRANTY } from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Sellable prebuilt machines                                                 */
/* -------------------------------------------------------------------------- */

export const prebuilts: SeedProduct[] = [
  {
    sku: "YG-PC-PHANTOM",
    slug: "yalman-phantom-entry-gaming-pc",
    name: "YALMAN PHANTOM",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "entry-gaming-pcs",
    headline: "A first gaming PC that plays everything at 1080p.",
    description:
      "Six Zen 3 cores and an RTX 4060 in a compact Micro-ATX chassis — the configuration that gets the most frames for the least money right now. Sixteen gigabytes of DDR4 and a 1TB NVMe drive cover Windows and a working game library. Every machine is assembled, cable-managed and stress tested on our bench before it leaves the shop.",
    price: 245000,
    stock: 3,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "AMD Ryzen 5 5600"),
      spec("Core", "Graphics", "Gigabyte GeForce RTX 4060 WINDFORCE OC 8G"),
      spec("Core", "Memory", "16 GB DDR4-3200 (2 × 8 GB)"),
      spec("Core", "Storage", "1 TB Crucial P3 Plus NVMe"),
      spec("Platform", "Motherboard", "Gigabyte B550M DS3H"),
      spec("Cooling", "CPU cooler", "Deepcool AG400 air cooler"),
      spec("Power", "Power supply", "Cooler Master MWE Gold 650 V2"),
      spec("Chassis", "Case", "Cooler Master MasterBox Q300L V2"),
      spec("Target", "Resolution", "1080p high settings"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
  {
    sku: "YG-PC-NOVA",
    slug: "yalman-nova-mid-range-gaming-pc",
    name: "YALMAN NOVA",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "mid-range-gaming-pcs",
    headline: "1440p on Zen 5, with sixteen gigabytes of video memory.",
    description:
      "A Ryzen 5 9600X paired with the 16GB RTX 5060 Ti — the version of that card worth owning, because the extra memory is what holds texture quality at 1440p. Thirty-two gigabytes of DDR5-6000 and a WD_BLACK SN850X handle everything around the game. Built in a Corsair 4000D Airflow so it stays cool and quiet.",
    price: 425000,
    stock: 3,
    featured: true,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "AMD Ryzen 5 9600X"),
      spec("Core", "Graphics", "Gigabyte GeForce RTX 5060 Ti WINDFORCE OC 16G"),
      spec("Core", "Memory", "32 GB DDR5-6000 CL30 (2 × 16 GB)"),
      spec("Core", "Storage", "1 TB WD_BLACK SN850X NVMe"),
      spec("Platform", "Motherboard", "Gigabyte B650 Gaming X AX"),
      spec("Cooling", "CPU cooler", "Thermalright Peerless Assassin 120 SE"),
      spec("Power", "Power supply", "Corsair RM750e 750W Gold"),
      spec("Chassis", "Case", "Corsair 4000D Airflow"),
      spec("Target", "Resolution", "1440p high settings"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
  {
    sku: "YG-PC-VORTEX",
    slug: "yalman-vortex-1440p-gaming-pc",
    name: "YALMAN VORTEX",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "mid-range-gaming-pcs",
    headline: "Fourteen Intel cores and an RTX 5070 under a 360mm loop.",
    description:
      "A Core i5-14600K on a 360mm all-in-one, which keeps its twenty threads at full clock while an RTX 5070 drives a 1440p high-refresh panel. Two terabytes of SN850X means the game library does not have to be curated. The mesh-front TD500 keeps three ARGB intakes pointed at the card.",
    price: 585000,
    stock: 2,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "Intel Core i5-14600K"),
      spec("Core", "Graphics", "MSI GeForce RTX 5070 12G Shadow 3X OC"),
      spec("Core", "Memory", "32 GB DDR5-6000 CL30 (2 × 16 GB)"),
      spec("Core", "Storage", "2 TB WD_BLACK SN850X NVMe"),
      spec("Platform", "Motherboard", "MSI PRO B760-P WiFi"),
      spec("Cooling", "CPU cooler", "Cooler Master MasterLiquid 360L Core ARGB"),
      spec("Power", "Power supply", "MSI MAG A850GL PCIE5 850W Gold"),
      spec("Chassis", "Case", "Cooler Master MasterBox TD500 Mesh V2"),
      spec("Target", "Resolution", "1440p high refresh"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
  {
    sku: "YG-PC-TITAN",
    slug: "yalman-titan-high-end-gaming-pc",
    name: "YALMAN TITAN",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "high-end-gaming-pcs",
    headline: "9800X3D plus RTX 5070 Ti — the enthusiast default.",
    description:
      "The Ryzen 7 9800X3D is the fastest gaming processor available and the 16GB RTX 5070 Ti is the card that matches it at 1440p without overspending. A Lian Li Galahad II 360mm loop keeps the X3D quiet under load, and the LANCOOL 216's two 160mm intakes keep everything else fed. Two terabytes of Gen4 storage.",
    price: 875000,
    stock: 2,
    featured: true,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "AMD Ryzen 7 9800X3D"),
      spec("Core", "Graphics", "ASUS TUF Gaming GeForce RTX 5070 Ti 16GB OC"),
      spec("Core", "Memory", "32 GB DDR5-6000 CL30 (2 × 16 GB)"),
      spec("Core", "Storage", "2 TB WD_BLACK SN850X NVMe"),
      spec("Platform", "Motherboard", "MSI MAG B850 Tomahawk MAX WiFi"),
      spec("Cooling", "CPU cooler", "Lian Li Galahad II Trinity 360mm AIO"),
      spec("Power", "Power supply", "Corsair RM850x SHIFT 850W Gold"),
      spec("Chassis", "Case", "Lian Li LANCOOL 216"),
      spec("Target", "Resolution", "1440p ultra, entry 4K"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
  {
    sku: "YG-PC-SPECTRE",
    slug: "yalman-spectre-4k-gaming-pc",
    name: "YALMAN SPECTRE",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "high-end-gaming-pcs",
    headline: "Twenty Intel cores, an RTX 5080 and a Gen5 boot drive.",
    description:
      "A Core Ultra 7 265K and an RTX 5080 in a Lian Li O11 Dynamic EVO — a genuine 4K machine that is equally at home in a video timeline. Sixty-four gigabytes of DDR5 and a 2TB Crucial T700 Gen5 drive remove the two bottlenecks creators usually hit first. Cooled by a 280mm Kraken Elite.",
    price: 1225000,
    stock: 1,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "Intel Core Ultra 7 265K"),
      spec("Core", "Graphics", "Gigabyte GeForce RTX 5080 AERO OC 16G"),
      spec("Core", "Memory", "64 GB DDR5-6000 CL30 (2 × 32 GB)"),
      spec("Core", "Storage", "2 TB Crucial T700 PCIe Gen5 NVMe"),
      spec("Platform", "Motherboard", "MSI MAG Z890 Tomahawk WiFi"),
      spec("Cooling", "CPU cooler", "NZXT Kraken Elite 280 RGB AIO"),
      spec("Power", "Power supply", "Seasonic VERTEX GX-1000 1000W Gold"),
      spec("Chassis", "Case", "Lian Li O11 Dynamic EVO"),
      spec("Target", "Resolution", "4K high settings"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
  {
    sku: "YG-PC-OMEGA",
    slug: "yalman-omega-extreme-gaming-pc",
    name: "YALMAN OMEGA",
    kind: "prebuilt",
    brand: "Yalman Gaming",
    category: "extreme-gaming-pcs",
    headline: "9950X3D and an RTX 5090. There is nothing above this.",
    description:
      "Sixteen Zen 5 cores with 3D V-Cache alongside a 32GB RTX 5090, in a full-tower O11 Dynamic EVO XL with room for the airflow both of them need. Sixty-four gigabytes of DDR5 and a 2TB Gen5 drive. It is built for 4K at maximum settings, heavy 3D work and local AI models — often on the same afternoon.",
    price: 2150000,
    stock: 1,
    isNew: true,
    warranty: MFR_WARRANTY,
    specSheet: [
      spec("Core", "Processor", "AMD Ryzen 9 9950X3D"),
      spec("Core", "Graphics", "ASUS ROG Astral GeForce RTX 5090 32GB"),
      spec("Core", "Memory", "64 GB DDR5-6000 CL30 (2 × 32 GB)"),
      spec("Core", "Storage", "2 TB Crucial T700 PCIe Gen5 NVMe"),
      spec("Platform", "Motherboard", "Gigabyte X870E AORUS Master"),
      spec("Cooling", "CPU cooler", "Corsair iCUE LINK H150i RGB 360mm AIO"),
      spec("Power", "Power supply", "Corsair HX1200i 1200W Platinum"),
      spec("Chassis", "Case", "Lian Li O11 Dynamic EVO XL"),
      spec("Target", "Resolution", "4K ultra, creation and local AI"),
      spec("Assembly", "Included", "Build, cable management, BIOS setup, stress test"),
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Showcase rows                                                              */
/* -------------------------------------------------------------------------- */

export type ShowcaseComponent = { kind: string; name: string };

export type SeedShowcase = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Entry | Mid-Range | High-End | Extreme */
  tier: string;
  /** Plain-language performance target, e.g. "1440p 144FPS". */
  target: string;
  price: number;
  components: ShowcaseComponent[];
  /** Design-token accent name from globals.css. */
  accent: string;
  featured: boolean;
  sortOrder: number;
};

export const showcaseBuilds: SeedShowcase[] = [
  {
    slug: "yalman-phantom",
    name: "YALMAN PHANTOM",
    tagline: "The one that gets you in the door.",
    description:
      "The build we assemble most often. A Ryzen 5 5600 and an RTX 4060 in a small Micro-ATX chassis, spending nothing on parts that do not move the frame rate. It plays current titles at 1080p high settings and leaves room to add a second drive later.",
    tier: "Entry",
    target: "1080p high, 100+ FPS in esports titles",
    price: 245000,
    accent: "emerald",
    featured: false,
    sortOrder: 10,
    components: [
      { kind: "cpu", name: "AMD Ryzen 5 5600" },
      { kind: "motherboard", name: "Gigabyte B550M DS3H" },
      { kind: "gpu", name: "Gigabyte GeForce RTX 4060 WINDFORCE OC 8G" },
      { kind: "ram", name: "Corsair Vengeance LPX 16GB (2×8GB) DDR4-3200" },
      { kind: "storage", name: "Crucial P3 Plus 1TB NVMe SSD" },
      { kind: "cooler", name: "Deepcool AG400" },
      { kind: "psu", name: "Cooler Master MWE Gold 650 V2" },
      { kind: "case", name: "Cooler Master MasterBox Q300L V2" },
    ],
  },
  {
    slug: "yalman-nova",
    name: "YALMAN NOVA",
    tagline: "Zen 5 and 16GB of VRAM, at a sensible number.",
    description:
      "A Ryzen 5 9600X with the 16GB RTX 5060 Ti. The 65W processor means a large air cooler is enough and the machine stays quiet, while the card's memory keeps textures at maximum where the 8GB version has to compromise.",
    tier: "Mid-Range",
    target: "1440p high, 100+ FPS in modern titles",
    price: 425000,
    accent: "cyan",
    featured: true,
    sortOrder: 20,
    components: [
      { kind: "cpu", name: "AMD Ryzen 5 9600X" },
      { kind: "motherboard", name: "Gigabyte B650 Gaming X AX" },
      { kind: "gpu", name: "Gigabyte GeForce RTX 5060 Ti WINDFORCE OC 16G" },
      { kind: "ram", name: "G.Skill Trident Z5 RGB 32GB (2×16GB) DDR5-6000 CL30" },
      { kind: "storage", name: "WD_BLACK SN850X 1TB NVMe SSD" },
      { kind: "cooler", name: "Thermalright Peerless Assassin 120 SE" },
      { kind: "psu", name: "Corsair RM750e 750W 80 PLUS Gold" },
      { kind: "case", name: "Corsair 4000D Airflow" },
    ],
  },
  {
    slug: "yalman-vortex",
    name: "YALMAN VORTEX",
    tagline: "Twenty threads under a 360mm loop.",
    description:
      "A Core i5-14600K cooled properly, with an RTX 5070 for 1440p at high refresh. The E-core cluster absorbs a stream encoder or a browser full of tabs without touching the game's frame rate, and two terabytes of Gen4 storage means nothing has to be uninstalled.",
    tier: "Mid-Range",
    target: "1440p high refresh, 144 FPS",
    price: 585000,
    accent: "sky",
    featured: false,
    sortOrder: 30,
    components: [
      { kind: "cpu", name: "Intel Core i5-14600K" },
      { kind: "motherboard", name: "MSI PRO B760-P WiFi" },
      { kind: "gpu", name: "MSI GeForce RTX 5070 12G Shadow 3X OC" },
      { kind: "ram", name: "G.Skill Trident Z5 RGB 32GB (2×16GB) DDR5-6000 CL30" },
      { kind: "storage", name: "WD_BLACK SN850X 2TB NVMe SSD" },
      { kind: "cooler", name: "Cooler Master MasterLiquid 360L Core ARGB" },
      { kind: "psu", name: "MSI MAG A850GL PCIE5 850W" },
      { kind: "case", name: "Cooler Master MasterBox TD500 Mesh V2" },
    ],
  },
  {
    slug: "yalman-titan",
    name: "YALMAN TITAN",
    tagline: "The fastest gaming CPU, and a card that keeps up with it.",
    description:
      "A Ryzen 7 9800X3D with an RTX 5070 Ti — the pairing we recommend most often to people who care about minimum frame rates rather than averages. A 360mm Lian Li loop and the LANCOOL 216's oversized intakes keep both of them at full clock.",
    tier: "High-End",
    target: "1440p ultra, entry 4K",
    price: 875000,
    accent: "violet",
    featured: true,
    sortOrder: 40,
    components: [
      { kind: "cpu", name: "AMD Ryzen 7 9800X3D" },
      { kind: "motherboard", name: "MSI MAG B850 Tomahawk MAX WiFi" },
      { kind: "gpu", name: "ASUS TUF Gaming GeForce RTX 5070 Ti 16GB OC" },
      { kind: "ram", name: "G.Skill Trident Z5 RGB 32GB (2×16GB) DDR5-6000 CL30" },
      { kind: "storage", name: "WD_BLACK SN850X 2TB NVMe SSD" },
      { kind: "cooler", name: "Lian Li Galahad II Trinity 360mm AIO" },
      { kind: "psu", name: "Corsair RM850x SHIFT 850W 80 PLUS Gold" },
      { kind: "case", name: "Lian Li LANCOOL 216" },
    ],
  },
  {
    slug: "yalman-spectre",
    name: "YALMAN SPECTRE",
    tagline: "A 4K machine that also finishes the edit.",
    description:
      "Core Ultra 7 265K, RTX 5080, sixty-four gigabytes of DDR5 and a Gen5 boot drive, in Lian Li's dual-chamber O11 Dynamic EVO so the cabling disappears. It renders and encodes as readily as it plays, which is what the twenty cores are there for.",
    tier: "High-End",
    target: "4K high, 60–100 FPS",
    price: 1225000,
    accent: "ember",
    featured: false,
    sortOrder: 50,
    components: [
      { kind: "cpu", name: "Intel Core Ultra 7 265K" },
      { kind: "motherboard", name: "MSI MAG Z890 Tomahawk WiFi" },
      { kind: "gpu", name: "Gigabyte GeForce RTX 5080 AERO OC 16G" },
      { kind: "ram", name: "G.Skill Trident Z5 RGB 64GB (2×32GB) DDR5-6000 CL30" },
      { kind: "storage", name: "Crucial T700 2TB PCIe Gen5 NVMe SSD" },
      { kind: "cooler", name: "NZXT Kraken Elite 280 RGB AIO" },
      { kind: "psu", name: "Seasonic VERTEX GX-1000 1000W" },
      { kind: "case", name: "Lian Li O11 Dynamic EVO" },
    ],
  },
  {
    slug: "yalman-omega",
    name: "YALMAN OMEGA",
    tagline: "Everything, with nothing held back.",
    description:
      "A Ryzen 9 9950X3D and a 32GB RTX 5090 in a full-tower O11 Dynamic EVO XL. Sixteen cores with 3D V-Cache means it gives up nothing in games while still rendering at full sixteen-core throughput, and thirty-two gigabytes of GDDR7 puts serious local AI work within reach.",
    tier: "Extreme",
    target: "4K ultra, creation and local AI",
    price: 2150000,
    accent: "rose",
    featured: true,
    sortOrder: 60,
    components: [
      { kind: "cpu", name: "AMD Ryzen 9 9950X3D" },
      { kind: "motherboard", name: "Gigabyte X870E AORUS Master" },
      { kind: "gpu", name: "ASUS ROG Astral GeForce RTX 5090 32GB" },
      { kind: "ram", name: "G.Skill Trident Z5 RGB 64GB (2×32GB) DDR5-6000 CL30" },
      { kind: "storage", name: "Crucial T700 2TB PCIe Gen5 NVMe SSD" },
      { kind: "cooler", name: "Corsair iCUE LINK H150i RGB 360mm AIO" },
      { kind: "psu", name: "Corsair HX1200i 1200W 80 PLUS Platinum" },
      { kind: "case", name: "Lian Li O11 Dynamic EVO XL" },
    ],
  },
];
