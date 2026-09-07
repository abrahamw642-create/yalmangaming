import type { Metadata } from "next";
import * as React from "react";

import { AdminShell } from "@/components/admin/Shell";
import { AdminToastProvider } from "@/components/admin/Toast";
import { getNavBadges } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Yalman Gaming admin" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Every admin page reads the session cookie and live database counts, so there
 * is nothing here that can be statically rendered or cached between requests.
 */
export const dynamic = "force-dynamic";

/**
 * The authenticated shell.
 *
 * `requireAdmin()` runs here, before any child renders, and redirects to the
 * login screen when the session is missing, expired or belongs to an account
 * that is no longer an admin. `src/middleware.ts` performs a cheaper version
 * of the same check at the edge, but middleware only verifies the cookie's
 * signature — it never touches the database, so *this* is the boundary that
 * actually decides who gets in. Route handlers have their own gate,
 * `requireAdminApi()`.
 *
 * This layout owns the page's single `<main id="main">` landmark (rendered
 * inside `AdminShell`), which is what the root layout's skip link targets.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const badges = await getNavBadges();

  return (
    <AdminToastProvider>
      <AdminShell user={{ email: user.email, name: user.name }} badges={badges}>
        {children}
      </AdminShell>
    </AdminToastProvider>
  );
}
