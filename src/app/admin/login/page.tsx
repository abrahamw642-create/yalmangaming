import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/LoginForm";
import { Note } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  // The back office has nothing to gain from being indexed.
  robots: { index: false, follow: false },
};

/** Reads the session cookie on every request; there is nothing to cache. */
export const dynamic = "force-dynamic";

/**
 * Only same-origin admin paths are ever honoured. `?next=` arrives from the
 * middleware redirect and from the address bar alike, so it is re-checked here
 * rather than trusted — an unchecked value turns this page into an open
 * redirect.
 */
function safeNext(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  if (!value.startsWith("/admin")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/admin/login")) return null;
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // Already signed in: skip the form entirely rather than making an admin type
  // their password to reach a page they can already see.
  const user = await getAdminUser();
  if (user) redirect(next ?? "/admin");

  const configured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);

  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-chrome-gradient"
          >
            {siteConfig.name}
          </Link>
          <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-cyan">
            Store admin
          </p>
        </div>

        <div className="metal rounded-2xl p-6">
          <h1 className="font-display text-lg font-semibold text-chrome">Sign in</h1>
          <p className="mt-1 mb-5 text-sm text-silver">
            This area is for Yalman Gaming staff. Customers do not need an account
            to order.
          </p>

          {configured ? (
            <LoginForm next={next} />
          ) : (
            <Note tone="warn">
              <strong className="font-semibold">Sign-in is not configured.</strong> Set{" "}
              <code className="font-mono">AUTH_SECRET</code> (at least 16 characters) in
              the environment and restart the server. Until then no session can be
              signed, so nobody can be let in.
            </Note>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ash">
          <Link href="/" className="transition-colors hover:text-silver">
            ← Back to the storefront
          </Link>
        </p>
      </div>
    </main>
  );
}
