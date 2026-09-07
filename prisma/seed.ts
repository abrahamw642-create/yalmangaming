/**
 * Yalman Gaming — database seed.
 *
 * Run with `npm run db:seed`, which is
 * `node --experimental-strip-types prisma/seed.ts`. Node strips the type
 * annotations and runs the file directly, so everything here has to be
 * *erasable* TypeScript: type annotations and `import type` only — no enums,
 * namespaces, decorators or parameter properties — and relative imports keep
 * their `.ts` extension.
 *
 * Idempotency
 * -----------
 * The script is safe to run repeatedly. The two tables it fully owns
 * (ProductImage and Benchmark) are cleared and rebuilt; everything else is
 * upserted on its unique key. Nothing the *store* creates is ever deleted:
 * reviews, orders, carts, quote requests and saved builds all survive a
 * re-seed, which is why there is no blanket `deleteMany` over Product.
 *
 * Pricing
 * -------
 * Every product is written with `samplePrice: true`. These are researched
 * Lahore-market figures, not quotes from Yalman Gaming, and the storefront
 * labels them as such until the store replaces them from the admin.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { brands } from "./data/brands.ts";
import { categories } from "./data/categories.ts";
import { cpus } from "./data/cpus.ts";
import { motherboards } from "./data/motherboards.ts";
import { gpus, gpuBenchmarks, BENCHMARK_SOURCE } from "./data/gpus.ts";
import { memoryKits } from "./data/memory.ts";
import { storage } from "./data/storage.ts";
import { psus } from "./data/psus.ts";
import { coolers } from "./data/coolers.ts";
import { cases } from "./data/cases.ts";
import { fans, operatingSystems } from "./data/fans-os.ts";
import { peripherals } from "./data/peripherals.ts";
import { prebuilts, showcaseBuilds } from "./data/showcase.ts";

import type { SeedProduct } from "./data/types.ts";
import {
  jsonList,
  jsonMap,
  jsonSpecs,
  placeholderImage,
} from "./data/types.ts";

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/* Composition                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every sellable row, in the order the admin's product list reads best:
 * core components first, then peripherals, then the finished machines.
 */
const allProducts: SeedProduct[] = [
  ...cpus,
  ...motherboards,
  ...gpus,
  ...memoryKits,
  ...storage,
  ...psus,
  ...coolers,
  ...cases,
  ...fans,
  ...operatingSystems,
  ...peripherals,
  ...prebuilts,
];

/* -------------------------------------------------------------------------- */
/* Pre-flight validation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Catches the mistakes that would otherwise surface as a half-seeded database
 * or, worse, as a silently broken compatibility engine. Runs before a single
 * write, and throws with every problem listed rather than the first one.
 */
