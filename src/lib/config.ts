export const APP_NAME = "Meetwell";
export const APP_TAGLINE = "Meet someone. Make it a connection.";
export const SUPPORT_EMAIL = "support@meetwell.me";
/** The main inbox: general hello, reports about people, and security issues. */
export const INFO_EMAIL = "info@meetwell.me";
/** Meetwell's own social accounts, shown in the footer. Empty ones are hidden. */
export const SOCIAL_LINKS: { platform: "linkedin" | "instagram" | "x" | "youtube"; label: string; url: string }[] = [
  { platform: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/meet-well-me" },
  { platform: "instagram", label: "Instagram", url: "https://www.instagram.com/trymeetwell" },
  { platform: "x", label: "X", url: "https://x.com/trymeetwell" },
  { platform: "youtube", label: "YouTube", url: "https://www.youtube.com/@trymeetwell" },
];

/** The registered company behind Meetwell (CAC, Companies and Allied Matters Act 2020). */
export const COMPANY_NAME = "Meet Well Limited";
export const COMPANY_RC = "RC 9952279";

/**
 * Private beta: new sign-ups are closed and visitors join the early-access
 * list instead. Existing users can still sign in. Set to true to reopen
 * sign-up everywhere (buttons, /sign-up page and the server action).
 */
export const SIGNUPS_OPEN = false;

/** The main call to action for signed-out visitors. */
export const JOIN_CTA = SIGNUPS_OPEN
  ? { href: "/sign-up", label: "Create your free card", short: "Sign up" }
  : { href: "/early-access", label: "Join early access", short: "Join" };

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() {
  return getSupabaseEnv() !== null;
}

/** Absolute origin used for QR codes, share links and vCards. */
export function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

export function publicProfilePath(slug: string) {
  return `/p/${slug}`;
}

export function publicProfileUrl(slug: string) {
  return `${getSiteUrl()}${publicProfilePath(slug)}`;
}

/** The URL encoded in QR codes. `src=qr` lets us count scans separately from link opens. */
export function qrTargetUrl(slug: string) {
  return `${publicProfileUrl(slug)}?src=qr`;
}
