export const AVATAR_BUCKET = "avatars";

function avatarPublicPrefix() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/${AVATAR_BUCKET}/` : null;
}

/** True only for public URLs inside this project's avatar bucket. */
export function isAvatarStorageUrl(url: string): boolean {
  const prefix = avatarPublicPrefix();
  return !!prefix && url.startsWith(prefix) && !url.slice(prefix.length).includes("..");
}

/** Storage object path ("<userId>/<file>") from a public avatar URL. */
export function avatarObjectPath(url: string): string | null {
  const prefix = avatarPublicPrefix();
  if (!prefix || !url.startsWith(prefix)) return null;
  return decodeURIComponent(url.slice(prefix.length).split("?")[0]);
}

/** True only for public URLs in this project's speaker photo bucket (photos partners added). */
export function isSpeakerPhotoUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const prefix = base ? `${base}/storage/v1/object/public/speaker-photos/` : null;
  return !!prefix && url.startsWith(prefix) && !url.slice(prefix.length).includes("..");
}
