"use client";

/**
 * Yalman Gaming admin — sign in.
 *
 * The form never says which half of the pair was wrong. `verifyCredentials`
 * returns one opaque failure for "no such account", "not an admin" and "wrong
 * password" alike, and this mirrors that: telling an attacker that an address
 * exists is the whole of the value in enumerating them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import { adminPost } from "@/components/admin/api";
import { Field, Input, Note } from "@/components/admin/ui";
import { Button } from "@/components/ui";

type LoginResponse = { ok: true; redirectTo: string };

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    const result = await adminPost<LoginResponse>("/api/admin/auth/login", {
      email,
      password,
      next: next ?? undefined,
    });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      setFields(result.fields);
      return;
    }

    // The dashboard is a Server Component tree gated on the cookie that this
    // response just set, so the router cache has to be dropped as well.
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Note tone="warn">{error}</Note>}

      <Field label="Email address" htmlFor="admin-email" error={fields.email} required>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          invalid={Boolean(fields.email)}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yalmangaming.com"
        />
      </Field>

      <Field label="Password" htmlFor="admin-password" error={fields.password} required>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          invalid={Boolean(fields.password)}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
