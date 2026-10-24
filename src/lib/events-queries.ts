import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type PublicEvent = {
  slug: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  venue: string | null;
  about: string | null;
  partnerName: string;
};

export type EventSpeaker = {
  slug: string;
  fullName: string;
  title: string | null;
  organization: string | null;
  avatarUrl: string | null;
  /** Mentoring price in kobo when they take messages (0 = free), otherwise null. */
  priceKobo: number | null;
};

/** An active event of an active partner, with its speakers' public card details. */
export const getPublicEvent = cache(async (slug: string) => {
  const supabase = await createClient();
  const [{ data: rows }, { data: speakerRows }] = await Promise.all([
    supabase.rpc("public_event", { p_slug: slug }),
    supabase.rpc("public_event_speakers", { p_slug: slug }),
  ]);
  const row = (rows as { slug: string; name: string; starts_on: string; ends_on: string | null; venue: string | null; about: string | null; partner_name: string }[] | null)?.[0];
  if (!row) return null;
  const event: PublicEvent = {
    slug: row.slug,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    venue: row.venue,
    about: row.about,
    partnerName: row.partner_name,
  };
  const speakers: EventSpeaker[] = ((speakerRows ?? []) as {
    slug: string; full_name: string; title: string | null; organization: string | null; avatar_url: string | null; price_kobo: number | null;
  }[]).map((s) => ({
    slug: s.slug,
    fullName: s.full_name,
    title: s.title,
    organization: s.organization,
    avatarUrl: s.avatar_url,
    priceKobo: s.price_kobo,
  }));
  return { event, speakers };
});
