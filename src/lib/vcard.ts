import { isAvatarStorageUrl } from "./profiles/avatar";
import type { PublicProfile } from "./profiles/types";

export type VCardInput = Pick<
  PublicProfile,
  "fullName" | "title" | "organization" | "bio" | "websiteUrl" | "contacts" | "socials"
> & {
  profileUrl?: string;
  photo?: { base64: string; type: "JPEG" | "PNG" | "WEBP" } | null;
};

/** Escape a value per RFC 6350 §3.4 (also valid for vCard 3.0). */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold lines longer than 75 octets with CRLF + space, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function splitName(fullName: string): { family: string; given: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { family: "", given: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
}

export function buildVCard(input: VCardInput): string {
  const { family, given } = splitName(input.fullName);
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardValue(input.fullName)}`,
    `N:${escapeVCardValue(family)};${escapeVCardValue(given)};;;`,
  ];

  if (input.organization) lines.push(`ORG:${escapeVCardValue(input.organization)}`);
  if (input.title) lines.push(`TITLE:${escapeVCardValue(input.title)}`);

  for (const contact of input.contacts) {
    if (contact.type === "email") {
      lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(contact.value)}`);
    } else {
      const type = contact.type === "whatsapp" ? "CELL" : "CELL,VOICE";
      lines.push(`TEL;TYPE=${type}:${escapeVCardValue(contact.value)}`);
    }
  }

  if (input.websiteUrl) lines.push(`URL:${escapeVCardValue(input.websiteUrl)}`);
  if (input.profileUrl) lines.push(`URL;TYPE=profile:${escapeVCardValue(input.profileUrl)}`);

  for (const social of input.socials) {
    lines.push(`X-SOCIALPROFILE;TYPE=${social.platform}:${escapeVCardValue(social.url)}`);
  }

  if (input.bio) lines.push(`NOTE:${escapeVCardValue(input.bio)}`);
  if (input.photo) lines.push(`PHOTO;ENCODING=b;TYPE=${input.photo.type}:${input.photo.base64}`);

  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function vCardFileName(fullName: string): string {
  const base = fullName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${base || "contact"}.vcf`;
}

/**
 * Fetch a profile photo and return it base64-encoded for embedding, so the
 * photo survives import on phones that ignore remote PHOTO URIs. Best effort:
 * failures or oversized images return null.
 */
export async function fetchVCardPhoto(url: string | null): Promise<VCardInput["photo"]> {
  // Only fetch from our own storage bucket, never an arbitrary host (SSRF).
  if (!url || !isAvatarStorageUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "error" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const type = contentType.includes("png")
      ? "PNG"
      : contentType.includes("webp")
        ? "WEBP"
        : contentType.includes("jpeg") || contentType.includes("jpg")
          ? "JPEG"
          : null;
    if (!type) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 512 * 1024) return null;
    return { base64: Buffer.from(buffer).toString("base64"), type };
  } catch {
    return null;
  }
}
