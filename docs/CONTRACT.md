# Yalman Gaming — build contract

Read this before writing any code. It defines the foundation that already
exists and the interfaces feature areas use to reach each other. Several people
are building different areas in parallel, so **the import paths and prop shapes
below are fixed** — code against them even if the other file does not exist yet.

## Business facts (never invent more)

Supplied by the store owner and encoded in `src/lib/site.ts`:

- **Yalman Gaming**, gaming PC / computer hardware store
- 3rd Floor, Hafeez Centre, Shop #12-A, Block E-1 Gulberg III, Lahore 54660, Pakistan
- Phone `0328 4400231` (E.164 `923284400231`)
- Hours: "Open — closes at 9 PM" (**only** the closing time is confirmed; never assert an opening time)
- Google 5.0 from 95 reviews; Facebook 5/5
- Existing site: yalmangaming.com

**Do not fabricate**: customer testimonials or review text, warranty terms,
delivery times, brand partnerships or authorised-dealer claims, stock figures
presented as real, or benchmark numbers. Where the design calls for a review
quote and none exists, render the empty state instead.

## Do not modify these files

They are the shared contract; changing them breaks other people's work.

- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- `prisma/schema.prisma`
- `src/lib/types.ts`, `src/lib/compatibility.ts`, `src/lib/specs.ts`,
  `src/lib/utils.ts`, `src/lib/db.ts`, `src/lib/site.ts`
- `src/app/globals.css`, `src/app/layout.tsx`
- `src/components/ui/index.tsx`

Do **not** run `npm install`, add dependencies, or change the Prisma schema. If
you genuinely need something that is missing, note it in your final report
instead of installing it.

Installed and available: `next@15.5`, `react@19`, `three@0.180`,
`@react-three/fiber@9`, `@react-three/drei@10`, `framer-motion@12`, `gsap@3`,
`lucide-react`, `zod@3`, `@prisma/client@6`, `clsx`, `tailwind-merge`,
`bcryptjs`.

## Design system

Tailwind v4, tokens defined in `src/app/globals.css`. Use the token names, not
raw hex.

Surfaces (dark → light): `void` `carbon` `graphite` `steel` `slate` `iron`.
Text: `chrome` (primary), `silver` (secondary), `ash` (small essential text —
already contrast-checked). Accents: `cyan` `violet` `ember` `lime` `emerald`
`rose` `sky`. Borders: `line`, `line-strong`.

Utilities: `container-page`, `glass`, `glass-strong`, `metal`,
`text-chrome-gradient`, `text-accent-gradient`, `eyebrow`, `rule-fade`,
`grid-bg`, `vignette`, `glow-border`, `skeleton`, `tnum`, `no-scrollbar`,
`line-clamp-2`, `line-clamp-3`.

Fonts: `font-sans` (Inter, body), `font-display` (Space Grotesk, headings),
`font-mono` (JetBrains Mono — **all prices, wattage and spec values**, paired
with the `tnum` utility so digits do not jitter).

Tone: dark, metallic, premium. Neon is an accent for state and emphasis, never
a wash. The single highest-luminance element on any screen should be the
primary CTA. Avoid childish "gamer" styling — think luxury technology showroom.

**The strongest CTA site-wide is `BUILD YOUR PC` → `/builder`.**

## Money

Whole Pakistani Rupees, `Int` everywhere. Never floats, never decimals.
Format with `formatPKR` / `formatAmount` / `formatShortPKR` from
`@/lib/utils`. Pay-now price is `effectivePrice(product)`.

Every seeded price has `samplePrice: true`. Anywhere a price is shown, pass
that flag through to `<Price>` so the "sample" marker appears, and put
`<SamplePricingNote />` once per page that lists prices.

## Existing primitives — `@/components/ui`

```tsx
<Button variant="primary|secondary|ghost|outline|danger|success|whatsapp"
        size="sm|md|lg|xl|icon" loading={false} />
<ButtonLink href="..." variant size />   // same look, renders a Next <Link>
<Badge tone="neutral|cyan|violet|ember|emerald|rose|lime" />
<Price price={n} salePrice={n|null} samplePrice={bool} size="sm|md|lg|xl" />
<Rating value={4.5} count={95} size="sm|md|lg" />
<StockIndicator stock={n} lowStockAt={3} showCount={false} />
<Section id="..." /> <SectionHeading eyebrow title description align action />
<Card /> <Divider /> <EmptyState icon title description action />
<Skeleton /> <SkeletonCard />
<SpecList rows={[{label, value}]} />
<Meter value max label tone="cyan|emerald|ember|rose|violet" caption />
<SamplePricingNote /> <Spinner /> <VisuallyHidden />
```

## Domain types — `@/lib/types`

`ComponentKind` (`cpu` `motherboard` `gpu` `ram` `storage` `psu` `cooler`
`case` `fan` `os` `monitor` `keyboard` `mouse` `headset` `microphone` `webcam`
`chair` `controller` `mousepad` `speaker` `prebuilt`), `KIND_META`,
`BUILDER_STEP_KINDS`, `CORE_KINDS`, `PERIPHERAL_KINDS`.

