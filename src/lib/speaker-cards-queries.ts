import "server-only";
import { cache } from "react";
import type { PublicProfile } from "./profiles/types";
import { createClient } from "./supabase/server";

type Row = {
  slug: string; full_name: string; title: string | null; organization: string | null; bio: string | null; photo_url: string | null;
  email: string | null; phone: string | null; whatsapp: string | null; linkedin: string | null; x: string | null;
  instagram: string | null; facebook: string | null; tiktok: string | null; website: string | null; created_at: string;
  event_slug: string; event_name: string; partner_name: string;
};

/**
 * A speaker card (/s/<slug>) in the same shape as a member's public card, so it
 * shows and saves the same way, plus the event and partner behind it.
 */
export const getSpeakerCard = cache(async (slug: string) => {
  const { data } = await (await createClient()).rpc("public_speaker_card", { p_slug: slug });
  const r = ((data ?? []) as Row[])[0];
  if (!r) return null;
  const contacts: PublicProfile["contacts"] = [];
  if (r.email) contacts.push({ type: "email", value: r.email, label: null });
  if (r.phone) contacts.push({ type: "phone", value: r.phone, label: null });
  if (r.whatsapp) contacts.push({ type: "whatsapp", value: r.whatsapp, label: null });
  const socials: PublicProfile["socials"] = (["linkedin", "x", "instagram", "facebook", "tiktok"] as const)
    .filter((p) => r[p])
    .map((p) => ({ platform: p, url: r[p]! }));
  const profile: PublicProfile = {
    slug: r.slug,
    fullName: r.full_name,
    avatarUrl: r.photo_url,
    title: r.title,
    organization: r.organization,
    bio: r.bio,
    websiteUrl: r.website,
    networkingGoals: [],
    contacts,
    socials,
    updatedAt: r.created_at,
    joinedYear: null,
  };
  return { profile, event: { slug: r.event_slug, name: r.event_name, partnerName: r.partner_name } };
});
