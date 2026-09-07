"use client";

/**
 * Yalman Gaming admin — the dashboard frame.
 *
 * A client component because the navigation highlights the current section and
 * the mobile drawer holds open/closed state. Everything inside it stays a
 * Server Component: the shell takes the rendered page as `children`, so no page
 * content is pulled into this bundle.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ExternalLink,
  FileText,
  FolderTree,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Ticket,
  Trophy,
  X,
} from "lucide-react";

import { adminPost } from "@/components/admin/api";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type NavEntry = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Shown as a small count chip when non-zero. */
  badgeKey?: keyof NavBadges;
  hint?: string;
};

export type NavBadges = {
  samplePriced: number;
  openOrders: number;
  newQuotes: number;
  pendingReviews: number;
};

const NAV: { section: string; entries: NavEntry[] }[] = [
  {
    section: "Overview",
    entries: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Selling",
    entries: [
      { href: "/admin/products", label: "Products", icon: Package, badgeKey: "samplePriced" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, badgeKey: "openOrders" },
      { href: "/admin/quotes", label: "Quotes", icon: FileText, badgeKey: "newQuotes" },
      { href: "/admin/builds", label: "Saved builds", icon: Gauge },
      { href: "/admin/reviews", label: "Reviews", icon: Star, badgeKey: "pendingReviews" },
    ],
  },
  {
    section: "Catalogue",
    entries: [
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/showcase", label: "Showcase builds", icon: Trophy },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket },
      { href: "/admin/benchmarks", label: "Benchmarks", icon: Activity },
    ],
  },
  {
    section: "System",
    entries: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  user,
  badges,
  children,
}: {
  user: { email: string; name: string | null };
  badges: NavBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Any navigation closes the mobile drawer; leaving it open over the new page
  // is the classic mobile-nav bug.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* --- Mobile bar ------------------------------------------------- */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-carbon/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-line-strong)] text-chrome"
          aria-expanded={open}
          aria-controls="admin-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <Link href="/admin" className="font-display text-sm font-bold tracking-tight text-chrome">
          Yalman Gaming
          <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-widest text-cyan">
            admin
          </span>
        </Link>
        <SignOutButton compact />
      </div>

      {/* --- Sidebar ---------------------------------------------------- */}
      <aside
        id="admin-nav"
        className={cn(
          "border-b border-[var(--color-line)] bg-carbon",
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r",
          open ? "block" : "hidden lg:block",
        )}
      >
        <div className="hidden items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-4 lg:flex">
          <Link href="/admin" className="min-w-0">
            <span className="block font-display text-base font-bold tracking-tight text-chrome">
              Yalman Gaming
            </span>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-cyan">
              Store admin
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-5 px-3 py-4" aria-label="Admin sections">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ash">
                {group.section}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.entries.map((entry) => {
                  const active = isActive(pathname, entry.href);
                  const count = entry.badgeKey ? badges[entry.badgeKey] : 0;
                  const Icon = entry.icon;

                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-cyan/10 text-cyan"
                            : "text-silver hover:bg-white/[0.04] hover:text-chrome",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{entry.label}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "tnum rounded-full px-1.5 py-0.5 font-mono text-[0.625rem]",
                              active ? "bg-cyan/20 text-cyan" : "bg-white/8 text-ash",
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-line)] px-3 py-3">
          <Link
            href="/"
            className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ash transition-colors hover:bg-white/[0.04] hover:text-chrome"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View the storefront
          </Link>
          <div className="rounded-lg border border-[var(--color-line)] px-2.5 py-2">
            <p className="truncate text-xs font-medium text-chrome">
              {user.name || "Signed in"}
            </p>
            <p className="truncate font-mono text-[0.6875rem] text-ash">{user.email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* --- Page ------------------------------------------------------- */}
      <main id="main" className="min-w-0 bg-void">
        <div className="mx-auto w-full max-w-[100rem] px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                   */
/* -------------------------------------------------------------------------- */

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  async function signOut() {
    setBusy(true);
    const result = await adminPost<{ ok: true }>("/api/admin/auth/logout");
    if (!result.ok) {
      setBusy(false);
      toast.error(result.error);
      return;
    }
    // `refresh()` after `replace()` so the server re-renders without the
    // session cookie instead of serving the cached authenticated shell.
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-line-strong)]",
        "text-xs text-silver transition-colors hover:border-rose/50 hover:text-rose disabled:opacity-50",
        compact ? "h-9 px-3" : "h-8 w-full px-3",
      )}
    >
      {busy ? <Spinner className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
      Sign out
    </button>
  );
}
