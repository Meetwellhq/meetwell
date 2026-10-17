export const NETWORKING_GOALS = [
  { value: "collaborators", label: "Collaborators" },
  { value: "clients", label: "New clients" },
  { value: "mentors", label: "Mentors" },
  { value: "mentees", label: "People to mentor" },
  { value: "jobs", label: "Job opportunities" },
  { value: "hiring", label: "People to hire" },
  { value: "investors", label: "Investors" },
  { value: "friends", label: "New friends" },
] as const;

export type NetworkingGoal = (typeof NETWORKING_GOALS)[number]["value"];

export const SOCIAL_PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { value: "x", label: "X", hosts: ["x.com", "twitter.com"] },
  { value: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { value: "github", label: "GitHub", hosts: ["github.com"] },
  { value: "dribbble", label: "Dribbble", hosts: ["dribbble.com"] },
  { value: "behance", label: "Behance", hosts: ["behance.net"] },
  { value: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { value: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { value: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  { value: "threads", label: "Threads", hosts: ["threads.net", "threads.com"] },
  { value: "medium", label: "Medium", hosts: ["medium.com"] },
  { value: "substack", label: "Substack", hosts: ["substack.com"] },
  { value: "other", label: "Other link", hosts: [] },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["value"];

export const CONTACT_TYPES = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number]["value"];

export function socialLabel(platform: string) {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform)?.label ?? "Link";
}

export function goalLabel(goal: string) {
  return NETWORKING_GOALS.find((g) => g.value === goal)?.label ?? goal;
}

export const LIMITS = {
  fullName: 80,
  title: 100,
  organization: 100,
  bio: 500,
  contacts: 10,
  socials: 12,
} as const;

/** Slugs that would be confusing or impersonate the product. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "auth", "dashboard", "help", "login", "logout",
  "me", "meetwell", "new", "privacy", "settings", "signin", "signup",
  "support", "terms", "www",
]);
