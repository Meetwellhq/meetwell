export const APP_NAME = "Meetwell";
export const APP_TAGLINE = "Meet someone. Make it a connection.";
export const SUPPORT_EMAIL = "hello@meetwell.me";

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
