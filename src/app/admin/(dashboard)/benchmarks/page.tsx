import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  BenchmarkManager,
  type BenchmarkRow,
} from "@/components/admin/BenchmarkManager";
import {
  Note,
  PageHeader,
  Pagination,
  Panel,
  StatCard,
} from "@/components/admin/ui";
import {
  getBenchmarkCoverage,
  listBenchmarks,
  listBenchmarkTargets,
} from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Benchmarks" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBenchmarksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const productId = one(params.productId);

  const [result, targets, coverage] = await Promise.all([
    listBenchmarks({
      q: one(params.q),
      productId,
      page: Number(one(params.page)) || 1,
    }),
    listBenchmarkTargets(),
    getBenchmarkCoverage(),
  ]);

  const rows: BenchmarkRow[] = result.items.map((row) => ({
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    game: row.game,
    resolution: row.resolution,
    preset: row.preset,
    avgFps: row.avgFps,
    onePercentLow: row.onePercentLow,
    source: row.source,
    cpuContext: row.cpuContext,
    notes: row.notes,
  }));

  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      q: result.q,
      productId: result.productId,
      page: result.page > 1 ? result.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return search ? `/admin/benchmarks?${search}` : "/admin/benchmarks";
  };

  const focused = productId
    ? targets.find((target) => target.id === productId)
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Evidence"
        title="Benchmarks"
        description="Measured frame rates, each published with the source it came from and the CPU it was measured on."
      />

      <Note tone="warn">
        <strong className="font-semibold">Never fill a gap with a guess.</strong> A
        product with no rows shows &ldquo;No verified data yet&rdquo; on the
        storefront, and that is the correct thing for it to say. Every row saved here
        needs a non-empty source, because the source is printed beside the number.
      </Note>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Rows"
          value={result.total}
          caption="Across every product."
        />
        <StatCard
          label="Graphics cards covered"
          value={`${coverage.gpu.covered} / ${coverage.gpu.total}`}
          caption={`${coverage.gpu.total - coverage.gpu.covered} cards have no verified figures.`}
          tone={coverage.gpu.covered < coverage.gpu.total ? "ember" : "emerald"}
        />
        <StatCard
          label="Processors covered"
          value={`${coverage.cpu.covered} / ${coverage.cpu.total}`}
          caption={`${coverage.cpu.total - coverage.cpu.covered} processors have no verified figures.`}
          tone={coverage.cpu.covered < coverage.cpu.total ? "ember" : "emerald"}
        />
      </section>

      <Panel padded={false}>
        <form
          action="/admin/benchmarks"
          method="get"
          className="flex flex-wrap items-center gap-2 px-4 py-3"
        >
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ash" />
            <input
              type="search"
              name="q"
              defaultValue={result.q ?? ""}
              placeholder="Game, source or product"
              aria-label="Search benchmarks"
              className="w-full rounded-lg border border-[var(--color-line-strong)] bg-carbon/80 py-2 pl-9 pr-3 text-sm text-chrome placeholder:text-ash/70 focus:border-cyan/60 focus:outline-none"
            />
          </div>

          <select
            name="productId"
            defaultValue={result.productId ?? ""}
            aria-label="Filter by product"
            className="h-9 min-w-48 rounded-lg border border-[var(--color-line-strong)] bg-carbon/80 px-3 text-sm text-chrome focus:border-cyan/60 focus:outline-none"
          >
            <option value="">All products</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({target.benchmarkCount})
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="h-9 rounded-lg border border-[var(--color-line-strong)] px-4 text-xs text-chrome transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            Filter
          </button>

          {(result.q || result.productId) && (
            <Link
              href="/admin/benchmarks"
              className="h-9 rounded-lg px-3 text-xs leading-9 text-silver hover:text-rose"
            >
              Clear
            </Link>
          )}
        </form>
      </Panel>

      {focused && (
        <Note tone="info">
          Showing figures for <strong>{focused.name}</strong> only.{" "}
          <Link
            href={`/admin/products/${focused.id}`}
            className="text-cyan hover:text-white"
          >
            Open the product
          </Link>
          .
        </Note>
      )}

      <BenchmarkManager
        rows={rows}
        targets={targets}
        presetProductId={result.productId ?? undefined}
      />

      {result.total > 0 && (
        <Panel padded={false}>
          <Pagination
            page={result.page}
            pages={result.pages}
            total={result.total}
            perPage={result.perPage}
            hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
            label="rows"
          />
        </Panel>
      )}
    </div>
  );
}
