# Yalman Gaming — Storefront & Custom PC Builder

E-commerce platform for **Yalman Gaming**, a gaming PC and computer hardware
store at Hafeez Centre, Gulberg III, Lahore.

The signature feature is the **Custom PC Builder**: a customer picks a budget and
a target resolution, and the site guides them through a compatible CPU,
motherboard, GPU, memory, storage, cooling, PSU and case while calculating
wattage and the total live. Nothing incompatible can reach the cart.

---

## Quick start

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Then open <http://localhost:3000>.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:compat` | **Compatibility engine regression suite (61 assertions)** |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:seed` | Load the sample catalog (idempotent — safe to re-run) |
| `npm run db:reset` | Drop and rebuild |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Three.js + React Three Fiber v9 + drei · Framer Motion · GSAP · Prisma 6 · Zod ·
bcryptjs.

---

## ⚠️ Before this goes live

These are deliberate, and each one is a decision for the store rather than a bug.

**1. Every price is sample data.** All 204 products carry `samplePrice: true`
and render a `sample` marker. They are realistic Lahore-market figures used to
build against — they are **not** quotes from Yalman Gaming. The admin dashboard
opens with a count of sample-priced products linking straight to a filtered list;
clearing that list is the first real job. Editing a product lets you clear the
flag once the price is confirmed.

**2. Warranty, returns, shipping, privacy and terms are templates.** Yalman
Gaming did not supply these terms, so none were invented. Each page has real
structure with every unconfirmed clause rendered as a visible
`[Yalman Gaming to confirm]` note. They are `noindex` and excluded from the
sitemap via `DRAFT_POLICY_PATHS` in `src/lib/seo.ts` — delete a path from that
array once its terms are real and the page becomes indexable and enters the
sitemap in one edit.

**3. There are zero customer reviews.** No testimonial text was written. The
`Review` table is empty and every product is rating 0 / reviewCount 0; the
storefront renders honest empty states. Reviews are entered from
`/admin/reviews` as real customers leave them. The 5.0 from 95 reviews shown on
the site is the store's **Google** rating, supplied by the owner.

**4. Benchmarks cover 12 of 24 GPUs and no CPUs.** A row was omitted wherever a
realistic figure was not known rather than invented. Missing data renders
"No verified data yet". Every figure displays its stored `source` and
`cpuContext`. The admin benchmark editor refuses to save a row without a source.

**5. Product images are placeholder line art.** There are no product
photographs. Each product points at `/images/placeholder/<kind>.svg` — 21
hand-drawn technical illustrations. Replace them with real photography from the
admin.

**6. Set `NEXT_PUBLIC_SITE_URL`.** It defaults to `http://localhost:3000`, and
every canonical URL, sitemap `<loc>`, OG image URL and JSON-LD `url` derives
from it. Ship without setting it and the whole SEO layer points at localhost.

**7. Change `AUTH_SECRET` and `ADMIN_PASSWORD`.** `.env` ships with development
values. `AUTH_SECRET` must be at least 16 characters or the login page fails
closed. Sessions last 12 hours; rotating the secret signs everyone out.

**8. No social links.** None were supplied, so none were guessed. Add them to
`src/lib/site.ts` when you have them.

**9. Card payments are not wired to a gateway.** Cash on Delivery and Bank
Transfer complete an order. "Card" places the order as payment-pending and
promises a secure payment link — the checkout **never** collects card numbers.
`src/lib/orders.ts` has a `PaymentMethod` abstraction so a real gateway drops in
without touching the checkout UI.

---

## Architecture

```
src/
  app/
    (store)/          storefront — layout owns the single <main id="main">
      page.tsx        homepage
      builder/        Custom PC Builder + /builder/recommend
      shop/           listing + /shop/[category]
      product/[slug]  product detail
      build/[code]    shared/saved build
      cart, checkout, compare, deals, showcase, assembly, quote
      about, contact, warranty, returns, shipping, privacy, terms
    admin/            authenticated dashboard (outside the store group)
    api/              route handlers
  components/
    ui/               shared primitives — everything imports from here
    builder/          PC builder
    shop/  cart/  checkout/  home/  layout/  admin/  content/  recommend/
    three/            R3F scenes, built from procedural geometry
  lib/
    types.ts          domain contract: kinds, builder flow, services
    compatibility.ts  the compatibility engine (pure functions)
    catalog.ts        server-side catalog access
    recommend.ts      budget → compatible build
    benchmarks.ts     stored FPS data only, never computed
    specs.ts  utils.ts  site.ts  db.ts  auth.ts  orders.ts  cart.ts  seo.ts
prisma/
  schema.prisma       24 models
  data/               the seed catalog, one file per component family
docs/CONTRACT.md      interface contract used to build this
```

