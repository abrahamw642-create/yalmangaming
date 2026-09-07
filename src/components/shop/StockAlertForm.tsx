"use client";

/**
 * "Notify me" for an out-of-stock product.
 *
 * Deliberately makes no promise about *when* the part will return — Yalman has
 * not given delivery or restock timings, so the copy says only that we will get
 * in touch. Either an email address or a phone number is enough; the route
 * handler validates the same rule server-side.
 */

import * as React from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "done" | "error";

export function StockAlertForm({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;

    if (!email.trim() && !phone.trim()) {
      setStatus("error");
      setMessage("Enter an email address or a phone number so we can reach you.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/stock-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data: { ok?: boolean; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not save that. Please try again.");
        return;
      }

      setStatus("done");
      setEmail("");
      setPhone("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-emerald/30 bg-emerald/[0.07] p-4",
          className,
        )}
        role="status"
      >
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-chrome">You are on the list</p>
          <p className="mt-1 text-xs leading-relaxed text-silver">
            We will contact you when {productName} is back in stock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn("metal flex flex-col gap-3 rounded-xl p-4", className)}
      aria-labelledby="stock-alert-heading"
    >
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-ember" aria-hidden="true" />
        <p id="stock-alert-heading" className="text-sm font-semibold text-chrome">
          Tell me when it is back
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] uppercase tracking-wider text-ash">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-lg border border-[var(--color-line)] bg-void/60 px-3 text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] uppercase tracking-wider text-ash">
            Phone / WhatsApp
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="03xx xxxxxxx"
            className="tnum h-11 rounded-lg border border-[var(--color-line)] bg-void/60 px-3 font-mono text-sm text-chrome placeholder:text-ash focus:border-cyan/50 focus:outline-none"
          />
        </label>
      </div>

      <p className="text-[0.6875rem] leading-relaxed text-ash">
        Either one is enough. We will only use it to tell you about this product.
      </p>

      {message && (
        <p role="alert" className="text-xs text-rose">
          {message}
        </p>
      )}

      <Button type="submit" variant="secondary" loading={status === "sending"}>
        NOTIFY ME
      </Button>
    </form>
  );
}
