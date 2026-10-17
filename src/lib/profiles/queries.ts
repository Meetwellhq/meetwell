import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import type { NetworkingGoal } from "./constants";
import type { EventType, OwnProfile, PublicProfile } from "./types";

type ProfileRow = {
  id: string;
  slug: string;
  full_name: string;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
  bio: string | null;
  website_url: string | null;
  website_is_public: boolean;
  networking_goals: string[];
  status: OwnProfile["status"];
  published_at: string | null;
  updated_at: string;
  contact_methods: {
    id: string;
    type: OwnProfile["contacts"][number]["type"];
    value: string;
    label: string | null;
    is_public: boolean;
    sort_order: number;
  }[];
  social_links: {
    id: string;
    platform: OwnProfile["socials"][number]["platform"];
    url: string;
    is_public: boolean;
    sort_order: number;
  }[];
};

const OWN_PROFILE_SELECT = `
  id, slug, full_name, avatar_url, professional_title, organization, bio,
  website_url, website_is_public, networking_goals, status, published_at, updated_at,
  contact_methods ( id, type, value, label, is_public, sort_order ),
  social_links ( id, platform, url, is_public, sort_order )
`;

function mapOwnProfile(row: ProfileRow): OwnProfile {
  const bySort = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    title: row.professional_title,
    organization: row.organization,
    bio: row.bio,
    websiteUrl: row.website_url,
    websiteIsPublic: row.website_is_public,
    networkingGoals: row.networking_goals as NetworkingGoal[],
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    contacts: [...row.contact_methods].sort(bySort).map((c) => ({
      id: c.id,
      type: c.type,
      value: c.value,
      label: c.label,
      isPublic: c.is_public,
    })),
    socials: [...row.social_links].sort(bySort).map((s) => ({
      id: s.id,
      platform: s.platform,
      url: s.url,
      isPublic: s.is_public,
    })),
  };
}

/** The signed-in user's own profile (RLS restricts this to their row). */
export const getOwnProfile = cache(async (): Promise<OwnProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_SELECT)
    .maybeSingle<ProfileRow>();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data ? mapOwnProfile(data) : null;
});

/** Public view of a published profile, or null if missing/unpublished. */
export const getPublicProfile = cache(async (slug: string): Promise<PublicProfile | null> => {
  if (!/^[a-z0-9-]{3,40}$/i.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: slug });
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return (data as PublicProfile | null) ?? null;
});

export type ProfileStats = {
  days: number;
  views: number;
  qrScans: number;
  saves: number;
  contactClicks: number;
  messagesCopied: number;
};

export async function getOwnProfileStats(days = 30): Promise<ProfileStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_profile_stats", { p_days: days });
  if (error) throw new Error(`Could not load stats: ${error.message}`);

  const rows = (data ?? []) as { event_type: EventType; source: string | null; total: number }[];
  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((n, r) => n + Number(r.total), 0);

  return {
    days,
    views: sum((r) => r.event_type === "view"),
    qrScans: sum((r) => r.event_type === "view" && r.source === "qr"),
    saves: sum((r) => r.event_type === "save_contact"),
    contactClicks: sum((r) =>
      ["email_click", "phone_click", "website_click", "social_click"].includes(r.event_type),
    ),
    messagesCopied: sum((r) => r.event_type === "copy_message"),
  };
}
