import type { Metadata } from "next";
import Link from "next/link";

import { QuoteControls } from "@/components/admin/QuoteControls";
import { QUOTE_STATUSES } from "@/components/admin/schema";
import {
  ChipLink,
  ChipRow,
  DateText,
  Note,
  PageHeader,
  Pagination,
  Panel,
  StatusBadge,
} from "@/components/admin/ui";
import { EmptyState, SamplePricingNote } from "@/components/ui";
import {
  listAdminQuotes,
  parseQuoteSnapshot,
  snapshotRows,
  type AdminQuote,
} from "@/lib/admin-queries";
import { whatsappLink } from "@/lib/site";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Quote requests" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await listAdminQuotes({
    status: one(params.status),
    page: Number(one(params.page)) || 1,
  });

  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      status: result.status,
      page: result.page > 1 ? result.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return search ? `/admin/quotes?${search}` : "/admin/quotes";
  };

  const total = Object.values(result.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Enquiries"
        title="Quote requests"
        description="Everything the quote form, the contact form and the PC builder send in. Reply on WhatsApp, then move the request along."
      />

      <ChipRow>
        <ChipLink
          href={hrefWith({ status: null, page: null })}
          active={!result.status}
          count={total}
        >
          All
        </ChipLink>
        {QUOTE_STATUSES.map((status) => (
          <ChipLink
            key={status.id}
            href={hrefWith({ status: status.id, page: null })}
            active={result.status === status.id}
            count={result.statusCounts[status.id] ?? 0}
          >
            {status.label}
          </ChipLink>
        ))}
      </ChipRow>

      {result.items.length === 0 ? (
        <EmptyState
          title={result.status ? "Nothing in this status" : "No quote requests yet"}
          description={
            result.status
              ? "Clear the filter to see every request."
              : "The quote page, the contact form and the “ask about this build” action all write here."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {result.items.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}

      {/* Cards are their own panels, so paging only needs a frame when there
          is actually something to page through. */}
      {result.total > 0 && (
        <Panel padded={false}>
          <Pagination
            page={result.page}
            pages={result.pages}
            total={result.total}
            perPage={result.perPage}
            hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
            label="requests"
          />
        </Panel>
      )}

      <SamplePricingNote />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One request                                                                */
/* -------------------------------------------------------------------------- */

function QuoteCard({ quote }: { quote: AdminQuote }) {
  // The snapshot is what the customer actually asked about; the linked build
  // may have been edited since, so both are shown and the snapshot wins.
  const snapshot = parseQuoteSnapshot(quote.snapshot);
  const rows = snapshotRows(snapshot);

  const reply = whatsappLink(
    `Hello ${quote.name}, this is Yalman Gaming replying about the build you asked us to quote.`,
  );

  return (
    <article className="metal rounded-xl">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-semibold text-chrome">
              {quote.name}
            </h2>
            <StatusBadge options={QUOTE_STATUSES} id={quote.status} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ash">
            <a href={`tel:${quote.phone}`} className="tnum font-mono hover:text-cyan">
              {quote.phone}
            </a>
            {quote.email && (
              <a href={`mailto:${quote.email}`} className="hover:text-cyan">
                {quote.email}
              </a>
            )}
            {quote.city && <span>{quote.city}</span>}
            <DateText value={quote.createdAt} />
          </p>
        </div>

        <a
          href={reply}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#25D366] px-3 text-xs font-semibold text-[#04250f] transition-all hover:brightness-110"
        >
          Reply on WhatsApp
        </a>
      </header>

      <div className="grid gap-5 p-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 flex flex-col gap-4">
          {quote.message && (
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
                What they wrote
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-silver">
                {quote.message}
              </p>
            </div>
          )}

          {snapshot && (
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
                Build snapshot
              </p>
              <p className="mt-1 text-xs text-silver">
                {snapshot.name ?? "Custom build"}
                {snapshot.goal ? ` · ${snapshot.goal}` : ""}
                {snapshot.resolution ? ` · ${snapshot.resolution}` : ""}
                {snapshot.targetFps ? ` · ${snapshot.targetFps} FPS target` : ""}
                {typeof snapshot.estimatedWatts === "number"
                  ? ` · ${snapshot.estimatedWatts}W estimated`
                  : ""}
              </p>

              {rows.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {rows.map((row, index) => (
                    <li
                      key={`${row.label}-${index}`}
                      className="flex items-baseline justify-between gap-3 text-xs"
                    >
                      <span className="text-silver">
                        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                          {row.label}
                        </span>{" "}
                        {row.name}
                        {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                      </span>
                      <span className="tnum shrink-0 font-mono text-ash">
                        {formatPKR(row.unitPrice * row.quantity)}
                        {row.samplePrice ? " (sample)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {typeof snapshot.total === "number" && (
                <p className="mt-2 tnum font-mono text-sm text-chrome">
                  Snapshot total {formatPKR(snapshot.total)}
                </p>
              )}
            </div>
          )}

          {quote.build ? (
            <Note tone="info">
              Saved build{" "}
              <Link
                href={`/build/${quote.build.shareCode}`}
                className="font-mono text-cyan hover:text-white"
              >
                {quote.build.shareCode}
              </Link>{" "}
              — {quote.build._count.components} components,{" "}
              {formatPKR(quote.build.total)}, {quote.build.estimatedWatts}W estimated.
              It can still be opened in the builder at{" "}
              <Link
                href={`/builder?load=${quote.build.shareCode}`}
                className="text-cyan hover:text-white"
              >
                /builder?load={quote.build.shareCode}
              </Link>
              .
            </Note>
          ) : (
            !snapshot && (
              <Note>
                A general enquiry with no build attached — reply on WhatsApp and, if
                they want a machine spec&rsquo;d, build it in the PC builder and share
                the link.
              </Note>
            )
          )}
        </div>

        <QuoteControls quoteId={quote.id} status={quote.status} notes={quote.notes} />
      </div>
    </article>
  );
}
