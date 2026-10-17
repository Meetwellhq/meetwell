import { notFound } from "next/navigation";
import { isSupabaseConfigured, publicProfileUrl } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";
import { buildVCard, fetchVCardPhoto, vCardFileName } from "@/lib/vcard";

/** Public vCard: contains only the fields the owner made public. */
export async function GET(_request: Request, { params }: RouteContext<"/p/[slug]/vcard">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const profile = await getPublicProfile(slug);
  if (!profile) return new Response("Profile not available", { status: 404 });

  const vcard = buildVCard({
    ...profile,
    profileUrl: publicProfileUrl(profile.slug),
    photo: await fetchVCardPhoto(profile.avatarUrl),
  });

  return new Response(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      // inline lets iOS show "Create New Contact" instead of saving a file.
      "Content-Disposition": `inline; filename="${vCardFileName(profile.fullName)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
