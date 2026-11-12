/**
 * Profile completeness: ten items, 10% each, while Spark is on; while it's
 * paused, the 6 that matter most (photo, title, bio, a public contact, a
 * social media link, years of experience). 80% unlocks Spark matches and mentoring.
 * Keep in step with public.profile_completeness() in the database, which
 * enforces it.
 */

export const MATCHING_MIN_COMPLETENESS = 80;

export type CompletenessInput = {
  avatarUrl: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  hasPublicContact: boolean;
  hasPublicLink: boolean;
  /** A public social link only (not the website). */
  hasPublicSocial: boolean;
  field: string | null;
  experienceYears: number | null;
  lookingFor: string[];
  city: string | null;
};

/** Where each item is filled in: the card editor or the matching details on the Spark page. */
export type CompletenessKey = "photo" | "title" | "organisation" | "bio" | "contact" | "link" | "social" | "field" | "years" | "lookingFor" | "city";
export type CompletenessItem = { key: CompletenessKey; label: string; done: boolean; where: "card" | "matching" };

const filled = (v: string | null) => !!v && v.trim() !== "";

export function profileCompleteness(p: CompletenessInput, spark = true) {
  const photo: CompletenessItem = { key: "photo", label: "Photo", done: !!p.avatarUrl, where: "card" };
  const title: CompletenessItem = { key: "title", label: "Job title", done: filled(p.title), where: "card" };
  const bio: CompletenessItem = { key: "bio", label: "Bio", done: filled(p.bio), where: "card" };
  const contact: CompletenessItem = { key: "contact", label: "A public contact (email, WhatsApp or phone)", done: p.hasPublicContact, where: "card" };
  const years: CompletenessItem = { key: "years", label: "Years of experience", done: p.experienceYears !== null, where: "card" };
  const items: CompletenessItem[] = spark
    ? [
        photo,
        title,
        { key: "organisation", label: "Organisation", done: filled(p.organization), where: "card" },
        bio,
        contact,
        { key: "link", label: "A public website or social link", done: p.hasPublicLink, where: "card" },
        { key: "field", label: "Your field", done: !!p.field, where: "card" },
        years,
        { key: "lookingFor", label: "What you're looking for", done: p.lookingFor.length > 0, where: "matching" },
        { key: "city", label: "City", done: filled(p.city), where: "matching" },
      ]
    : [
        photo,
        title,
        bio,
        contact,
        { key: "social", label: "A social media link (Instagram, TikTok, YouTube…)", done: p.hasPublicSocial, where: "card" },
        years,
      ];
  const percent = Math.round((items.filter((i) => i.done).length * 100) / items.length);
  return { percent, items, missing: items.filter((i) => !i.done), ready: percent >= MATCHING_MIN_COMPLETENESS };
}
