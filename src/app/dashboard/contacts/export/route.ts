import { NextResponse } from "next/server";
import { publicProfileUrl } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { buildVCard } from "@/lib/vcard";

/**
 * All of my Contacts as one .vcf file, which phone contacts apps can import in
 * one go. Public fields only (what each person chose to share), no photos so
 * the file stays small.
 */
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await (await createClient()).rpc("my_contacts");
  const slugs = ((data ?? []) as { slug: string }[]).map((c) => c.slug).slice(0, 500);

  const cards: string[] = [];
  for (let i = 0; i < slugs.length; i += 10) {
    const batch = await Promise.all(slugs.slice(i, i + 10).map((s) => getPublicProfile(s)));
    for (const p of batch) if (p) cards.push(buildVCard({ ...p, profileUrl: publicProfileUrl(p.slug), photo: null }));
  }

  return new Response(cards.join(""), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meetwell-contacts.vcf"',
      "Cache-Control": "private, no-store",
    },
  });
}
