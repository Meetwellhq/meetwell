import type { ContactType, NetworkingGoal, SocialPlatform } from "@/lib/profiles/constants";
import type { OwnProfile, PublicProfile } from "@/lib/profiles/types";

export type FormValues = {
  slug: string;
  fullName: string;
  avatarUrl: string | null;
  title: string;
  organization: string;
  bio: string;
  websiteUrl: string;
  websiteIsPublic: boolean;
  networkingGoals: NetworkingGoal[];
  contacts: { type: ContactType; value: string; label: string; isPublic: boolean }[];
  socials: { platform: SocialPlatform; url: string; isPublic: boolean }[];
};

export type Errors = Record<string, string>;

export type SectionProps = {
  values: FormValues;
  errors: Errors;
  set: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
};

export function toFormValues(profile: OwnProfile | null, email: string | null): FormValues {
  if (!profile) {
    return {
      slug: "",
      fullName: "",
      avatarUrl: null,
      title: "",
      organization: "",
      bio: "",
      websiteUrl: "",
      websiteIsPublic: true,
      networkingGoals: [],
      contacts: email ? [{ type: "email", value: email, label: "", isPublic: true }] : [],
      socials: [],
    };
  }
  return {
    slug: profile.slug,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    title: profile.title ?? "",
    organization: profile.organization ?? "",
    bio: profile.bio ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    websiteIsPublic: profile.websiteIsPublic,
    networkingGoals: profile.networkingGoals,
    contacts: profile.contacts.map((c) => ({ type: c.type, value: c.value, label: c.label ?? "", isPublic: c.isPublic })),
    socials: profile.socials.map((s) => ({ platform: s.platform, url: s.url, isPublic: s.isPublic })),
  };
}

/** Payload for saveProfile(). Empty rows are dropped; the server re-validates everything. */
export function toInput(values: FormValues) {
  return {
    ...values,
    contacts: values.contacts.filter((c) => c.value.trim()),
    socials: values.socials.filter((s) => s.url.trim()),
  };
}

/** Approximate visitor view for the live preview (server output is authoritative). */
export function toPreview(values: FormValues): PublicProfile {
  const website = values.websiteUrl.trim();
  return {
    slug: values.slug || "preview",
    fullName: values.fullName.trim() || "Your name",
    avatarUrl: values.avatarUrl,
    title: values.title.trim() || null,
    organization: values.organization.trim() || null,
    bio: values.bio.trim() || null,
    websiteUrl:
      values.websiteIsPublic && website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
    networkingGoals: values.networkingGoals,
    contacts: values.contacts
      .filter((c) => c.isPublic && c.value.trim())
      .map((c) => ({ type: c.type, value: c.value.trim(), label: c.label.trim() || null })),
    socials: values.socials
      .filter((s) => s.isPublic && s.url.trim())
      .map((s) => ({ platform: s.platform, url: s.url.trim() })),
    updatedAt: new Date(0).toISOString(),
  };
}

/** Rough completeness score for the dashboard and editor. */
export function completion(values: Pick<FormValues, "fullName" | "avatarUrl" | "title" | "bio" | "networkingGoals" | "contacts" | "socials">) {
  const checks = [
    { label: "Name", done: !!values.fullName.trim() },
    { label: "Photo", done: !!values.avatarUrl },
    { label: "Title", done: !!values.title.trim() },
    { label: "Short bio", done: !!values.bio.trim() },
    { label: "A public contact method", done: values.contacts.some((c) => c.isPublic && c.value.trim()) },
    { label: "A social link", done: values.socials.some((s) => s.url.trim()) },
    { label: "Networking goals", done: values.networkingGoals.length > 0 },
  ];
  return { checks, percent: Math.round((checks.filter((c) => c.done).length / checks.length) * 100) };
}
