import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { BuildControls } from "@/components/admin/BuildControls";
import { BUILD_STATUSES } from "@/components/admin/schema";
import {
  ChipLink,
  ChipRow,
  DateText,
  EmptyRow,
  Money,
  Note,
  PageHeader,
  Pagination,
  Panel,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { SamplePricingNote } from "@/components/ui";
import { listAdminBuilds } from "@/lib/admin-queries";
import { KIND_META, isComponentKind } from "@/lib/types";
import { formatPKR } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved builds" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBuildsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await listAdminBuilds({
    status: one(params.status),
    q: one(params.q),
    page: Number(one(params.page)) || 1,
  });

  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      status: result.status,
      q: result.q,
      page: result.page > 1 ? result.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return search ? `/admin/builds?${search}` : "/admin/builds";
  };

  const total = Object.values(result.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="PC builder"
        title="Saved builds"
        description="Every configuration a customer saved or shared. Open one in the builder to price it up or fix a compatibility problem with them on the phone."
      />

      <Note tone="info">
        A build opens in the storefront builder at{" "}
        <code className="font-mono text-cyan">/builder?load=&lt;code&gt;</code>, and
        the read-only share page lives at{" "}
        <code className="font-mono text-cyan">/build/&lt;code&gt;</code>.
      </Note>

      <ChipRow>
        <ChipLink
          href={hrefWith({ status: null, page: null })}
          active={!result.status}
          count={total}
        >
          All
        </ChipLink>
        {BUILD_STATUSES.map((status) => (
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

      <Panel padded={false}>
        <form
          action="/admin/builds"
          method="get"
          className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-4 py-3"
        >
          {result.status && <input type="hidden" name="status" value={result.status} />}
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ash" />
            <input
              type="search"
              name="q"
              defaultValue={result.q ?? ""}
              placeholder="Share code or build name"
              aria-label="Search saved builds"
              className="w-full rounded-lg border border-[var(--color-line-strong)] bg-carbon/80 py-2 pl-9 pr-3 text-sm text-chrome placeholder:text-ash/70 focus:border-cyan/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg border border-[var(--color-line-strong)] px-4 text-xs text-chrome transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            Search
          </button>
        </form>

        <TableShell minWidth="64rem">
          <thead>
            <tr>
              <Th>Build</Th>
              <Th>Intent</Th>
              <Th>Components</Th>
              <Th align="right">Power</Th>
              <Th align="right">Total</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <EmptyRow
                colSpan={6}
                title={
                  result.q || result.status
                    ? "No saved builds match this view"
                    : "No saved builds yet"
                }
                description="A build is saved here when a customer shares it, asks for a quote on it, or adds it to their cart."
              />
            ) : (
              result.items.map((build) => {
                const outOfStock = build.components.filter(
                  (component) => component.product.stock <= 0,
                );

                return (
                  <Tr key={build.id}>
                    <Td>
                      <Link
                        href={`/builder?load=${build.shareCode}`}
                        className="font-mono text-xs text-cyan hover:text-white"
                      >
                        {build.shareCode}
                      </Link>
                      <SubText className="truncate">{build.name}</SubText>
                      <SubText>
                        <DateText value={build.createdAt} />
                      </SubText>
                    </Td>

                    <Td>
                      <span className="text-xs text-silver">{build.goal ?? "—"}</span>
                      <SubText>
                        {[
                          build.resolution,
                          build.targetFps ? `${build.targetFps} FPS` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No target set"}
                      </SubText>
                    </Td>

                    <Td>
                      <details className="max-w-md">
                        <summary className="cursor-pointer text-xs text-cyan">
                          {build.components.length}{" "}
                          {build.components.length === 1 ? "part" : "parts"}
                          {outOfStock.length > 0 && (
                            <span className="ml-2 text-rose">
                              {outOfStock.length} out of stock
                            </span>
                          )}
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1">
                          {build.components.map((component) => (
                            <li
                              key={component.id}
                              className="flex items-baseline justify-between gap-3 text-xs"
                            >
                              <span className="text-silver">
                                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                                  {isComponentKind(component.kind)
                                    ? KIND_META[component.kind].label
                                    : component.kind}
                                </span>{" "}
                                <Link
                                  href={`/admin/products/${component.product.id}`}
                                  className="hover:text-cyan"
                                >
                                  {component.product.name}
                                </Link>
                                {component.quantity > 1 ? ` ×${component.quantity}` : ""}
                                {component.product.stock <= 0 && (
                                  <span className="ml-1.5 text-rose">out of stock</span>
                                )}
                              </span>
                              <span className="tnum shrink-0 font-mono text-ash">
                                {formatPKR(component.unitPrice * component.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </Td>

                    <Td align="right">
                      <span className="tnum font-mono text-sm text-chrome">
                        {build.estimatedWatts}W
                      </span>
                      <SubText className="font-mono">
                        PSU {build.recommendedPsuW}W
                      </SubText>
                    </Td>

                    <Td align="right">
                      <Money amount={build.total} />
                      <SubText className="font-mono">
                        parts {formatPKR(build.componentsTotal)}
                        {build.servicesTotal > 0
                          ? ` · services ${formatPKR(build.servicesTotal)}`
                          : ""}
                      </SubText>
                    </Td>

                    <Td align="right">
                      <BuildControls
                        buildId={build.id}
                        shareCode={build.shareCode}
                        status={build.status}
                        quotedCount={build._count.quoteRequests}
                        orderedCount={build._count.orderItems}
                      />
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </TableShell>

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          perPage={result.perPage}
          hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
          label="builds"
        />
      </Panel>

      <SamplePricingNote />
    </div>
  );
}