### The compatibility engine

`src/lib/compatibility.ts` is pure and dependency-free, so the same code runs in
the browser for live feedback and on the server before a build is saved, quoted
or added to the cart — a client that skips the UI cannot push an impossible
build through.

It checks CPU/motherboard sockets, memory generation, slot count and capacity,
motherboard form factor against the case, GPU length and cooler height against
case clearances, radiator sizes, cooler socket support and capacity, PSU
capacity and headroom, PCIe power connectors (including the 12VHPWR adapter
case), M.2 and SATA port counts, and whether the build can output video at all.

Severities are meaningful: `error` blocks checkout, `warning` informs but
allows, `info` is a note. A rule stays silent when either side lacks the data it
needs — a missing spec never produces a false "incompatible".

**Two subtleties worth knowing before you change it:**

*Power is judged on sustained draw, not published TDP.* `tdp` means different
things per vendor — AMD publishes TDP (a 120W part pulls ~162W PPT) while Intel
publishes base power (a 125W part sustains ~250W PL2). Products therefore carry
a separate `peakPowerW`, and both the PSU sizing and the cooler-adequacy check
read it via `cpuSustainedWatts()`. `tdp` stays as the vendor's published figure
because that is what the product page displays.

*A part is only greyed out when the conflict is really its fault.* An issue
disqualifies a candidate only if every other component it implicates is already
chosen. Otherwise picking a CPU with no integrated graphics would grey itself
out over a graphics card the customer has not reached yet.

`npm run test:compat` runs 61 assertions against it.

### Data model portability

The schema deliberately avoids `enum`, scalar lists and the `Json` scalar so one
file runs on **SQLite** (dev) and **PostgreSQL** (production). Structured values
are stored as JSON text and read through typed helpers in `src/lib/specs.ts`
that degrade to `null` rather than throwing.

To move to Postgres: change the `datasource` provider to `postgresql`, point
`DATABASE_URL` at your instance, and run `npx prisma migrate deploy`. No model
changes.

### Money

Whole Pakistani Rupees as integers, everywhere. No floats, no decimals. Format
via `formatPKR` from `src/lib/utils.ts`, which deliberately does **not** use
`Intl` currency style — which symbol ICU emits for PKR varies by build, so the
number is formatted and the `PKR` label prefixed by hand for identical output on
every runtime.

---

## Admin

<http://localhost:3000/admin> — sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from `.env`.

Products (full CRUD with kind-aware compatibility spec fields), orders, saved
builds, quotes, review moderation, categories, showcase builds, coupons,
benchmarks and settings. Every mutation is a zod-validated route handler under
`/api/admin` that calls `requireAdmin()` first — `middleware.ts` redirects
unauthenticated page requests, but it is not the security boundary.

The login rate limiter is in-memory and per-process. It needs Redis before this
runs on more than one instance.

---

## Known limitations

- **Recommendation tuning.** The engine returns budget-correct, compatible
  builds, but its allocation weights are a first pass — a PKR 300,000 1440p/144
  request currently favours a modest GPU. Weights live in `BUILD_GOALS`
  (`src/lib/types.ts`) and `allocateBudget` (`src/lib/recommend.ts`).
  `achievable: true` means "a build fits the budget", not "it will hit that
  frame rate" — the frame rate claim is only ever made from stored benchmarks.
- **The 3D scenes draw impossible builds.** The visualiser grows the chassis to
  fit rather than refusing to render an ATX board in an ITX case. Telling the
  customer it does not fit is the compatibility engine's job; duplicating that
  judgement in geometry is how the picture and the warnings end up disagreeing.
- **No customer accounts.** Checkout is guest-only. The `Cart`/`CartItem` tables
  are unused — the cart is client-owned in `localStorage`, so a visitor needs no
  cookie or account.
- **Wishlist is header-only** and not reachable from a phone; there is no
  `/wishlist` page yet.
