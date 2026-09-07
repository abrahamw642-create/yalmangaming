/**
 * Yalman Gaming — business facts.
 *
 * Everything in this file was supplied by the store owner. Do not add claims,
 * warranties, partnerships or testimonials here that Yalman Gaming has not
 * confirmed.
 */

export const siteConfig = {
  name: "Yalman Gaming",
  legalName: "Yalman Gaming",
  tagline: "Build the machine you actually want.",
  description:
    "Gaming PCs, premium components and custom builds engineered for performance. Visit us at Hafeez Centre, Gulberg III, Lahore — or configure your build online.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  existingSite: "https://yalmangaming.com",
  locale: "en_PK",
  currency: "PKR",
} as const;

export const contact = {
  phoneDisplay: process.env.NEXT_PUBLIC_STORE_PHONE ?? "0328 4400231",
  /** E.164 without the leading +, for tel: and wa.me links. */
  phoneE164: "923284400231",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "923284400231",
} as const;

export const storeAddress = {
  floor: "3rd Floor",
  building: "Hafeez Centre",
  shop: "Shop #12-A",
  block: "Block E-1, Gulberg III",
  city: "Lahore",
  postalCode: "54660",
  country: "Pakistan",
  countryCode: "PK",
  /** Single-line form used in the footer and structured data. */
  oneLine:
    "3rd Floor, Hafeez Centre, Shop #12-A, Block E-1 Gulberg III, Lahore 54660, Pakistan",
  lines: [
    "3rd Floor, Hafeez Centre",
    "Shop #12-A",
    "Block E-1 Gulberg III",
    "Lahore, 54660",
    "Pakistan",
  ],
} as const;

/**
 * Hours as supplied: "Open — Closes at 9 PM". Only the closing time is
 * confirmed, so opening time is not asserted anywhere on the site and the
 * structured data below states the closing time only.
 */
export const businessHours = {
  closingTime: "9 PM",
  closingTime24: "21:00",
  summary: "Open now — closes at 9 PM",
  note: "Call ahead to confirm timings on public holidays.",
} as const;

/**
 * Ratings supplied by the store owner. `reviewCount` refers to Google reviews.
 * The site never invents individual review text to go with these numbers.
 */
export const ratings = {
  google: { score: 5.0, count: 95, label: "Google" },
  facebook: { score: 5.0, count: null as number | null, label: "Facebook" },
} as const;

export const mapsQuery = encodeURIComponent(
  "Yalman Gaming, Hafeez Centre, Gulberg III, Lahore",
);

export const mapsLinks = {
  directions: `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`,
  place: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
  embed: `https://www.google.com/maps?q=${mapsQuery}&output=embed`,
} as const;

export const telLink = `tel:+${contact.phoneE164}`;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string; hint?: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Custom PC Builder", href: "/builder" },
  {
    label: "Gaming PCs",
    href: "/shop/gaming-pcs",
    children: [
      // The tiers are real Category rows, not a `?tier=` filter — there is no
      // such column on Product and nothing parses that parameter. Link the
      // category slugs directly so every consumer of NAV_ITEMS is correct.
      { label: "Prebuilt Gaming PCs", href: "/shop/gaming-pcs" },
      { label: "Entry Gaming PCs", href: "/shop/entry-gaming-pcs" },
      { label: "Mid-Range Gaming PCs", href: "/shop/mid-range-gaming-pcs" },
      { label: "High-End Gaming PCs", href: "/shop/high-end-gaming-pcs" },
      { label: "Extreme Gaming PCs", href: "/shop/extreme-gaming-pcs" },
    ],
  },
  {
    label: "Components",
    href: "/shop/components",
    children: [
      { label: "Graphics Cards", href: "/shop/graphics-cards" },
      { label: "Processors", href: "/shop/processors" },
      { label: "Motherboards", href: "/shop/motherboards" },
      { label: "Memory", href: "/shop/memory" },
      { label: "Storage", href: "/shop/storage" },
      { label: "Cooling", href: "/shop/cooling" },
      { label: "Power Supplies", href: "/shop/power-supplies" },
      { label: "PC Cases", href: "/shop/cases" },
    ],
  },
  {
    label: "Accessories",
    href: "/shop/accessories",
    children: [
      { label: "Gaming Monitors", href: "/shop/monitors" },
      { label: "Keyboards", href: "/shop/keyboards" },
      { label: "Mice", href: "/shop/mice" },
      { label: "Headsets", href: "/shop/headsets" },
      { label: "Chairs", href: "/shop/chairs" },
      { label: "Controllers", href: "/shop/controllers" },
    ],
  },
  { label: "Deals", href: "/deals" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Shop",
    links: [
      { label: "All Products", href: "/shop" },
      { label: "Gaming PCs", href: "/shop/gaming-pcs" },
      { label: "Components", href: "/shop/components" },
      { label: "Accessories", href: "/shop/accessories" },
      { label: "Deals", href: "/deals" },
      { label: "Compare", href: "/compare" },
    ],
  },
  {
    heading: "Build",
    links: [
      { label: "Custom PC Builder", href: "/builder" },
      { label: "Build Recommendations", href: "/builder/recommend" },
      { label: "Built by Yalman", href: "/showcase" },
      { label: "We Build It For You", href: "/assembly" },
      { label: "Request a Quote", href: "/quote" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Visit the Store", href: "/contact#store" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Warranty", href: "/warranty" },
      { label: "Returns", href: "/returns" },
      { label: "Shipping", href: "/shipping" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Why Yalman Gaming                                                          */
/* -------------------------------------------------------------------------- */

export const WHY_POINTS: {
  title: string;
  detail: string;
  icon: string;
  accent: string;
}[] = [
  {
    title: "Custom PC Builds",
    detail:
      "Configure every part yourself, or tell us your budget and target games and we will spec it with you.",
    icon: "wrench",
    accent: "cyan",
  },
  {
    title: "Genuine Components",
    detail:
      "Parts sourced from the brands we stock, with their manufacturer warranty intact.",
    icon: "badge-check",
    accent: "violet",
  },
  {
    title: "Expert Hardware Advice",
    detail:
      "Talk to people who build these machines daily — in the shop or on WhatsApp.",
    icon: "message-circle",
    accent: "ember",
  },
  {
    title: "Performance Tested",
    detail:
      "Every machine we assemble is benchmarked and stress tested before it leaves the bench.",
    icon: "activity",
    accent: "emerald",
  },
  {
    title: "Local Lahore Store",
    detail:
      "Hafeez Centre, Gulberg III. Walk in, see the parts, take your build home.",
    icon: "map-pin",
    accent: "rose",
  },
  {
    title: "5.0 ★ Customer Rating",
    detail:
      "Rated 5.0 from 95 Google reviews by Lahore's gaming community.",
    icon: "star",
    accent: "cyan",
  },
];

/* -------------------------------------------------------------------------- */
/* Structured data                                                            */
/* -------------------------------------------------------------------------- */

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ComputerStore",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    telephone: `+${contact.phoneE164}`,
    priceRange: "PKR",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${storeAddress.floor}, ${storeAddress.building}, ${storeAddress.shop}`,
      addressLocality: storeAddress.city,
      addressRegion: "Punjab",
      postalCode: storeAddress.postalCode,
      addressCountry: storeAddress.countryCode,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: ratings.google.score,
      reviewCount: ratings.google.count,
      bestRating: 5,
    },
    areaServed: { "@type": "City", name: "Lahore" },
    sameAs: [siteConfig.existingSite],
  };
}
