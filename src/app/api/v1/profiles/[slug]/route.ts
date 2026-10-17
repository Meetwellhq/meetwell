import { NextResponse } from "next/server";
import { isSupabaseConfigured, publicProfileUrl } from "@/lib/config";
import { getPublicProfile } from "@/lib/profiles/queries";

/**
 * Versioned public profile contract for future mobile clients and
 * integrations. Returns exactly the public projection — never private fields.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/v1/profiles/[slug]">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const profile = await getPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { data: { ...profile, profileUrl: publicProfileUrl(profile.slug), vcardUrl: `${publicProfileUrl(profile.slug)}/vcard` } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
