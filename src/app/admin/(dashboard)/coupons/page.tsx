import type { Metadata } from "next";

import {
  CouponManager,
  type CouponRow,
} from "@/components/admin/CouponManager";
import { Note, PageHeader } from "@/components/admin/ui";
import { listCoupons } from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

/** `<input type="date">` wants `YYYY-MM-DD`, in no timezone in particular. */
function toDateInput(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * The state the *checkout* would compute for this code right now, worked out
 * on the server so it agrees with `validateCoupon` rather than with whatever
 * clock the admin's browser happens to hold.
 */
function couponState(coupon: {
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}): CouponRow["state"] {
  if (!coupon.active) return "off";
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return "scheduled";
  if (coupon.expiresAt && coupon.expiresAt < now) return "expired";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "used-up";
  return "live";
}

export default async function AdminCouponsPage() {
  const rows = await listCoupons();

  const coupons: CouponRow[] = rows.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minSpend: coupon.minSpend,
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    active: coupon.active,
    startsAt: toDateInput(coupon.startsAt),
    expiresAt: toDateInput(coupon.expiresAt),
    state: couponState(coupon),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Promotions"
        title="Coupons"
        description="Discount codes the checkout accepts. Every code is re-validated server-side before an order is written."
      />

      <Note tone="info">
        A discount applies to the goods subtotal only — never to the delivery
        estimate — and can never exceed the value of the goods. Usage is counted
        inside the order transaction, so two customers cannot both redeem the last
        use of a capped code.
      </Note>

      <CouponManager coupons={coupons} />
    </div>
  );
}
