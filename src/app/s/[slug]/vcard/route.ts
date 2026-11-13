import { notFound } from "next/navigation";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/config";
import { getSpeakerCard } from "@/lib/speaker-cards-queries";
import { buildVCard, fetchVCardPhoto, vCardFileName } from "@/lib/vcard";

/** A speaker card's contact file, with their photo when Meetwell holds a copy of it. */
export async function GET(_request: Request, { params }: RouteContext<"/s/[slug]/vcard">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const found = await getSpeakerCard(slug);
  if (!found) return new Response("Card not available", { status: 404 });
  const vcard = buildVCard({ ...found.profile, profileUrl: `${getSiteUrl()}/s/${found.profile.slug}`, photo: await fetchVCardPhoto(found.profile.avatarUrl) });
  return new Response(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${vCardFileName(found.profile.fullName)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
