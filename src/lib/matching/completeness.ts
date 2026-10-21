/**
 * Profile completeness for Spark (AI matching): ten items, 10% each. Members
 * need 80% to get matches or be recommended. Keep in step with
 * public.profile_completeness() in the database, which enforces it.
 */

export const MATCHING_MIN_COMPLETENESS = 80;

export type CompletenessInput = {
  avatarUrl: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  hasPublicContact: boolean;
  hasPublicLink: boolean;
  field: string | null;
  experienceYears: number | null;
  lookingFor: string[];
  city: string | null;
};

/** Where each item is filled in: the card editor or the matching details on the Spark page. */
export type CompletenessItem = { label: string; done: boolean; where: "card" | "matching" };

const filled = (v: string | null) => !!v && v.trim() !== "";

export function profileCompleteness(p: CompletenessInput) {
  const items: CompletenessItem[] = [
    { label: "Photo", done: !!p.avatarUrl, where: "card" },
    { label: "Job title", done: filled(p.title), where: "card" },
    { label: "Organisation", done: filled(p.organization), where: "card" },
    { label: "Bio", done: filled(p.bio), where: "card" },
    { label: "A public contact (email, WhatsApp or phone)", done: p.hasPublicContact, where: "card" },
    { label: "A public website or social link", done: p.hasPublicLink, where: "card" },
    { label: "Your field", done: !!p.field, where: "matching" },
    { label: "Years of experience", done: p.experienceYears !== null, where: "matching" },
    { label: "What you're looking for", done: p.lookingFor.length > 0, where: "matching" },
    { label: "City", done: filled(p.city), where: "matching" },
  ];
  const percent = items.filter((i) => i.done).length * 10;
  return { percent, items, missing: items.filter((i) => !i.done), ready: percent >= MATCHING_MIN_COMPLETENESS };
}
