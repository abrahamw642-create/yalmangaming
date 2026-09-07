import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Cpu,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  Zap,
} from "lucide-react";
import { Badge, ButtonLink, Card, SamplePricingNote } from "@/components/ui";
import { PrintButton } from "@/components/checkout/OrderSummary";
import { formatDate, formatPKR, pluralize } from "@/lib/utils";
import { DELIVERY_LABEL, DELIVERY_NOTE, paymentMethodOption } from "@/lib/cart";
import { getOrderByNumber, parseOrderItemMeta, preparePayment } from "@/lib/orders";
import {
  PAYMENT_METHOD_IDS,
  formatPkPhone,
  type PaymentMethodId,
} from "@/lib/validation";
import { businessHours, contact, storeAddress, telLink, whatsappLink } from "@/lib/site";

type PageProps = {
  // Next 15: dynamic params arrive as a promise.
  params: Promise<{ orderNumber: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order ${decodeURIComponent(orderNumber)}`,
    // A confirmation contains a customer's address. It must never be indexed.
    robots: { index: false, follow: false, nocache: true },
  };
}

function isPaymentMethodId(value: string): value is PaymentMethodId {
  return (PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

export default async function OrderSuccessPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const method: PaymentMethodId = isPaymentMethodId(order.paymentMethod)
    ? order.paymentMethod
    : "cod";
  const option = paymentMethodOption(method);

  // The same handler that ran when the order was written, so the instructions
  // on this page can never drift from what actually happened.
  const payment = preparePayment(method, {
    orderNumber: order.orderNumber,
    total: order.total,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    city: order.city,
  });

  const items = order.items.map((item) => ({
    ...item,
    build: parseOrderItemMeta(item.meta),
  }));

  const hasSamplePricing = items.some(
    (item) => item.product?.samplePrice || item.build?.samplePrice,
  );

  const whatsapp = whatsappLink(
    `Hi Yalman Gaming, I have just placed order ${order.orderNumber} on the website for ${formatPKR(order.total)}. Please confirm.`,
  );

  return (
    <div className="container-page py-10 md:py-14 print:text-black">
      {/* --- Confirmation ------------------------------------------------- */}
      <header className="text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10 text-emerald print:hidden"
          aria-hidden="true"
        >
          <CheckCircle2 size={28} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-chrome-gradient sm:text-4xl print:text-black">
          Order placed
        </h1>
        <p className="mt-2 text-sm text-silver print:text-neutral-700">
          Thank you, {order.customerName.split(" ")[0]}. Yalman Gaming has your
          order and will confirm it with you directly.
        </p>

        <p className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 print:border-black/20 print:bg-white">
          <span className="text-xs uppercase tracking-wider text-ash print:text-neutral-700">
            Order number
          </span>
          <span className="tnum font-mono text-lg font-semibold text-chrome print:text-black">
            {order.orderNumber}
          </span>
        </p>

        <p className="mt-2 text-xs text-ash print:text-neutral-700">
          Placed {formatDate(order.createdAt)}
        </p>
      </header>

      {/* --- Actions ------------------------------------------------------- */}
      <div className="no-print mt-7 flex flex-wrap justify-center gap-3">
        <ButtonLink
          href={whatsapp}
          variant="whatsapp"
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} aria-hidden="true" />
          CONFIRM ON WHATSAPP
        </ButtonLink>
        <PrintButton label="PRINT ORDER" />
        <ButtonLink href="/shop" variant="ghost" size="md">
          Continue shopping
        </ButtonLink>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8">
        {/* --- Itemised order --------------------------------------------- */}
        <Card className="p-5 print:border-black/20 print:bg-white sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-chrome print:text-black">
            <Receipt size={18} className="text-cyan print:hidden" aria-hidden="true" />
            What you ordered
          </h2>

          <ul className="mt-4">
            {items.map((item) => (
              <li key={item.id} className="border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0 print:border-black/15">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {item.build && (
                      <p className="eyebrow mb-1 flex items-center gap-1.5 print:text-neutral-700">
                        <Cpu size={12} aria-hidden="true" />
                        Custom build
                      </p>
                    )}
                    <p className="font-medium text-chrome print:text-black">
                      {item.product && item.productId ? (
                        <Link
                          href={`/product/${item.product.slug}`}
                          className="transition-colors hover:text-cyan"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </p>
                    <p className="tnum mt-0.5 font-mono text-xs text-ash print:text-neutral-700">
                      {item.quantity} × {formatPKR(item.unitPrice)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum font-mono font-semibold text-chrome print:text-black">
                      {formatPKR(item.unitPrice * item.quantity)}
                    </p>
                    {(item.product?.samplePrice || item.build?.samplePrice) && (
                      <p
                        className="font-mono text-[0.625rem] uppercase tracking-wider text-ash print:text-neutral-700"
                        title="Sample pricing seeded for development. Yalman Gaming confirms final pricing."
                      >
                        sample
                      </p>
                    )}
                  </div>
                </div>

                {item.build && (
                  <div className="mt-3 border-l border-line pl-3 print:border-black/15">
                    <ul className="space-y-1">
                      {item.build.components.map((component) => (
                        <li
                          key={component.productId}
                          className="flex items-baseline justify-between gap-4 text-xs"
                        >
                          <span className="min-w-0 text-silver print:text-neutral-700">
                            {component.quantity > 1 && (
                              <span className="tnum mr-1 font-mono text-ash print:text-neutral-700">
                                {component.quantity}×
                              </span>
                            )}
                            {component.name}
                          </span>
                          <span className="tnum shrink-0 font-mono text-ash print:text-neutral-700">
                            {formatPKR(component.unitPrice * component.quantity)}
                          </span>
                        </li>
                      ))}
                      {item.build.services.map((service) => (
                        <li
                          key={service.id}
                          className="flex items-baseline justify-between gap-4 text-xs"
                        >
                          <span className="text-silver print:text-neutral-700">
                            {service.label}
                          </span>
                          <span className="tnum shrink-0 font-mono text-ash print:text-neutral-700">
                            {service.price === 0 ? "Included" : formatPKR(service.price)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {item.build.estimatedWatts > 0 && (
                      <p className="tnum mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-ash print:text-neutral-700">
                        <Zap size={11} aria-hidden="true" />
                        {item.build.estimatedWatts}W estimated draw ·{" "}
                        {item.build.recommendedPsuW}W PSU recommended
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* --- Totals ---------------------------------------------------- */}
          <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm print:border-black/15">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-silver print:text-neutral-700">Subtotal</dt>
              <dd className="tnum font-mono font-medium text-chrome print:text-black">
                {formatPKR(order.subtotal)}
              </dd>
            </div>

            {order.discount > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-silver print:text-neutral-700">
                  Coupon discount
                  {order.couponCode && (
                    <span className="ml-1.5 font-mono text-xs uppercase tracking-wider text-ash print:text-neutral-700">
                      {order.couponCode}
                    </span>
                  )}
                </dt>
                <dd className="tnum font-mono font-medium text-emerald print:text-black">
                  −{formatPKR(order.discount)}
                </dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-silver print:text-neutral-700">{DELIVERY_LABEL}</dt>
              <dd className="tnum font-mono font-medium text-chrome print:text-black">
                {formatPKR(order.delivery)}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3 print:border-black/15">
              <dt className="font-display font-semibold text-chrome print:text-black">
                Total
              </dt>
              <dd className="tnum font-display text-2xl font-semibold text-chrome print:text-black">
                {formatPKR(order.total)}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ash print:text-neutral-700">
            {DELIVERY_NOTE}
          </p>

          {hasSamplePricing && <SamplePricingNote className="mt-4" />}
        </Card>

        {/* --- Next steps -------------------------------------------------- */}
        <div className="space-y-6">
          <Card className="p-5 print:border-black/20 print:bg-white sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-chrome print:text-black">
                What happens next
              </h2>
              <Badge tone="ember">Awaiting confirmation</Badge>
            </div>

            <ol className="mt-4 space-y-3">
              {payment.instructions.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-silver print:text-neutral-700">
                  <span
                    className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[0.625rem] text-cyan print:border-black/20 print:text-black"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            {option && (
              <p className="mt-4 border-t border-line pt-4 text-xs text-ash print:border-black/15 print:text-neutral-700">
                Payment method:{" "}
                <span className="font-medium text-silver print:text-black">
                  {option.label}
                </span>
              </p>
            )}
          </Card>

          {/* --- Delivery details ---------------------------------------- */}
          <Card className="p-5 print:border-black/20 print:bg-white sm:p-6">
            <h2 className="font-display text-lg font-semibold text-chrome print:text-black">
              Delivering to
            </h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic leading-relaxed text-silver print:text-neutral-700">
              <p className="font-medium text-chrome print:text-black">
                {order.customerName}
              </p>
              <p className="tnum font-mono">{formatPkPhone(order.customerPhone)}</p>
              {order.customerEmail && <p>{order.customerEmail}</p>}
              <p className="pt-2">{order.addressLine1}</p>
              {order.addressLine2 && <p>{order.addressLine2}</p>}
              <p>
                {order.city}, {order.province}
                {order.postal ? ` ${order.postal}` : ""}
              </p>
            </address>

            {order.instructions && (
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ash print:border-black/15 print:text-neutral-700">
                <span className="font-medium text-silver print:text-black">
                  Instructions:
                </span>{" "}
                {order.instructions}
              </p>
            )}
          </Card>

          {/* --- Store ----------------------------------------------------- */}
          <Card className="no-print p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-chrome">
              Reach the store
            </h2>
            <div className="mt-3 space-y-2.5 text-sm text-silver">
              <a
                href={telLink}
                className="flex items-center gap-2 transition-colors hover:text-cyan"
              >
                <Phone size={15} className="shrink-0" aria-hidden="true" />
                <span className="tnum font-mono">{contact.phoneDisplay}</span>
              </a>
              <p className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{storeAddress.oneLine}</span>
              </p>
              <p className="text-xs text-ash">
                {businessHours.summary}. {businessHours.note}
              </p>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-ash">
              Quote order{" "}
              <span className="tnum font-mono text-silver">{order.orderNumber}</span>{" "}
              in any message — it is the fastest way for the team to find you.
            </p>
          </Card>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-ash print:text-neutral-700">
        {order.items.length} {pluralize(order.items.length, "line")} · Order{" "}
        {order.orderNumber} · {formatDate(order.createdAt)}
      </p>
    </div>
  );
}
