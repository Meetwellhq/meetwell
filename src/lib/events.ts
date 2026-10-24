/**
 * Partner event pages (/e/<slug>): links and dates. Payments that start from a
 * speaker's card opened from an event page carry `event=<slug>`, and the
 * database credits the event's partner (see 20261128000000_partner_events.sql).
 */

import { getSiteUrl } from "./config";

/** Event links use the same shape the database checks: lowercase letters, numbers and single dashes. */
export const EVENT_SLUG = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export const isEventSlug = (value: unknown): value is string =>
  typeof value === "string" && EVENT_SLUG.test(value) && !value.includes("--");

export const eventPath = (slug: string) => `/e/${slug}`;

/** A speaker's card, opened from the event (keeps the event for payments). */
export const eventCardPath = (cardSlug: string, eventSlug: string) => `/p/${cardSlug}?event=${encodeURIComponent(eventSlug)}`;

/** What QR codes encode: the event page (for slides), or a speaker's card (for badges). `src=qr` counts scans. */
export function eventQrTarget(eventSlug: string, speakerSlug?: string) {
  const site = getSiteUrl();
  return speakerSlug
    ? `${site}/p/${speakerSlug}?src=qr&event=${encodeURIComponent(eventSlug)}`
    : `${site}/e/${eventSlug}?src=qr`;
}

/** "20 November 2026", or "20–21 November 2026" / "30 November – 1 December 2026" for longer events. */
export function eventDates(startsOn: string, endsOn: string | null) {
  const d = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "Africa/Lagos" });
  const full = { day: "numeric", month: "long", year: "numeric" } as const;
  if (!endsOn || endsOn === startsOn) return d(startsOn, full);
  const [sy, sm] = startsOn.split("-");
  const [ey, em] = endsOn.split("-");
  if (sy === ey && sm === em) return `${d(startsOn, { day: "numeric" })}–${d(endsOn, full)}`;
  if (sy === ey) return `${d(startsOn, { day: "numeric", month: "long" })} – ${d(endsOn, full)}`;
  return `${d(startsOn, full)} – ${d(endsOn, full)}`;
}
