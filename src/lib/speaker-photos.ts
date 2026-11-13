import "server-only";
import sharp from "sharp";
import { driveFileId } from "./speaker-cards";
import type { createClient } from "./supabase/server";

export const SPEAKER_PHOTO_BUCKET = "speaker-photos";

/**
 * Copies a speaker's photo from Google Drive into Meetwell's storage, as the
 * signed-in partner (storage only lets an event's team write to its folder).
 * Only Google Drive files, only real images under 10 MB; saved as a 512px
 * square JPEG. Returns the new public link, or null if it couldn't be copied
 * (not shared with "Anyone with the link", not an image, too slow…).
 */
export async function copyDrivePhoto(supabase: Awaited<ReturnType<typeof createClient>>, eventSlug: string, driveUrl: string) {
  const id = driveFileId(driveUrl);
  if (!id) return null;
  try {
    const res = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w1000`, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    const host = new URL(res.url).hostname;
    if (!res.ok || !/(^|\.)(google\.com|googleusercontent\.com)$/.test(host)) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > 10 * 1024 * 1024) return null;
    const jpeg = await sharp(bytes, { limitInputPixels: 50_000_000 }).rotate().resize(512, 512, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    const path = `${eventSlug}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(SPEAKER_PHOTO_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) {
      console.error("speaker photo upload failed", error.message);
      return null;
    }
    return supabase.storage.from(SPEAKER_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
