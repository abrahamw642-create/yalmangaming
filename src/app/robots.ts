/**
 * `/robots.txt`
 *
 * Crawling is open — this is a shop that wants to be found for "gaming PC
 * Lahore" — with three exclusions:
 *
 *  - `/admin/` is staff-only and gated by `src/middleware.ts` anyway. Keeping
 *    it out of the crawl saves the login page being indexed.
 *  - `/api/` returns JSON; nothing there belongs in a search result.
 *  - `/cart`, `/checkout` and `/build/` are per-visitor. A share code is
 *    effectively a secret URL, so it must not be crawled.
 *
 * `Disallow` is a crawling instruction, not an indexing one — a disallowed URL
 * can still be indexed from an external link. The pages that must not be
 * *indexed* (the unpublished policy templates) carry a `noindex` tag instead,
 * which requires the crawler to be allowed to read them. That is why those
 * paths are absent from this list.
 */

import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/cart", "/checkout", "/build/"],
      },
    ],
    // No `host` directive: it is a Yandex extension that Google ignores, and
    // Next emits whatever string it is given verbatim — a full origin there
    // would be malformed for the one crawler that does read it.
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
