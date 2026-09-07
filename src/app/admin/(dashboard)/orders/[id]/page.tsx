import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/components/admin/schema";
import {
  DateText,
  Money,
  Note,
  PageHeader,
  Panel,
  StatusBadge,
  SubText,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui";
import { SamplePricingNote, SpecList } from "@/components/ui";
import { getAdminOrder } from "@/lib/admin-queries";
import { parseOrderItemMeta } from "@/lib/orders";
import { whatsappLink } from "@/lib/site";
import { KIND_META, isComponentKind } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import { formatPkPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getAdminOrder(id);
  return { title: order ? `Order ${order.orderNumber}` : "Order not found" };
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const hasSamplePricing = order.items.some((item) => item.product?.samplePrice);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/admin/orders" className="hover:text-white">
              Orders
            </Link>{" "}
            / {order.orderNumber}
          </>
        }
        title={
          <span className="font-mono tracking-tight">{order.orderNumber}</span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge options={ORDER_STATUSES} id={order.status} />
            <StatusBadge options={PAYMENT_STATUSES} id={order.paymentStatus} />
            <span className="text-xs text-ash">
              Placed <DateText value={order.createdAt} />
            </span>
          </span>
        }
        action={
          <a
            href={whatsappLink(
              `Hello ${order.customerName}, this is Yalman Gaming about order ${order.orderNumber}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-[#04250f] transition-all hover:brightness-110"
          >
            Message on WhatsApp
          </a>
        }
      />

      {order.notes && <Note tone="warn">{order.notes}</Note>}

      {hasSamplePricing && (
        <Note tone="warn">
          One or more lines on this order are still priced from seeded sample data.
          Confirm the real figures with the customer before taking payment.
        </Note>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* ---- Lines --------------------------------------------------- */}
          <Panel
            title="Items"
            description="Prices are what the customer was charged, captured when the order was placed."
            padded={false}
          >
            <TableShell minWidth="42rem">
              <thead>
                <tr>
                  <Th>Line</Th>
                  <Th align="right">Unit</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const meta = parseOrderItemMeta(item.meta);

                  return (
                    <Tr key={item.id}>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-chrome">{item.name}</span>
                          {item.product && (
                            <SubText className="font-mono">
                              {item.product.sku}
                              {item.product.samplePrice ? " · sample price" : ""}
                            </SubText>
                          )}
                          {item.build && (
                            <SubText className="font-mono">
                              Saved build {item.build.shareCode} · {item.build.status}
                            </SubText>
                          )}
                          {!item.productId && !item.buildId && !meta && (
                            <SubText>
                              The catalogue record for this line has since been removed.
                            </SubText>
                          )}
                          {meta && <BuildSnapshot meta={meta} />}
                        </div>
                      </Td>
                      <Td align="right">
                        <Money amount={item.unitPrice} />
                      </Td>
                      <Td align="right">
                        <span className="tnum font-mono text-sm">{item.quantity}</span>
                      </Td>
                      <Td align="right">
                        <Money amount={item.unitPrice * item.quantity} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableShell>

            <div className="border-t border-[var(--color-line)] px-4 py-3">
              <SpecList
                rows={[
                  { label: "Subtotal", value: formatPKR(order.subtotal) },
                  ...(order.discount > 0
                    ? [
                        {
                          label: `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`,
                          value: `− ${formatPKR(order.discount)}`,
                        },
                      ]
                    : []),
                  { label: "Delivery (estimate)", value: formatPKR(order.delivery) },
                  { label: "Total", value: formatPKR(order.total) },
                ]}
              />
            </div>
          </Panel>

          {/* ---- Customer ------------------------------------------------ */}
          <Panel title="Customer and delivery address">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
                  Contact
                </p>
                <p className="mt-1.5 text-sm text-chrome">{order.customerName}</p>
                <p className="tnum font-mono text-sm text-silver">
                  <a href={`tel:${order.customerPhone}`} className="hover:text-cyan">
                    {formatPkPhone(order.customerPhone)}
                  </a>
                </p>
                {order.customerEmail && (
                  <p className="text-sm text-silver">
                    <a href={`mailto:${order.customerEmail}`} className="hover:text-cyan">
                      {order.customerEmail}
                    </a>
                  </p>
                )}
                {order.user && (
                  <p className="mt-1 text-xs text-ash">
                    Signed-in account: {order.user.email}
                  </p>
                )}
              </div>

              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
                  Deliver to
                </p>
                <address className="mt-1.5 text-sm not-italic leading-relaxed text-silver">
                  {order.addressLine1}
                  <br />
                  {order.addressLine2 && (
                    <>
                      {order.addressLine2}
                      <br />
                    </>
                  )}
                  {order.city}
                  {order.postal ? ` ${order.postal}` : ""}
                  <br />
                  {order.province}
                </address>
                {order.instructions && (
                  <p className="mt-2 rounded-lg border border-[var(--color-line)] px-2.5 py-2 text-xs leading-relaxed text-silver">
                    <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                      Instructions:{" "}
                    </span>
                    {order.instructions}
                  </p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* ---- Controls -------------------------------------------------- */}
        <div className="flex flex-col gap-5">
          <Panel title="Update this order">
            <OrderStatusForm
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
              notes={order.notes}
            />
          </Panel>

          <Panel title="Payment method">
            <p className="font-mono text-sm text-chrome">{order.paymentMethod}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ash">
              No card details are ever collected on this website. Card orders are
              placed as payment pending and completed through a link the store sends.
            </p>
          </Panel>
        </div>
      </div>

      <SamplePricingNote />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Build line snapshot                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A build line stores its whole configuration as JSON on `OrderItem.meta`, so
 * the order stays readable even after the customer edits or deletes the saved
 * build it came from.
 */
function BuildSnapshot({
  meta,
}: {
  meta: NonNullable<ReturnType<typeof parseOrderItemMeta>>;
}) {
  return (
    <details className="mt-1 rounded-lg border border-[var(--color-line)] bg-carbon/50 px-3 py-2">
      <summary className="cursor-pointer text-xs text-cyan">
        {meta.components.length} components · {meta.services.length} services ·{" "}
        {meta.estimatedWatts}W estimated
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <ul className="flex flex-col gap-1">
          {meta.components.map((component) => (
            <li
              key={`${component.productId}-${component.kind}`}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-silver">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-ash">
                  {isComponentKind(component.kind)
                    ? KIND_META[component.kind].label
                    : component.kind}
                </span>{" "}
                {component.name}
                {component.quantity > 1 ? ` ×${component.quantity}` : ""}
              </span>
              <span className="tnum shrink-0 font-mono text-ash">
                {formatPKR(component.unitPrice * component.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {meta.services.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-[var(--color-line)] pt-2">
            {meta.services.map((service) => (
              <li
                key={service.id}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-silver">{service.label}</span>
                <span className="tnum shrink-0 font-mono text-ash">
                  {service.price === 0 ? "Included" : formatPKR(service.price)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-[var(--color-line)] pt-2 text-xs text-ash">
          <p>
            Components {formatPKR(meta.componentsSubtotal)} · Services{" "}
            {formatPKR(meta.servicesSubtotal)}
          </p>
          <p className="mt-0.5">
            Estimated draw {meta.estimatedWatts}W · recommended PSU{" "}
            {meta.recommendedPsuW}W
          </p>
          {meta.shareCode && (
            <p className="mt-0.5">
              Shared as{" "}
              <Link href={`/build/${meta.shareCode}`} className="text-cyan hover:text-white">
                /build/{meta.shareCode}
              </Link>
            </p>
          )}
          {meta.compatibility.issues.length > 0 && (
            <p className="mt-1 text-ember/90">
              Compatibility at checkout: {meta.compatibility.status} —{" "}
              {meta.compatibility.issues.map((issue) => issue.title).join("; ")}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
