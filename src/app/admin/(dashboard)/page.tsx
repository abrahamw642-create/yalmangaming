import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Tag } from "lucide-react";

import { ORDER_STATUSES, QUOTE_STATUSES } from "@/components/admin/schema";
import {
  DateText,
  EmptyRow,
  Money,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui";
import {
  getDashboardStats,
  getLowStockProducts,
  getRecentOrders,
  getRecentQuotes,
} from "@/lib/admin-queries";
import { KIND_META, isComponentKind } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, orders, quotes, lowStock] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(8),
    getRecentQuotes(6),
    getLowStockProducts(8),
  ]);

  const samplePercent =
    stats.products.total > 0
      ? Math.round((stats.samplePriced / stats.products.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yalman Gaming"
        title="Store dashboard"
        description="Everything the site is doing right now, and the work it is waiting on."
        action={
          <>
            <ButtonLink href="/admin/products/new" variant="secondary" size="sm">
              New product
            </ButtonLink>
            <ButtonLink href="/admin/orders" size="sm">
              Open orders
            </ButtonLink>
          </>
        }
      />

      {/* ---- The headline job -------------------------------------------- */}
      <SamplePricingTask
        count={stats.samplePriced}
        total={stats.products.total}
        percent={samplePercent}
      />

      {/* ---- Numbers ------------------------------------------------------ */}
      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders"
          value={stats.orders.total}
          caption={`${stats.orders.open} open · ${stats.orders.last30} in the last 30 days`}
          href="/admin/orders"
        />
        <StatCard
          label="Committed revenue"
          value={formatPKR(stats.revenue.allTime)}
          caption={`${formatPKR(stats.revenue.last30)} in the last 30 days. Excludes cancelled orders.`}
          tone="emerald"
          href="/admin/orders"
        />
        <StatCard
          label="Quote requests"
          value={stats.quotes.total}
          caption={
            stats.quotes.unanswered > 0
              ? `${stats.quotes.unanswered} still unanswered`
              : "All answered"
          }
          tone={stats.quotes.unanswered > 0 ? "ember" : "neutral"}
          href="/admin/quotes"
        />
        <StatCard
          label="Saved builds"
          value={stats.builds.total}
          caption={`${stats.builds.last30} configured in the last 30 days`}
          href="/admin/builds"
        />
        <StatCard
          label="Products"
          value={stats.products.total}
          caption={`${stats.products.active} live · ${stats.products.draft} draft`}
          href="/admin/products"
        />
        <StatCard
          label="Low stock"
          value={stats.stock.low}
          caption={`${stats.stock.out} out of stock entirely`}
          tone={stats.stock.low > 0 ? "ember" : "neutral"}
          href="/admin/products?flag=low-stock"
        />
        <StatCard
          label="Reviews awaiting approval"
          value={stats.reviews.pending}
          caption={`${stats.reviews.approved} published`}
          tone={stats.reviews.pending > 0 ? "violet" : "neutral"}
          href="/admin/reviews"
        />
        <StatCard
          label="Benchmark rows"
          value={stats.benchmarks}
          caption="Every published figure carries its source."
          href="/admin/benchmarks"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---- Recent orders --------------------------------------------- */}
        <Panel
          title="Latest orders"
          description="Newest first. Open one to change its status or read the build snapshot."
          padded={false}
          action={
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-xs text-cyan hover:text-white"
            >
              All orders <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <TableShell minWidth="38rem">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <EmptyRow
                  colSpan={4}
                  title="No orders yet"
                  description="Orders placed through the storefront checkout land here."
                />
              ) : (
                orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs text-cyan hover:text-white"
                      >
                        {order.orderNumber}
                      </Link>
                      <SubText>
                        <DateText value={order.createdAt} />
                      </SubText>
                    </Td>
                    <Td>
                      <span className="text-sm">{order.customerName}</span>
                      <SubText>
                        {order.city} · {order._count.items}{" "}
                        {order._count.items === 1 ? "line" : "lines"}
                      </SubText>
                    </Td>
                    <Td>
                      <StatusBadge options={ORDER_STATUSES} id={order.status} />
                    </Td>
                    <Td align="right">
                      <Money amount={order.total} />
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableShell>
        </Panel>

        {/* ---- Recent quotes --------------------------------------------- */}
        <Panel
          title="Latest quote requests"
          description="Customers who asked for a price on a build."
          padded={false}
          action={
            <Link
              href="/admin/quotes"
              className="inline-flex items-center gap-1 text-xs text-cyan hover:text-white"
            >
              All quotes <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <TableShell minWidth="38rem">
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Build</Th>
                <Th>Status</Th>
                <Th align="right">Reply</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <EmptyRow
                  colSpan={4}
                  title="No quote requests yet"
                  description="The quote form and the PC builder both write into this list."
                />
              ) : (
                quotes.map((quote) => (
                  <Tr key={quote.id}>
                    <Td>
                      <span className="text-sm">{quote.name}</span>
                      <SubText>
                        {quote.phone}
                        {quote.city ? ` · ${quote.city}` : ""}
                      </SubText>
                    </Td>
                    <Td>
                      {quote.build ? (
                        <>
                          <span className="font-mono text-xs text-chrome">
                            {quote.build.shareCode}
                          </span>
                          <SubText>{formatPKR(quote.build.total)}</SubText>
                        </>
                      ) : (
                        <span className="text-xs text-ash">General enquiry</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge options={QUOTE_STATUSES} id={quote.status} />
                    </Td>
                    <Td align="right">
                      <a
                        href={whatsappLink(
                          `Hello ${quote.name}, this is Yalman Gaming replying about your quote request.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#25D366] hover:brightness-125"
                      >
                        WhatsApp
                      </a>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableShell>
        </Panel>
      </div>

      {/* ---- Low stock ---------------------------------------------------- */}
      <Panel
        title="Running low"
        description="At or below each product's own low-stock threshold. Emptiest first."
        padded={false}
        action={
          <Link
            href="/admin/products?flag=low-stock"
            className="inline-flex items-center gap-1 text-xs text-cyan hover:text-white"
          >
            Filter the catalogue <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <TableShell minWidth="44rem">
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Type</Th>
              <Th align="right">In stock</Th>
              <Th align="right">Threshold</Th>
              <Th align="right">Price</Th>
            </tr>
          </thead>
          <tbody>
            {lowStock.length === 0 ? (
              <EmptyRow
                colSpan={5}
                title="Nothing is running low"
                description="Every active product is above its own low-stock threshold."
              />
            ) : (
              lowStock.map((product) => (
                <Tr key={product.id}>
                  <Td>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm text-chrome hover:text-cyan"
                    >
                      {product.name}
                    </Link>
                    <SubText>{product.sku}</SubText>
                  </Td>
                  <Td>
                    <span className="text-xs text-silver">
                      {isComponentKind(product.kind)
                        ? KIND_META[product.kind].label
                        : product.kind}
                    </span>
                  </Td>
                  <Td align="right">
                    <span
                      className={
                        product.stock <= 0
                          ? "tnum font-mono text-sm text-rose"
                          : "tnum font-mono text-sm text-ember"
                      }
                    >
                      {product.stock}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tnum font-mono text-xs text-ash">
                      {product.lowStockAt}
                    </span>
                  </Td>
                  <Td align="right">
                    <Money
                      amount={product.salePrice ?? product.price}
                      sample={product.samplePrice}
                    />
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableShell>
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sample pricing — the store's first real job on this system                  */
/* -------------------------------------------------------------------------- */

function SamplePricingTask({
  count,
  total,
  percent,
}: {
  count: number;
  total: number;
  percent: number;
}) {
  if (count === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald/25 bg-emerald/[0.06] px-4 py-3.5">
        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
        <div>
          <p className="text-sm font-semibold text-emerald">
            Every price is confirmed.
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-silver">
            No product is still carrying seeded sample pricing, so the storefront
            shows no sample markers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-ember/30 bg-ember/[0.07] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-ember" />
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ember/80">
              First job
            </p>
            <p className="mt-1 font-display text-xl font-bold text-chrome">
              <span className="tnum">{count}</span> of{" "}
              <span className="tnum">{total}</span> products still show sample
              pricing
            </p>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-silver">
              Those figures were seeded for development, not quoted by Yalman
              Gaming. Every one of them renders a &ldquo;sample&rdquo; marker on the
              storefront until you replace it with the real shelf price and clear
              the flag. Until then customers are being asked to treat the number as
              provisional.
            </p>
          </div>
        </div>
        <ButtonLink href="/admin/products?flag=sample" size="md" className="shrink-0">
          Replace sample prices
        </ButtonLink>
      </div>

      <div className="mt-4">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"
          role="meter"
          aria-valuenow={total - count}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Products with a confirmed price"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald to-lime"
            style={{ width: `${Math.max(0, 100 - percent)}%` }}
          />
        </div>
        <p className="mt-1.5 tnum font-mono text-[0.6875rem] text-ash">
          {total - count} of {total} confirmed
        </p>
      </div>
    </section>
  );
}
