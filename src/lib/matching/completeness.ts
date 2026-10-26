/**
 * Profile completeness: ten items, 10% each, while Spark is on; while it's
 * paused, the 8 items that don't need the Spark page ("what you're looking
 * for" and city are asked there). 80% unlocks Spark matches and mentoring.
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
  field: string | null;
  experienceYears: number | null;
  lookingFor: string[];
  city: string | null;
};

/** Where each item is filled in: the card editor or the matching details on the Spark page. */
export type CompletenessItem = { label: string; done: boolean; where: "card" | "matching" };

const filled = (v: string | null) => !!v && v.trim() !== "";

export function profileCompleteness(p: CompletenessInput, spark = true) {
  const items: CompletenessItem[] = [
    { label: "Photo", done: !!p.avatarUrl, where: "card" },
    { label: "Job title", done: filled(p.title), where: "card" },
    { label: "Organisation", done: filled(p.organization), where: "card" },
    { label: "Bio", done: filled(p.bio), where: "card" },
    { label: "A public contact (email, WhatsApp or phone)", done: p.hasPublicContact, where: "card" },
    { label: "A public website or social link", done: p.hasPublicLink, where: "card" },
    { label: "Your field", done: !!p.field, where: "matching" },
    { label: "Years of experience", done: p.experienceYears !== null, where: "matching" },
    ...(spark
      ? [
          { label: "What you're looking for", done: p.lookingFor.length > 0, where: "matching" as const },
          { label: "City", done: filled(p.city), where: "matching" as const },
        ]
      : []),
  ];
  const percent = Math.round((items.filter((i) => i.done).length * 100) / items.length);
  return { percent, items, missing: items.filter((i) => !i.done), ready: percent >= MATCHING_MIN_COMPLETENESS };
}
