import { NextResponse } from "next/server";
import { publicProfileUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { buildVCard, fetchVCardPhoto, vCardFileName } from "@/lib/vcard";

/** The owner's own vCard. Includes private fields too, since it's their data. */
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getOwnProfile();
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const vcard = buildVCard({
    fullName: profile.fullName,
    title: profile.title,
    organization: profile.organization,
    bio: profile.bio,
    websiteUrl: profile.websiteUrl,
    contacts: profile.contacts.map(({ type, value, label }) => ({ type, value, label })),
    socials: profile.socials.map(({ platform, url }) => ({ platform, url })),
    profileUrl: profile.status === "published" ? publicProfileUrl(profile.slug) : undefined,
    photo: await fetchVCardPhoto(profile.avatarUrl),
  });

  return new Response(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vCardFileName(profile.fullName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
