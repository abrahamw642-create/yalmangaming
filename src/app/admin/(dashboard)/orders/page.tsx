import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/components/admin/schema";
import {
  ChipLink,
  ChipRow,
  DateText,
  EmptyRow,
  Money,
  PageHeader,
  Pagination,
  Panel,
  StatusBadge,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { SamplePricingNote } from "@/components/ui";
import { listAdminOrders } from "@/lib/admin-queries";
import { formatPkPhone } from "@/lib/validation";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await listAdminOrders({
    q: one(params.q),
    status: one(params.status),
    page: Number(one(params.page)) || 1,
  });

  const hrefWith = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      q: result.q,
      status: result.status,
      page: result.page > 1 ? result.page : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value !== null && value !== undefined && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return search ? `/admin/orders?${search}` : "/admin/orders";
  };

  const totalOrders = Object.values(result.statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Every order placed through the storefront checkout. Yalman Gaming confirms stock, pricing and the delivery charge by phone before anything is dispatched."
      />

      <ChipRow>
        <ChipLink
          href={hrefWith({ status: null, page: null })}
          active={!result.status}
          count={totalOrders}
        >
          All
        </ChipLink>
        {ORDER_STATUSES.map((status) => (
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
        {/* A plain GET form: order search is a URL, and it keeps working
            with JavaScript unavailable. */}
        <form
          action="/admin/orders"
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
              placeholder="Order number, name, phone, email or city"
              aria-label="Search orders"
              className="w-full rounded-lg border border-[var(--color-line-strong)] bg-carbon/80 py-2 pl-9 pr-3 text-sm text-chrome placeholder:text-ash/70 focus:border-cyan/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg border border-[var(--color-line-strong)] px-4 text-xs text-chrome transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            Search
          </button>
          {result.q && (
            <Link
              href={hrefWith({ q: null, page: null })}
              className="h-9 rounded-lg px-3 text-xs leading-9 text-silver hover:text-rose"
            >
              Clear
            </Link>
          )}
        </form>

        <TableShell minWidth="62rem">
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Delivery</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <EmptyRow
                colSpan={6}
                title={result.q || result.status ? "No orders match this view" : "No orders yet"}
                description={
                  result.q || result.status
                    ? "Clear the filter to see everything."
                    : "Orders placed through the storefront checkout appear here, newest first."
                }
              />
            ) : (
              result.items.map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs text-cyan hover:text-white"
                    >
                      {order.orderNumber}
                    </Link>
                    <SubText>
                      <DateText value={order.createdAt} /> · {order._count.items}{" "}
                      {order._count.items === 1 ? "line" : "lines"}
                    </SubText>
                  </Td>
                  <Td>
                    <span className="text-sm">{order.customerName}</span>
                    <SubText className="font-mono">
                      {formatPkPhone(order.customerPhone)}
                    </SubText>
                  </Td>
                  <Td>
                    <span className="text-xs text-silver">{order.city}</span>
                    <SubText>{order.province}</SubText>
                  </Td>
                  <Td>
                    <StatusBadge options={PAYMENT_STATUSES} id={order.paymentStatus} />
                    <SubText>{order.paymentMethod}</SubText>
                  </Td>
                  <Td>
                    <StatusBadge options={ORDER_STATUSES} id={order.status} />
                  </Td>
                  <Td align="right">
                    <Money amount={order.total} />
                    {order.discount > 0 && (
                      <SubText className="font-mono">
                        −{order.discount} {order.couponCode ?? ""}
                      </SubText>
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableShell>

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          perPage={result.perPage}
          hrefFor={(page) => hrefWith({ page: page > 1 ? page : null })}
          label="orders"
        />
      </Panel>

      <SamplePricingNote />
    </div>
  );
}
