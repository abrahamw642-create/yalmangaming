/**
 * Shared shapes for the two public enquiry forms.
 *
 * This module is deliberately isomorphic — no `"use client"`, no Prisma. The
 * browser form and the route handler import the *same* schema, so a field the
 * customer sees validated is validated identically on the server. It carries no
 * JSX; the `.tsx` extension only keeps it inside the content area's file
 * ownership.
 *
 * Both forms write a `QuoteRequest` row. There is no separate Inquiry model in
 * the schema and the schema is frozen, so the two are told apart by
 * `snapshot.source` rather than by which table they land in.
 */

import { z } from "zod";
import { BUDGET_BANDS, POPULAR_GAMES } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export const ENQUIRY_SOURCES = ["contact", "quote"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const CONTACT_TOPICS = [
  { id: "build", label: "Building a custom PC" },
  { id: "availability", label: "Price or stock of a part" },
  { id: "order", label: "An order I have placed" },
  { id: "support", label: "Warranty, repair or upgrade" },
  { id: "visit", label: "Visiting the shop" },
  { id: "other", label: "Something else" },
] as const;

export const CONTACT_TOPIC_IDS = CONTACT_TOPICS.map((t) => t.id) as [
  string,
  ...string[],
];

export const BUDGET_IDS = BUDGET_BANDS.map((b) => b.id) as [string, ...string[]];

/** Chips offered on the quote form. Free text covers everything else. */
export const QUOTE_GAME_OPTIONS = [...POPULAR_GAMES] as string[];

export function budgetLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return BUDGET_BANDS.find((band) => band.id === id)?.label ?? null;
}

export function topicLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return CONTACT_TOPICS.find((topic) => topic.id === id)?.label ?? null;
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Phone validation is deliberately loose.
 *
 * Pakistani numbers get typed as `0328 4400231`, `+92 328 4400231`,
 * `92-328-4400231` and every variation in between, and some customers write
 * from abroad. The shop calls the number back, so the only thing worth
 * rejecting is something that is clearly not a phone number at all. The route
 * additionally records a normalised E.164 form when one can be derived, and
 * stores what the customer actually typed either way.
 */
const phoneField = z
  .string()
  .trim()
  .min(7, "Enter a phone number we can call you on")
  .max(24, "That number looks too long")
  .regex(/^[+0-9][0-9\s()\-.]{5,23}$/, "That does not look like a phone number");

const optionalEmail = z
  .string()
  .trim()
  .max(120, "Keep this under 120 characters")
  .email("Enter a valid email address")
  .optional()
  .or(z.literal(""));

export const enquirySchema = z.object({
  source: z.enum(ENQUIRY_SOURCES).default("contact"),
  name: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(80, "Keep this under 80 characters"),
  phone: phoneField,
  email: optionalEmail,
  city: z.string().trim().max(60, "Keep this under 60 characters").optional(),
  /** Contact form only. */
  topic: z.enum(CONTACT_TOPIC_IDS).optional(),
  /** Quote form only — a `BUDGET_BANDS` id. */
  budgetId: z.enum(BUDGET_IDS).optional(),
  /** Quote form only — titles the customer plays. */
  games: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  message: z
    .string()
    .trim()
    .min(5, "Tell us a little about what you need")
    .max(1200, "Keep this under 1200 characters"),
  /**
   * Honeypot. Hidden from people, irresistible to naive bots. A filled value
   * makes the handler answer as though it succeeded without writing anything.
   */
  website: z.string().max(0).optional(),
});

export type EnquiryInput = z.input<typeof enquirySchema>;
export type Enquiry = z.output<typeof enquirySchema>;

/** The unvalidated shape the React forms hold in state. */
export type EnquiryFormState = {
  name: string;
  phone: string;
  email: string;
  city: string;
  topic: string;
  budgetId: string;
  games: string[];
  message: string;
  website: string;
};

export const EMPTY_ENQUIRY: EnquiryFormState = {
  name: "",
  phone: "",
  email: "",
  city: "",
  topic: "",
  budgetId: "",
  games: [],
  message: "",
  website: "",
};

/* -------------------------------------------------------------------------- */
/* Response                                                                   */
/* -------------------------------------------------------------------------- */

export type EnquiryResponse =
  | { ok: true; id: string; receivedAt: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/** Newsletter signup — one field, same isomorphic treatment. */
export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .max(200, "That address is too long")
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),
  website: z.string().max(0).optional(),
});

export type NewsletterResponse =
  | { ok: true; message: string }
  | { ok: false; error: string };
