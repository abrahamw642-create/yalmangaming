/**
 * Brands Yalman Gaming stocks parts from.
 *
 * A brand row is nothing more than a name for filtering and attribution. It is
 * NOT a claim of an authorised-dealer relationship or a partnership — the
 * contract forbids inventing those, so nothing here says more than "we sell
 * this brand's hardware".
 */

export type SeedBrand = {
  name: string;
  slug: string;
  website: string | null;
};

export const brands: SeedBrand[] = [
  { name: "AMD", slug: "amd", website: "https://www.amd.com" },
  { name: "Intel", slug: "intel", website: "https://www.intel.com" },
  { name: "NVIDIA", slug: "nvidia", website: "https://www.nvidia.com" },
  { name: "ASUS", slug: "asus", website: "https://www.asus.com" },
  { name: "MSI", slug: "msi", website: "https://www.msi.com" },
  { name: "Gigabyte", slug: "gigabyte", website: "https://www.gigabyte.com" },
  { name: "ASRock", slug: "asrock", website: "https://www.asrock.com" },
  { name: "Corsair", slug: "corsair", website: "https://www.corsair.com" },
  { name: "G.Skill", slug: "g-skill", website: "https://www.gskill.com" },
  { name: "Kingston", slug: "kingston", website: "https://www.kingston.com" },
  { name: "Samsung", slug: "samsung", website: "https://semiconductor.samsung.com" },
  {
    name: "Western Digital",
    slug: "western-digital",
    website: "https://www.westerndigital.com",
  },
  { name: "Crucial", slug: "crucial", website: "https://www.crucial.com" },
  { name: "Seagate", slug: "seagate", website: "https://www.seagate.com" },
  { name: "Lian Li", slug: "lian-li", website: "https://lian-li.com" },
  { name: "NZXT", slug: "nzxt", website: "https://nzxt.com" },
  {
    name: "Cooler Master",
    slug: "cooler-master",
    website: "https://www.coolermaster.com",
  },
  { name: "be quiet!", slug: "be-quiet", website: "https://www.bequiet.com" },
  {
    name: "Thermalright",
    slug: "thermalright",
    website: "https://www.thermalright.com",
  },
  { name: "Noctua", slug: "noctua", website: "https://noctua.at" },
  { name: "Deepcool", slug: "deepcool", website: "https://www.deepcool.com" },
  { name: "Seasonic", slug: "seasonic", website: "https://seasonic.com" },
  { name: "Logitech", slug: "logitech", website: "https://www.logitechg.com" },
  { name: "Razer", slug: "razer", website: "https://www.razer.com" },
  {
    name: "SteelSeries",
    slug: "steelseries",
    website: "https://steelseries.com",
  },
  { name: "HyperX", slug: "hyperx", website: "https://hyperx.com" },
  { name: "Zowie", slug: "zowie", website: "https://zowie.benq.com" },
  { name: "LG", slug: "lg", website: "https://www.lg.com" },
  { name: "Dell", slug: "dell", website: "https://www.dell.com" },
  { name: "BenQ", slug: "benq", website: "https://www.benq.com" },
  { name: "Sapphire", slug: "sapphire", website: "https://www.sapphiretech.com" },
  {
    name: "PowerColor",
    slug: "powercolor",
    website: "https://www.powercolor.com",
  },
  { name: "XFX", slug: "xfx", website: "https://www.xfxforce.com" },
  // Needed for Windows licences and Xbox controllers.
  { name: "Microsoft", slug: "microsoft", website: "https://www.microsoft.com" },
  // The store's own assembled machines carry the shop's name.
  { name: "Yalman Gaming", slug: "yalman-gaming", website: "https://yalmangaming.com" },
];
