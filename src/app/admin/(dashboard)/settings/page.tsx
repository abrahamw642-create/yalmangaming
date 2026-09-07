import type { Metadata } from "next";
import Link from "next/link";

import { Note, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { getSettingsSnapshot } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/auth";
import { businessHours, contact, ratings, siteConfig, storeAddress } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireAdmin();
  const groups = getSettingsSnapshot();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="How this deployment is configured. These are environment variables and source constants, not editable records."
      />

      <Note tone="info">
        <strong className="font-semibold">Nothing on this page is editable, by
        design.</strong> Every value below comes from an environment variable or
        from <code className="font-mono text-cyan">src/lib/site.ts</code>. Change it
        on the host and redeploy — a form here would only pretend to save. Secrets
        report whether they are set and how long they are, never their value.
      </Note>

      {groups.map((group) => (
        <Panel key={group.group} title={group.group} padded={false}>
          <dl className="divide-y divide-[var(--color-line)]">
            {group.rows.map((row) => (
              <div
                key={row.key}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr] sm:gap-4"
              >
                <dt className="min-w-0">
                  <span className="block font-mono text-xs text-chrome">{row.key}</span>
                  <span className="block text-xs text-ash">{row.label}</span>
                </dt>
                <dd className="min-w-0">
                  {row.value ? (
                    <span
                      className={
                        row.secret
                          ? "font-mono text-sm text-emerald"
                          : "font-mono text-sm text-chrome"
                      }
                    >
                      {row.value}
                    </span>
                  ) : (
                    <Pill tone="ember">Not set</Pill>
                  )}
                  {row.note && (
                    <p className="mt-1 text-xs leading-relaxed text-ash">{row.note}</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}

      {/* ---- Business facts --------------------------------------------- */}
      <Panel
        title="Business facts"
        description="Supplied by the store owner and encoded in src/lib/site.ts. Nothing on the storefront may claim more than this."
        padded={false}
      >
        <dl className="divide-y divide-[var(--color-line)]">
          <Row label="Store">{siteConfig.name}</Row>
          <Row label="Address">{storeAddress.oneLine}</Row>
          <Row label="Phone">
            {contact.phoneDisplay}{" "}
            <span className="text-ash">(+{contact.phoneE164})</span>
          </Row>
          <Row label="WhatsApp">{contact.whatsapp}</Row>
          <Row label="Hours">
            {businessHours.summary}
            <span className="mt-1 block text-xs text-ash">
              Only the closing time is confirmed. The site never asserts an opening
              time, and {businessHours.note.toLowerCase()}
            </span>
          </Row>
          <Row label="Rating">
            {ratings.google.score.toFixed(1)} from {ratings.google.count} Google
            reviews
            <span className="mt-1 block text-xs text-ash">
              This is the rating of the <em>shop</em>, not of any product. Product
              star ratings come only from reviews entered under{" "}
              <Link href="/admin/reviews" className="text-cyan hover:text-white">
                Reviews
              </Link>
              .
            </span>
          </Row>
          <Row label="Existing site">{siteConfig.existingSite}</Row>
        </dl>
      </Panel>

      {/* ---- Guidance ---------------------------------------------------- */}
      <Panel title="What this system will and will not do">
        <ul className="flex flex-col gap-3 text-sm leading-relaxed text-silver">
          <Guidance title="Prices">
            Whole rupees, everywhere. A product marked{" "}
            <em>still seeded sample data</em> renders a &ldquo;sample&rdquo; marker on
            the storefront until you clear the flag. Replacing those figures is the
            first job on this system — the dashboard counts what is left.
          </Guidance>
          <Guidance title="Reviews">
            Nothing generates review text. Product ratings are computed from
            approved reviews only, so a product with none shows an empty state
            rather than a score.
          </Guidance>
          <Guidance title="Benchmarks">
            Every published figure carries its source and the CPU it was measured
            with. Products with no rows say &ldquo;No verified data yet&rdquo;.
          </Guidance>
          <Guidance title="Warranty">
            The only wording the site can state is &ldquo;Manufacturer
            warranty&rdquo;. No durations or terms have been supplied, so none are
            offered in the product editor.
          </Guidance>
          <Guidance title="Payments">
            No gateway is connected and no card details are ever collected on this
            site. Card orders are placed as payment pending; you mark them paid on
            the order once the money actually arrives.
          </Guidance>
          <Guidance title="Delivery">
            A flat estimate, labelled as one. No delivery timeframe is stated
            anywhere, because none has been published.
          </Guidance>
          <Guidance title="Sessions">
            Sign-in is a signed cookie valid for twelve hours. It cannot be revoked
            before it expires — changing the password does not sign an open session
            out. Rotating <code className="font-mono text-cyan">AUTH_SECRET</code>{" "}
            does, immediately, for everyone.
          </Guidance>
          <Guidance title="Rate limiting">
            The sign-in throttle is in-memory and per-process. It resets on deploy
            and does not span instances — move it to Redis before running this admin
            on more than one.
          </Guidance>
        </ul>
      </Panel>

      <p className="text-xs text-ash">
        Signed in as <span className="font-mono text-silver">{user.email}</span> with
        the <span className="font-mono text-silver">{user.role}</span> role.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr] sm:gap-4">
      <dt className="text-xs text-ash">{label}</dt>
      <dd className="min-w-0 text-sm text-chrome">{children}</dd>
    </div>
  );
}

function Guidance({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-cyan">
        {title}
      </span>
      <p className="mt-0.5">{children}</p>
    </li>
  );
}
