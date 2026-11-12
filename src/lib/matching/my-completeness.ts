import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSparkOn } from "../spark";
import { profileCompleteness } from "./completeness";

/** The columns profileCompleteness() needs, for selecting from profiles. */
export const COMPLETENESS_COLUMNS =
  "avatar_url, professional_title, organization, bio, website_url, website_is_public, field, experience_years, looking_for, city, contact_methods(is_public), social_links(is_public)";

type Row = {
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
  bio: string | null;
  website_url: string | null;
  website_is_public: boolean;
  field: string | null;
  experience_years: number | null;
  looking_for: string[] | null;
  city: string | null;
  contact_methods: { is_public: boolean }[] | null;
  social_links: { is_public: boolean }[] | null;
};

/**
 * The one profile score members see (dashboard, Spark page) and get emailed
 * about, the same as public.profile_completeness() (6 items while Spark is paused).
 */
export function completenessOf(profile: Row, spark = true) {
  return profileCompleteness(
    {
      avatarUrl: profile.avatar_url,
      title: profile.professional_title,
      organization: profile.organization,
      bio: profile.bio,
      hasPublicContact: (profile.contact_methods ?? []).some((c) => c.is_public),
      hasPublicLink: (profile.social_links ?? []).some((l) => l.is_public) || (!!profile.website_url && profile.website_is_public),
      hasPublicSocial: (profile.social_links ?? []).some((l) => l.is_public),
      field: profile.field,
      experienceYears: profile.experience_years,
      lookingFor: profile.looking_for ?? [],
      city: profile.city,
    },
    spark,
  );
}

/** The signed-in member's score, or null if they have no card yet. */
export async function myCompleteness(supabase: SupabaseClient, userId: string) {
  const [{ data }, spark] = await Promise.all([
    supabase.from("profiles").select(COMPLETENESS_COLUMNS).eq("user_id", userId).maybeSingle(),
    isSparkOn(),
  ]);
  return data ? completenessOf(data as unknown as Row, spark) : null;
}