function validate(): void {
  const problems: string[] = [];

  const brandNames = new Set(brands.map((b) => b.name));
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const productSlugs = new Set<string>();
  const skus = new Set<string>();

  for (const c of categories) {
    if (c.parent && !categorySlugs.has(c.parent)) {
      problems.push(`category "${c.slug}" has unknown parent "${c.parent}"`);
    }
  }

  for (const p of allProducts) {
    if (skus.has(p.sku)) problems.push(`duplicate sku "${p.sku}"`);
    skus.add(p.sku);

    if (productSlugs.has(p.slug)) problems.push(`duplicate slug "${p.slug}"`);
    productSlugs.add(p.slug);

    if (p.brand !== null && !brandNames.has(p.brand)) {
      problems.push(`${p.sku}: unknown brand "${p.brand}"`);
    }
    if (!categorySlugs.has(p.category)) {
      problems.push(`${p.sku}: unknown category "${p.category}"`);
    }
    if (!Number.isInteger(p.price) || p.price < 0) {
      // Money is whole PKR everywhere — a float here would round unpredictably
      // through the Int column and quietly change a price.
      problems.push(`${p.sku}: price must be a non-negative integer`);
    }
    if (p.salePrice !== undefined && p.salePrice >= p.price) {
      problems.push(`${p.sku}: salePrice must be below price`);
    }
  }

  // A benchmark whose card is missing would be dropped silently otherwise, and
  // the product page would just show a shorter table with no hint why.
  for (const b of gpuBenchmarks) {
    if (!productSlugs.has(b.productSlug)) {
      problems.push(`benchmark references unknown product "${b.productSlug}"`);
    }
  }

  if (problems.length) {
    throw new Error(`Seed data is inconsistent:\n  - ${problems.join("\n  - ")}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Row builders                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Maps a `SeedProduct` onto Product columns.
 *
 * Optional fields are coerced to `null` rather than left `undefined`: on an
 * upsert's `update` branch Prisma treats `undefined` as "leave alone", so a
 * value removed from the seed data would linger in the database forever. `null`
 * makes a re-run converge on exactly what the files say.
 */
function productRow(
  p: SeedProduct,
  brandId: string | null,
  categoryId: string | null,
) {
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    description: p.description,
    kind: p.kind,
    brandId,
    categoryId,

    price: p.price,
    salePrice: p.salePrice ?? null,
    costPrice: null,
    samplePrice: true,
    stock: p.stock,
    lowStockAt: 3,
    supplier: null,
    warranty: p.warranty ?? null,

    status: "active",
    featured: p.featured ?? false,
    isNew: p.isNew ?? false,
    onDeal: p.onDeal ?? false,

    // No invented social proof. Ratings stay at zero until real reviews exist.
    rating: 0,
    reviewCount: 0,

    socket: p.socket ?? null,
    chipset: p.chipset ?? null,
    tdp: p.tdp ?? null,
    peakPowerW: p.peakPowerW ?? null,
    cores: p.cores ?? null,
    threads: p.threads ?? null,
    baseClock: p.baseClock ?? null,
    boostClock: p.boostClock ?? null,
    integratedGraphics: p.integratedGraphics ?? false,

    memoryType: p.memoryType ?? null,
    memorySpeed: p.memorySpeed ?? null,
    memorySlots: p.memorySlots ?? null,
    maxMemoryGb: p.maxMemoryGb ?? null,
    capacityGb: p.capacityGb ?? null,
    moduleCount: p.moduleCount ?? null,

    vramGb: p.vramGb ?? null,
    gpuLengthMm: p.gpuLengthMm ?? null,
    requiredConnectors: jsonList(p.requiredConnectors),
    recommendedPsuW: p.recommendedPsuW ?? null,
    slotWidth: p.slotWidth ?? null,

    storageInterface: p.storageInterface ?? null,
    formFactorDrive: p.formFactorDrive ?? null,

    formFactor: p.formFactor ?? null,
    m2Slots: p.m2Slots ?? null,
    sataPorts: p.sataPorts ?? null,
    pcieVersion: p.pcieVersion ?? null,

    wattage: p.wattage ?? null,
    efficiency: p.efficiency ?? null,
    modular: p.modular ?? null,
    psuFormFactor: p.psuFormFactor ?? null,
    psuLengthMm: p.psuLengthMm ?? null,
    providedConnectors: jsonMap(p.providedConnectors),

    coolerType: p.coolerType ?? null,
    coolerHeightMm: p.coolerHeightMm ?? null,
    radiatorSizeMm: p.radiatorSizeMm ?? null,
    supportedSockets: jsonList(p.supportedSockets),
    coolingCapacityW: p.coolingCapacityW ?? null,

    supportedFormFactors: jsonList(p.supportedFormFactors),
    maxGpuLengthMm: p.maxGpuLengthMm ?? null,
    maxCoolerHeightMm: p.maxCoolerHeightMm ?? null,
    maxPsuLengthMm: p.maxPsuLengthMm ?? null,
    radiatorSupport: jsonMap(p.radiatorSupport),
    caseStyle: p.caseStyle ?? null,
    dimensionsMm: p.dimensionsMm ?? null,
    includedFans: p.includedFans ?? null,

    resolution: p.resolution ?? null,
    refreshRate: p.refreshRate ?? null,
    panelSizeIn: p.panelSizeIn ?? null,
    panelType: p.panelType ?? null,
    connectivity: p.connectivity ?? null,
    switchType: p.switchType ?? null,

    rgb: p.rgb ?? false,
    specSheet: jsonSpecs(p.specSheet),
  };
}

/* -------------------------------------------------------------------------- */
/* Seed steps                                                                 */
/* -------------------------------------------------------------------------- */

async function seedBrands(): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, website: b.website },
      create: { name: b.name, slug: b.slug, website: b.website },
    });
    byName.set(row.name, row.id);
  }
  return byName;
}

/**
 * Two passes: create every node parentless, then wire the parents up. A single
 * pass would need the input array to be topologically sorted, which is a
 * constraint the data file should not have to think about.
 */
async function seedCategories(): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();

  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        kind: c.kind,
        icon: c.icon,
        accent: c.accent,
        sortOrder: c.sortOrder,
        featured: c.featured,
      },
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        kind: c.kind,
        icon: c.icon,
        accent: c.accent,
        sortOrder: c.sortOrder,
        featured: c.featured,
      },
    });
    bySlug.set(c.slug, row.id);
  }

  for (const c of categories) {
    await prisma.category.update({
      where: { slug: c.slug },
      data: { parentId: c.parent ? (bySlug.get(c.parent) ?? null) : null },
    });
  }

  return bySlug;
}

async function seedProducts(
  brandIds: Map<string, string>,
  categoryIds: Map<string, string>,
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();

  for (const p of allProducts) {
    const data = productRow(
      p,
      p.brand ? (brandIds.get(p.brand) ?? null) : null,
      categoryIds.get(p.category) ?? null,
    );

    const row = await prisma.product.upsert({
      where: { sku: p.sku },
      update: data,
      create: data,
    });
    idBySlug.set(p.slug, row.id);
  }

  return idBySlug;
}

/**
 * There are no product photographs yet, so every product gets one generated
 * per-kind illustration flagged `placeholder: true`. The storefront reads that
 * flag to present the image as artwork rather than implying it is a photo of
 * the actual part.
 */
async function seedImages(idBySlug: Map<string, string>): Promise<number> {
  const rows = allProducts.map((p) => ({
    productId: idBySlug.get(p.slug)!,
    url: placeholderImage(p.kind),
    alt: `${p.name} — illustration`,
    sortOrder: 0,
    placeholder: true,
  }));

  await prisma.productImage.createMany({ data: rows });
  return rows.length;
}

async function seedBenchmarks(idBySlug: Map<string, string>): Promise<number> {
  const rows = gpuBenchmarks.map((b) => ({
    productId: idBySlug.get(b.productSlug)!,
    game: b.game,
    resolution: b.resolution,
    preset: b.preset,
    avgFps: b.avgFps,
    onePercentLow: b.onePercentLow,
    source: BENCHMARK_SOURCE,
    cpuContext: b.cpuContext,
  }));

  await prisma.benchmark.createMany({ data: rows });
  return rows.length;
}

async function seedShowcase(): Promise<number> {
  for (const b of showcaseBuilds) {
    const data = {
      name: b.name,
      tagline: b.tagline,
      description: b.description,
      tier: b.tier,
      target: b.target,
      price: b.price,
      samplePrice: true,
      components: JSON.stringify(b.components),
      // The showcase cards render the same per-kind illustration the catalog
      // uses, so a machine without a photograph still looks intentional.
      imageUrl: placeholderImage("prebuilt"),
      accent: b.accent,
      featured: b.featured,
      sortOrder: b.sortOrder,
    };

    await prisma.showcaseBuild.upsert({
      where: { slug: b.slug },
      update: data,
      create: { slug: b.slug, ...data },
    });
  }
  return showcaseBuilds.length;
}

/**
 * One administrator so the dashboard is reachable on a fresh database. The
 * fallback credentials are development-only and the password is hashed here
 * exactly as the sign-in route will verify it.
 */
async function seedAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL ?? "admin@yalmangaming.com";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe_YalmanGaming123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { role: "admin", passwordHash, name: "Yalman Gaming Admin" },
    create: {
      email,
      passwordHash,
      name: "Yalman Gaming Admin",
      role: "admin",
    },
  });

  return email;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const startedAt = Date.now();
  validate();

  // Only the two tables this script owns outright. Reviews are never touched:
  // they are real customer text added from the admin, and the seed writes none.
  await prisma.benchmark.deleteMany();
  await prisma.productImage.deleteMany();

  const brandIds = await seedBrands();
  const categoryIds = await seedCategories();
  const productIds = await seedProducts(brandIds, categoryIds);
  const imageCount = await seedImages(productIds);
  const benchmarkCount = await seedBenchmarks(productIds);
  const showcaseCount = await seedShowcase();
  const adminEmail = await seedAdmin();

  /* --- Summary ----------------------------------------------------------- */

  const kindCounts = await prisma.product.groupBy({
    by: ["kind"],
    _count: { _all: true },
    orderBy: { kind: "asc" },
  });

  const [productTotal, reviewTotal] = await Promise.all([
    prisma.product.count(),
    prisma.review.count(),
  ]);

  const pad = (label: string) => label.padEnd(22, " ");
  const line = (label: string, value: number | string) =>
    console.log(`  ${pad(label)} ${value}`);

  console.log("\nYalman Gaming — seed complete\n");
  console.log("  Tables");
  console.log("  " + "-".repeat(34));
  line("Brand", brandIds.size);
  line("Category", categoryIds.size);
  line("Product", productTotal);
  line("ProductImage", imageCount);
  line("Benchmark", benchmarkCount);
  line("ShowcaseBuild", showcaseCount);
  line("Review", reviewTotal);
  line("User (admin)", adminEmail);

  console.log("\n  Products by kind");
  console.log("  " + "-".repeat(34));
  for (const row of kindCounts) line(row.kind, row._count._all);

  const deals = await prisma.product.count({ where: { onDeal: true } });
  const fresh = await prisma.product.count({ where: { isNew: true } });
  const featured = await prisma.product.count({ where: { featured: true } });
  const outOfStock = await prisma.product.count({ where: { stock: 0 } });

  console.log("\n  Flags");
  console.log("  " + "-".repeat(34));
  line("On deal", deals);
  line("New", fresh);
  line("Featured", featured);
  line("Out of stock", outOfStock);
  line("Sample pricing", productTotal);

  console.log(`\n  Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
