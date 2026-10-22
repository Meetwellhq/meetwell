import type { ContactType, NetworkingGoal, SocialPlatform } from "./constants";

/**
 * Public data contract for a profile. This is exactly what
 * get_public_profile() returns and what /api/v1/profiles/[slug] serves, so web
 * and future mobile clients share one shape. It never contains private fields.
 */
export type PublicProfile = {
  slug: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  websiteUrl: string | null;
  networkingGoals: NetworkingGoal[];
  contacts: { type: ContactType; value: string; label: string | null }[];
  socials: { platform: SocialPlatform; url: string }[];
  updatedAt: string;
  /** The year the card was created ("Joined 2026"). Only the year is public. */
  joinedYear?: number | null;
};

export type ProfileStatus = "draft" | "published" | "unpublished";

export type OwnContactMethod = {
  id?: string;
  type: ContactType;
  value: string;
  label: string | null;
  isPublic: boolean;
};

export type OwnSocialLink = {
  id?: string;
  platform: SocialPlatform;
  url: string;
  isPublic: boolean;
};

/** The owner's full view of their own profile, including private fields. */
export type OwnProfile = {
  id: string;
  slug: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  websiteUrl: string | null;
  websiteIsPublic: boolean;
  networkingGoals: NetworkingGoal[];
  status: ProfileStatus;
  publishedAt: string | null;
  updatedAt: string;
  createdAt?: string;
  contacts: OwnContactMethod[];
  socials: OwnSocialLink[];
};

export type EventType =
  | "view"
  | "save_contact"
  | "email_click"
  | "phone_click"
  | "website_click"
  | "social_click"
  | "copy_message";

/** Reduce an owner profile to what a visitor would see. Mirrors get_public_profile(). */
export function toPublicView(profile: OwnProfile): PublicProfile {
  return {
    slug: profile.slug,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    title: profile.title,
    organization: profile.organization,
    bio: profile.bio,
    websiteUrl: profile.websiteIsPublic ? profile.websiteUrl : null,
    networkingGoals: profile.networkingGoals,
    contacts: profile.contacts
      .filter((c) => c.isPublic)
      .map(({ type, value, label }) => ({ type, value, label })),
    socials: profile.socials
      .filter((s) => s.isPublic)
      .map(({ platform, url }) => ({ platform, url })),
    updatedAt: profile.updatedAt,
    joinedYear: joinedYear(profile.createdAt),
  };
}

/** The Lagos-time year of a date, as shown in "Joined 2026". */
export function joinedYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric" }).format(new Date(iso)));
}