`BUILD_GOALS`, `BUDGET_BANDS`, `RESOLUTIONS`, `FPS_TARGETS`, `POPULAR_GAMES`,
`ASSEMBLY_SERVICES`.

`BuilderPart` — the flat, serialisable part shape used by the builder and the
compatibility engine. `BuildSelection = Record<string, BuilderPart[]>`.
`BuildState` / `EMPTY_BUILD`. `CompatibilityReport`, `CompatibilityIssue`,
`PowerEstimate`. `SORT_OPTIONS`, `stockState()`.

## Compatibility engine — `@/lib/compatibility`

Already written and complete. Use it; do not reimplement or duplicate rules.

```ts
checkCompatibility(selection): CompatibilityReport   // errors block checkout
estimatePower(selection): PowerEstimate              // watts + recommended PSU
rankCandidates(kind, candidates, selection): CandidateVerdict[]
  // -> { part, compatible, warnings, blocker } — sort compatible first and
  //    show `blocker.title` as the reason an option is greyed out
partsOf / firstOf / allParts / partPrice / componentsTotal
hasSamplePricing / outOfStockParts
```

## Prisma → UI mapping — `@/lib/specs`

```ts
toBuilderPart(product): BuilderPart      // Prisma row -> BuilderPart
BUILDER_PART_SELECT                      // the `select` that satisfies it
parseSpecSheet(json) / groupSpecs(rows)  // product page spec tables
parseStringList / parseNumberMap / stringifyList / stringifyMap
```

Structured columns are **JSON text** (SQLite/Postgres portability). Always read
them through these helpers, never `JSON.parse` inline.

## Cross-area interfaces

These files are owned by one area but imported by others. Build against the
signature even if the file is not there yet.

### `@/components/shop/ProductCard`
```tsx
export type ProductCardData = {
  id: string; slug: string; name: string; kind: string;
  brandName: string | null; headline: string | null;
  price: number; salePrice: number | null; samplePrice: boolean;
  stock: number; rating: number; reviewCount: number;
  imageUrl: string | null; keySpec: string | null;
  isNew?: boolean; onDeal?: boolean;
};
export function ProductCard(props: {
  product: ProductCardData; className?: string; compact?: boolean;
}): JSX.Element;
```

### `@/lib/catalog` (server-only data access)
```ts
getProducts(opts): Promise<{ items: ProductCardData[]; total: number; facets: Facets }>
getProductBySlug(slug): Promise<FullProduct | null>
getPartsForKind(kind): Promise<BuilderPart[]>
getFeaturedProducts(limit): Promise<ProductCardData[]>
searchProducts(query, limit): Promise<ProductCardData[]>
getCategoryTree(): Promise<CategoryNode[]>
```

### `@/lib/build-store` (client build state)
```ts
useBuild(): {
  build: BuildState;
  report: CompatibilityReport;
  total: number; componentsSubtotal: number; servicesSubtotal: number;
  setPart(kind, part): void;      addPart(kind, part): void;
  removePart(kind, partId): void; clearKind(kind): void;
  setGoal / setBudget / setResolution / setTargetFps / setGames / setName: ...;
  toggleService(id): void; setAssembleForMe(on): void;
  reset(): void; loadBuild(state): void;
}
```
Persists to `localStorage` under `yalman:build:v1`. Must be SSR-safe (read
storage in `useEffect`, never during render).

### `@/components/cart/CartProvider`
```ts
useCart(): {
  items: CartLine[]; count: number; subtotal: number;
  open: boolean; setOpen(b): void;
  addProduct(p, qty?): void; addBuild(build, report): void;
  updateQty(lineId, qty): void; remove(lineId): void; clear(): void;
}
```
`<CartProvider>` wraps the store layout; `<CartDrawer />` renders the drawer.

### `@/components/three/*`
Every 3D entry point must be dynamically imported with `ssr: false`, render a
static fallback under `prefers-reduced-motion` or on low-power devices, and
never mount while off-screen.

## Routing map

```
/                          home
/shop                      all products + filters
/shop/[category]           category listing
/product/[slug]            product detail
/builder                   custom PC builder          <- signature feature
/builder/recommend         guided recommendation flow
/build/[shareCode]         shared/saved build
/compare                   product comparison
/deals /showcase /assembly /quote
/cart /checkout /checkout/success/[orderNumber]
/about /contact /warranty /returns /shipping /privacy /terms
/admin/*                   authenticated dashboard
/api/*                     route handlers
```

## Conventions

- Server Components by default. `"use client"` only where interaction demands
  it — push it to the leaves rather than the page.
- Data access lives in `src/lib/*`, imported by Server Components. Route
  handlers under `src/app/api/**` are for client mutations and third parties.
- Validate every request body with `zod` in the route handler. Never trust a
  client-sent price: re-read it from the database before writing an order.
- Re-run `checkCompatibility` **server-side** before persisting a build or
  accepting a build into the cart.
- Accessible by default: real `<button>`/`<a>`, labelled inputs, `aria-*` on
  custom widgets, keyboard paths for anything clickable, visible focus.
- Mobile-first. The builder becomes a stepper on small screens with the summary
  reachable from a sticky bar.
- Comment the non-obvious *why*, not the obvious *what*.
